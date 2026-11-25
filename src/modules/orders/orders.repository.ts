import type { PrismaClient } from "../../generated/prisma/client.js";
import type { DishSnapshot, NewOrder, OrderFilter, OrderRecord } from "./orders.dto.js";

// DAO des commandes
export interface OrderRepository {
  create(order: NewOrder): Promise<OrderRecord>;
  findById(id: number): Promise<OrderRecord | null>;
  find(filter: OrderFilter): Promise<{ items: OrderRecord[]; total: number }>;
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

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // Commande et lignes en une seule écriture
  async create(order: NewOrder) {
    const created = await this.prisma.order.create({
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
    return toRecord(created);
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

  constructor(private readonly userName: (id: number) => string = (id) => `Client ${id}`) {}

  async create(order: NewOrder) {
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
    return record;
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
