import { Router } from "express";
import type { HealthController } from "./health.controller.js";

export function healthRoutes(c: HealthController) {
  const router = Router();
  router.get("/health", c.check);
  return router;
}
