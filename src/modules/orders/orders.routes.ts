import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { OrderController } from "./orders.controller.js";

// Toutes les routes de commandes exigent une connexion ; la propriété est vérifiée dans le service.
export function orderRoutes(c: OrderController, auth: Auth) {
  const router = Router();
  router.use(auth.requireAuth);
  router.post("/", c.place);
  router.get("/", c.list);
  router.get("/:id", c.get);
  return router;
}
