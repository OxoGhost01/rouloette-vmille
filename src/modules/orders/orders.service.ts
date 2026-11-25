import type { AuthUser } from "../../fourni/auth/index.js";
import { HttpError } from "../../shared/errors.js";
import type { ListOrdersQuery, OrderLine, PlaceOrderInput } from "./orders.dto.js";
import type { DishReader, OrderRepository } from "./orders.repository.js";

// Aucune notion HTTP (req / res) ici : le service ne reçoit que des données.
export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly dishes: DishReader,
  ) {}

  async place(user: AuthUser, input: PlaceOrderInput) {
    const found = new Map((await this.dishes.findByIds(input.items.map((i) => i.dishId))).map((d) => [d.id, d]));

    // Tous les plats refusés sont signalés d'un coup
    const refused = input.items.flatMap(({ dishId }) => {
      const dish = found.get(dishId);
      if (!dish) return [{ dishId, reason: "NOT_FOUND" }];
      return dish.available ? [] : [{ dishId, reason: "UNAVAILABLE" }];
    });
    if (refused.length > 0) {
      throw new HttpError(422, "DISH_UNAVAILABLE", "Certains plats ne sont pas disponibles", refused);
    }

    // Les prix viennent de la base, jamais du client
    const items: OrderLine[] = input.items.map(({ dishId, quantity }) => {
      const dish = found.get(dishId)!;
      return { dishId, name: dish.name, quantity, unitPriceCents: dish.priceCents };
    });
    const totalCents = items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);

    return this.orders.create({ userId: user.id, note: input.note ?? null, totalCents, items });
  }

  async list(user: AuthUser, query: ListOrdersQuery) {
    const { items, total } = await this.orders.find({
      userId: user.role === "CUSTOMER" ? user.id : undefined,
      statuses: query.status,
      newestFirst: query.sort === "-createdAt",
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  // Un client ne voit que ses commandes : celle d'un autre répond 404, pas 403
  async getFor(user: AuthUser, id: number) {
    const order = await this.orders.findById(id);
    if (!order || (user.role === "CUSTOMER" && order.user.id !== user.id)) {
      throw new HttpError(404, "NOT_FOUND", "Commande introuvable");
    }
    return order;
  }
}
