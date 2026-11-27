import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { PaymentController } from "./payment.controller.js";

// Montée sous /orders ; le rôle (client uniquement) et la propriété sont vérifiés dans le service
export function paymentRoutes(c: PaymentController, auth: Auth) {
  const router = Router();
  router.post("/:id/payment", auth.requireAuth, c.pay);
  return router;
}
