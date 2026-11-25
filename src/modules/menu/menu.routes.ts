import { Router } from "express";
import type { MenuController } from "./menu.controller.js";

// Routes publiques de la carte. Les routes admin (POST/PATCH/DELETE /dishes) arrivent au palier 2.
export function menuRoutes(c: MenuController) {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  router.get("/categories", c.listCategories);
  router.get("/allergens", c.listAllergens);
  router.get("/dishes", c.listDishes);
  router.get("/dishes/:id", c.getDish);
  return router;
}
