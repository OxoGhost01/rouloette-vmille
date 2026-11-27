import { randomUUID } from "node:crypto";
import { HttpError } from "../../shared/http-error.js";
import { pageWindow, toPage } from "../../shared/pagination.js";
import type { DishImageStorage } from "./dish-image.storage.js";
import { detectImageExtension } from "./image-type.js";
import type { DishImageUpload, DishInput, DishPatch, DishSearch } from "./menu.model.js";
import type { MenuRepository } from "./menu.repository.js";

// Aucune notion HTTP (req / res) ici : le service ne reçoit que des données.
export class MenuService {
  constructor(
    private readonly menu: MenuRepository,
    private readonly images: DishImageStorage,
  ) {}

  listCategories() {
    return this.menu.listCategories();
  }

  listAllergens() {
    return this.menu.listAllergens();
  }

  async listDishes(search: DishSearch) {
    const { items, total } = await this.menu.findDishes({
      categoryId: search.category,
      available: search.available,
      allergenFreeCodes: search.allergenFree,
      q: search.q,
      ...pageWindow(search),
    });
    return toPage(items, total, search);
  }

  async getDish(id: number) {
    const dish = await this.menu.findDishById(id);
    if (!dish) throw dishNotFound();
    return dish;
  }

  async createDish(input: DishInput) {
    await this.assertReferences(input.categoryId, input.allergens);
    const result = await this.menu.createDish({
      name: input.name,
      priceCents: input.priceCents,
      categoryId: input.categoryId,
      description: input.description ?? "",
      allergens: input.allergens ?? [],
      available: input.available ?? true,
      stock: input.stock ?? null,
    });
    if (result.status === "ok") return result.dish;
    throw nameTaken();
  }

  async updateDish(id: number, patch: DishPatch) {
    await this.assertReferences(patch.categoryId, patch.allergens);
    const result = await this.menu.updateDish(id, patch);
    if (result.status === "ok") return result.dish;
    throw result.status === "not_found" ? dishNotFound() : nameTaken();
  }

  // Remplace la photo d'un plat : le contenu est vérifié, le nom de fichier est choisi par le serveur
  async replaceDishImage(id: number, upload: DishImageUpload) {
    const dish = await this.getDish(id);

    const extension = await detectImageExtension(upload.buffer);
    if (!extension) {
      throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Le fichier doit être une image PNG, JPEG ou WebP");
    }

    const url = await this.images.save(`${randomUUID()}.${extension}`, upload.buffer);
    const result = await this.menu.setDishImage(id, url);
    if (result.status !== "ok") {
      await this.images.remove(url); // le plat a disparu entre-temps : pas de fichier orphelin
      throw dishNotFound();
    }

    // Une ancienne photo impossible à supprimer reste un fichier orphelin inoffensif : elle ne doit pas faire échouer l'envoi
    if (dish.imageUrl) await this.images.remove(dish.imageUrl).catch(() => {});
    return result.dish;
  }

  async deleteDish(id: number) {
    const result = await this.menu.deleteDish(id);
    if (result === "not_found") throw dishNotFound();
    if (result === "ordered") {
      throw new HttpError(409, "CONFLICT", "Ce plat a déjà été commandé : rendez-le indisponible plutôt");
    }
  }

  private async assertReferences(categoryId: number | undefined, allergenCodes: string[] | undefined) {
    if (categoryId !== undefined && !(await this.menu.listCategories()).some((c) => c.id === categoryId)) {
      throw new HttpError(422, "INVALID_REFERENCE", "Catégorie inconnue", [{ field: "categoryId", value: categoryId }]);
    }
    if (allergenCodes?.length) {
      const known = new Set((await this.menu.listAllergens()).map((a) => a.code));
      const unknown = allergenCodes.filter((code) => !known.has(code));
      if (unknown.length > 0) {
        throw new HttpError(422, "INVALID_REFERENCE", "Allergène inconnu", unknown.map((value) => ({ field: "allergens", value })));
      }
    }
  }
}

const dishNotFound = () => new HttpError(404, "NOT_FOUND", "Plat introuvable");
const nameTaken = () => new HttpError(409, "CONFLICT", "Un plat porte déjà ce nom");
