import { Router } from "express";
import type { Auth } from "../../fourni/auth/index.js";
import { revalidate } from "../../shared/revalidate.js";
import { uploadImage } from "../../shared/upload.js";
import type { MenuController } from "./menu.controller.js";

// Lecture publique de la carte ; écriture réservée à l'administratrice.
export function menuRoutes(c: MenuController, auth: Auth) {
  const router = Router();
  const admin = [auth.requireAuth, auth.requireRole("ADMIN")];
  router.get("/categories", revalidate, c.listCategories);
  router.get("/allergens", revalidate, c.listAllergens);
  router.get("/dishes", revalidate, c.listDishes);
  router.get("/dishes/:id", revalidate, c.getDish);
  router.post("/dishes", ...admin, c.createDish);
  router.patch("/dishes/:id", ...admin, c.updateDish);
  router.put("/dishes/:id/image", ...admin, uploadImage, c.setDishImage);
  router.delete("/dishes/:id", ...admin, c.deleteDish);
  return router;
}
