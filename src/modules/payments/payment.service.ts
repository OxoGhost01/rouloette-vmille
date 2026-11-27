import type { AuthUser } from "../../fourni/auth/index.js";
import type { EventBus } from "../../shared/event-bus.js";
import { HttpError } from "../../shared/http-error.js";
import type { OrderEvent } from "../orders/orders.model.js";
import type { OrderRepository } from "../orders/orders.repository.js";
import type { OrderService } from "../orders/orders.service.js";
import { PaymentProviderError, type PaymentGateway } from "./payment.gateway.js";

export class PaymentService {
  // Commandes en cours de paiement : évite qu'un double clic débite deux fois
  private readonly inFlight = new Set<number>();

  constructor(
    private readonly orders: Pick<OrderService, "getFor">,
    private readonly orderStore: Pick<OrderRepository, "markPaid">,
    private readonly gateway: PaymentGateway,
    private readonly events: Pick<EventBus<OrderEvent>, "publish">,
  ) {}

  async pay(user: AuthUser, orderId: number, token: string) {
    if (user.role !== "CUSTOMER") throw new HttpError(403, "FORBIDDEN", "Seul le client peut payer sa commande");
    const order = await this.orders.getFor(user, orderId); // 404 si absente ou d'un autre client

    // Refusé d'avance : le prestataire n'est pas appelé
    if (order.paymentStatus === "PAID") throw conflict("Commande déjà payée");
    if (order.status === "CANCELLED") throw conflict("Commande annulée");
    if (this.inFlight.has(orderId)) throw conflict("Paiement déjà en cours");

    this.inFlight.add(orderId);
    try {
      const result = await this.charge(order.totalCents, orderId, token);
      if (result.status === "declined") {
        throw new HttpError(402, "PAYMENT_DECLINED", "Paiement refusé", { reason: result.reason });
      }
      const paid = await this.orderStore.markPaid(orderId);
      if (!paid) throw conflict("Commande déjà payée ou annulée");
      this.events.publish({ type: "order.updated", order: paid });
      return paid;
    } finally {
      this.inFlight.delete(orderId);
    }
  }

  private async charge(amountCents: number, orderId: number, token: string) {
    try {
      return await this.gateway.charge({ amountCents, reference: `order-${orderId}`, token });
    } catch (error) {
      if (!(error instanceof PaymentProviderError)) throw error;
      if (error.kind === "timeout") {
        throw new HttpError(504, "PAYMENT_PROVIDER_TIMEOUT", "Le prestataire de paiement ne répond pas");
      }
      throw new HttpError(502, "PAYMENT_PROVIDER_ERROR", "Le prestataire de paiement est en erreur");
    }
  }
}

const conflict = (message: string) => new HttpError(409, "CONFLICT", message);
