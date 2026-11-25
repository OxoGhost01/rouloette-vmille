import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { OrderController } from "./orders.controller.js";

// Toutes les routes de commandes exigent une connexion ; la propriété et les règles de statut sont vérifiées dans le service
// (tous les rôles peuvent appeler PATCH /:id/status, mais pas pour faire la même chose : pas de requireRole ici).
export function orderRoutes(c: OrderController, auth: Auth) {
  const router = Router();
  router.use(auth.requireAuth);
  router.post("/", c.place);
  router.get("/", c.list);
  router.get("/:id", c.get);
  router.patch("/:id/status", c.changeStatus);
  return router;
}
