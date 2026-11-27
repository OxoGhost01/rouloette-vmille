export type ChargeRequest = { amountCents: number; reference: string; token: string };

// Un refus du prestataire est une réponse normale, pas une panne
export type ChargeResult = { status: "succeeded" } | { status: "declined"; reason: string };

// timeout : délai dépassé ; unavailable : réseau ou 5xx ; invalid : réponse inattendue du prestataire
export type ProviderFailure = "timeout" | "unavailable" | "invalid";

export class PaymentProviderError extends Error {
  constructor(readonly kind: ProviderFailure) {
    super(`Prestataire de paiement : ${kind}`);
    this.name = "PaymentProviderError";
  }
}

// Adapter : le métier ne connaît que cette interface, jamais le protocole du prestataire
export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
