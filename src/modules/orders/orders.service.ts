import type { AuthUser } from "../../fourni/auth/index.js";
import { EventBus } from "../../shared/event-bus.js";
import { HttpError } from "../../shared/http-error.js";
import { pageWindow, toPage } from "../../shared/pagination.js";
import type { MenuRepository } from "../menu/menu.repository.js";
import { canTransition, customerCanCancel } from "./order-status.js";
import type { OrderEvent, OrderLine, OrderSearch, OrderStatus, PlaceOrder } from "./orders.model.js";
import type { OrderRepository } from "./orders.repository.js";

// Aucune notion HTTP (req / res) ici : le service ne reçoit que des données.
export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly dishes: Pick<MenuRepository, "findDishesByIds">,
    private readonly events: Pick<EventBus<OrderEvent>, "publish"> = new EventBus<OrderEvent>(),
  ) {}

  async place(user: AuthUser, input: PlaceOrder) {
    const found = new Map((await this.dishes.findDishesByIds(input.items.map((i) => i.dishId))).map((d) => [d.id, d]));

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

    const result = await this.orders.create({ userId: user.id, note: input.note ?? null, totalCents, items });
    if ("shortages" in result) {
      throw new HttpError(409, "OUT_OF_STOCK", "Stock insuffisant", result.shortages);
    }
    this.events.publish({ type: "order.created", order: result.order });
    return result.order;
  }

  async list(user: AuthUser, search: OrderSearch) {
    const { items, total } = await this.orders.find({
      userId: isCustomer(user) ? user.id : undefined,
      statuses: search.statuses,
      newestFirst: search.newestFirst,
      ...pageWindow(search),
    });
    return toPage(items, total, search);
  }

  // Un client ne voit que ses commandes : celle d'un autre répond 404, pas 403
  async getFor(user: AuthUser, id: number) {
    const order = await this.orders.findById(id);
    if (!order || (isCustomer(user) && order.user.id !== user.id)) {
      throw new HttpError(404, "NOT_FOUND", "Commande introuvable");
    }
    return order;
  }

  // Cuisine et admin font avancer ou annulent ; un client annule seulement sa commande, tant qu'elle est RECEIVED
  async changeStatus(user: AuthUser, id: number, status: OrderStatus) {
    const order = await this.getFor(user, id); // 404 si absente ou d'un autre client

    if (isCustomer(user)) {
      if (status !== "CANCELLED") throw new HttpError(403, "FORBIDDEN", "Un client ne peut qu'annuler sa commande");
      if (!customerCanCancel(order.status)) throw invalidTransition(order.status, status);
    } else if (!canTransition(order.status, status)) {
      throw invalidTransition(order.status, status);
    }

    // Annuler remet les portions en stock, dans la même transaction que le changement de statut
    const updated = await this.orders.updateStatus(id, order.status, status, status === "CANCELLED");
    if (!updated) throw invalidTransition(order.status, status); // modifiée entre-temps par quelqu'un d'autre
    this.events.publish({ type: "order.updated", order: updated });
    return updated;
  }
}

const isCustomer = (user: AuthUser) => user.role === "CUSTOMER";

function invalidTransition(from: OrderStatus, to: OrderStatus) {
  return new HttpError(409, "INVALID_TRANSITION", `Passage de ${from} à ${to} impossible`);
}
