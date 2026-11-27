import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import type { EventsController } from "./events.controller.js";

export function eventRoutes(c: EventsController, auth: Auth) {
  const router = Router();
  router.get("/", auth.requireAuth, c.stream);
  return router;
}
