import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  CreateOrderResult,
  DishSnapshot,
  NewOrder,
  OrderFilter,
  OrderRecord,
  OrderStatus,
  StockShortage,
} from "./orders.dto.js";

// DAO des commandes
export interface OrderRepository {
  // Crée la commande ET décrémente le stock, en une transaction : tout ou rien
  create(order: NewOrder): Promise<CreateOrderResult>;
  findById(id: number): Promise<OrderRecord | null>;
  find(filter: OrderFilter): Promise<{ items: OrderRecord[]; total: number }>;
  // Change le statut seulement si la commande est encore à `from` (null sinon : quelqu'un l'a modifiée entre-temps).
  // `restock` remet les portions en stock dans la même transaction (annulation).
  updateStatus(id: number, from: OrderStatus, to: OrderStatus, restock: boolean): Promise<OrderRecord | null>;
}

// Lecture des plats nécessaire pour passer commande (prix et disponibilité viennent de la base)
export interface DishReader {
  findByIds(ids: number[]): Promise<DishSnapshot[]>;
}

const orderInclude = {
  user: { select: { id: true, name: true } },
  items: { include: { dish: { select: { name: true } } }, orderBy: { dishId: "asc" as const } },
};

type PrismaOrder = Awaited<ReturnType<PrismaClient["order"]["findFirstOrThrow"]>> & {
  user: { id: number; name: string };
  items: { dishId: number; quantity: number; unitPriceCents: number; dish: { name: string } }[];
};

const toRecord = (o: PrismaOrder): OrderRecord => ({
  id: o.id,
  status: o.status,
  note: o.note,
  totalCents: o.totalCents,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
  user: o.user,
  items: o.items.map((i) => ({
    dishId: i.dishId,
    name: i.dish.name,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
  })),
});

// Sert uniquement à annuler la transaction Prisma ; jamais exposée hors de ce fichier
class StockShortageError extends Error {
  constructor(readonly shortages: StockShortage[]) {
    super("Stock insuffisant");
  }
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(order: NewOrder): Promise<CreateOrderResult> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const shortages: StockShortage[] = [];
        for (const { dishId, quantity } of order.items) {
          // Décrément conditionnel (jamais « lire puis écrire ») : stock illimité (null) ou assez de portions
          const { count } = await tx.dish.updateMany({
            where: { id: dishId, OR: [{ stock: null }, { stock: { gte: quantity } }] },
            data: { stock: { decrement: quantity } },
          });
          if (count === 0) {
            const dish = await tx.dish.findUnique({ where: { id: dishId }, select: { stock: true } });
            shortages.push({ dishId, available: dish?.stock ?? 0 });
          }
        }
        if (shortages.length > 0) throw new StockShortageError(shortages); // annule la transaction

        // Commande et lignes en une seule écriture
        return tx.order.create({
          data: {
            userId: order.userId,
            note: order.note,
            totalCents: order.totalCents,
            items: {
              create: order.items.map(({ dishId, quantity, unitPriceCents }) => ({ dishId, quantity, unitPriceCents })),
            },
          },
          include: orderInclude,
        });
      });
      return { order: toRecord(created) };
    } catch (error) {
      if (error instanceof StockShortageError) return { shortages: error.shortages };
      throw error;
    }
  }

  async updateStatus(id: number, from: OrderStatus, to: OrderStatus, restock: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({ where: { id, status: from }, data: { status: to } });
      if (count === 0) return null;

      if (restock) {
        const lines = await tx.orderItem.findMany({ where: { orderId: id } });
        for (const { dishId, quantity } of lines) {
          // Un plat à stock illimité (null) n'est pas touché
          await tx.dish.updateMany({
            where: { id: dishId, stock: { not: null } },
            data: { stock: { increment: quantity } },
          });
        }
      }
      return toRecord(await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude }));
    });
  }

  async findById(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    return order && toRecord(order);
  }

  async find(f: OrderFilter) {
    const where = {
      ...(f.userId !== undefined && { userId: f.userId }),
      ...(f.statuses && { status: { in: f.statuses } }),
    };
    const direction = f.newestFirst ? ("desc" as const) : ("asc" as const);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: [{ createdAt: direction }, { id: direction }],
        skip: f.skip,
        take: f.take,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items: items.map(toRecord), total };
  }
}

export class PrismaDishReader implements DishReader {
  constructor(private readonly prisma: PrismaClient) {}

  findByIds(ids: number[]) {
    return this.prisma.dish.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, priceCents: true, available: true },
    });
  }
}

// Pour les tests sans base
export class InMemoryOrderRepository implements OrderRepository {
  private orders: OrderRecord[] = [];
  private nextId = 1;

  // `stocks` : portions restantes par plat (absent ou null = illimité), comme la colonne Dish.stock
  constructor(
    private readonly userName: (id: number) => string = (id) => `Client ${id}`,
    readonly stocks: Map<number, number | null> = new Map(),
  ) {}

  async create(order: NewOrder): Promise<CreateOrderResult> {
    const shortages = order.items.flatMap(({ dishId, quantity }) => {
      const stock = this.stocks.get(dishId) ?? null;
      return stock !== null && stock < quantity ? [{ dishId, available: stock }] : [];
    });
    if (shortages.length > 0) return { shortages };

    for (const { dishId, quantity } of order.items) {
      const stock = this.stocks.get(dishId) ?? null;
      if (stock !== null) this.stocks.set(dishId, stock - quantity);
    }
    const now = new Date();
    const record: OrderRecord = {
      id: this.nextId++,
      status: "RECEIVED",
      note: order.note,
      totalCents: order.totalCents,
      createdAt: now,
      updatedAt: now,
      user: { id: order.userId, name: this.userName(order.userId) },
      items: order.items.map(({ dishId, name, quantity, unitPriceCents }) => ({
        dishId,
        name,
        quantity,
        unitPriceCents,
      })),
    };
    this.orders.push(record);
    return { order: record };
  }

  async updateStatus(id: number, from: OrderStatus, to: OrderStatus, restock: boolean) {
    const order = this.orders.find((o) => o.id === id);
    if (!order || order.status !== from) return null;
    order.status = to;
    order.updatedAt = new Date();
    if (restock) {
      for (const { dishId, quantity } of order.items) {
        const stock = this.stocks.get(dishId) ?? null;
        if (stock !== null) this.stocks.set(dishId, stock + quantity);
      }
    }
    return order;
  }

  async findById(id: number) {
    return this.orders.find((o) => o.id === id) ?? null;
  }

  async find(f: OrderFilter) {
    const sign = f.newestFirst ? -1 : 1;
    const all = this.orders
      .filter((o) => f.userId === undefined || o.user.id === f.userId)
      .filter((o) => !f.statuses || f.statuses.includes(o.status))
      .sort((a, b) => sign * (a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id));
    return { items: all.slice(f.skip, f.skip + f.take), total: all.length };
  }
}

export class InMemoryDishReader implements DishReader {
  constructor(private readonly dishes: DishSnapshot[] = []) {}

  async findByIds(ids: number[]) {
    return this.dishes.filter((d) => ids.includes(d.id));
  }
}
