import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import { uploadImage } from "../../shared/upload.js";
import type { MenuController } from "./menu.controller.js";

// Lecture publique de la carte ; écriture réservée à l'administratrice.
export function menuRoutes(c: MenuController, auth: Auth) {
  const router = Router();
  const admin = [auth.requireAuth, auth.requireRole("ADMIN")];
  router.get("/categories", c.listCategories);
  router.get("/allergens", c.listAllergens);
  router.get("/dishes", c.listDishes);
  router.get("/dishes/:id", c.getDish);
  router.post("/dishes", ...admin, c.createDish);
  router.patch("/dishes/:id", ...admin, c.updateDish);
  router.put("/dishes/:id/image", ...admin, uploadImage, c.setDishImage);
  router.delete("/dishes/:id", ...admin, c.deleteDish);
  return router;
}
