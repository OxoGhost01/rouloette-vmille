import type { DishSnapshot } from "../src/modules/menu/menu.dto.js";
import { InMemoryMenuRepository } from "../src/modules/menu/menu.repository.js";

// Carte en mémoire à partir de plats minimaux (id, nom, prix, disponibilité)
export const menuWith = (dishes: DishSnapshot[] = []) =>
  new InMemoryMenuRepository({
    dishes: dishes.map((d) => ({ ...d, description: "", category: { id: 1, name: "Test" }, allergens: [] })),
  });
