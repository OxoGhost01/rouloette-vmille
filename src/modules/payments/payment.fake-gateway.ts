import type { ChargeRequest, ChargeResult, PaymentGateway } from "./payment.gateway.js";

// Prestataire factice pour les tests : accepte tout sauf tok_declined, et garde la trace des appels
export class FakePaymentGateway implements PaymentGateway {
  readonly charges: ChargeRequest[] = [];

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    this.charges.push(request);
    return request.token === "tok_declined" ? { status: "declined", reason: "card_declined" } : { status: "succeeded" };
  }
}
