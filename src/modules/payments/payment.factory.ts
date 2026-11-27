import type { Config } from "../../config.js";
import { FakePaymentGateway } from "./payment.fake-gateway.js";
import type { PaymentGateway } from "./payment.gateway.js";
import { HttpPaymentGateway } from "./payment.http-gateway.js";

// Factory : la configuration choisit l'implémentation (HTTP pour l'application, factice pour les tests)
export function createPaymentGateway(config: Config): PaymentGateway {
  if (config.PAYMENT_PROVIDER === "fake") return new FakePaymentGateway();
  if (!config.PAYMENT_API_KEY) throw new Error("PAYMENT_API_KEY est obligatoire avec PAYMENT_PROVIDER=http");
  return new HttpPaymentGateway({ baseUrl: config.PAYMENT_URL, apiKey: config.PAYMENT_API_KEY });
}
