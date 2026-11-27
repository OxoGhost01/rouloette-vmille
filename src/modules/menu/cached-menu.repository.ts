import type { DishFilter, DishPatch, NewDish } from "./menu.model.js";
import type { MenuRepository } from "./menu.repository.js";

// Decorator : même interface que le repository enveloppé, avec un cache en plus.
// Ni PrismaMenuRepository ni MenuService ne savent qu'il existe.
export class CachedMenuRepository implements MenuRepository {
  private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();
  // Incrémentée à chaque invalidation : une lecture commencée avant ne doit pas remplir le cache après
  private version = 0;

  constructor(
    private readonly inner: MenuRepository,
    private readonly ttlMs = 30_000,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 200,
  ) {}

  invalidate() {
    this.entries.clear();
    this.version++;
  }

  private async remember<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value as T;

    const version = this.version;
    const value = await load();
    if (version === this.version) {
      // Les filtres libres (recherche `q`) donnent un nombre de clés illimité : on borne la taille
      if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
      this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    }
    return value;
  }

  private async afterWrite<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } finally {
      this.invalidate();
    }
  }

  listCategories() {
    return this.inner.listCategories();
  }

  listAllergens() {
    return this.inner.listAllergens();
  }

  findDishes(filter: DishFilter) {
    return this.remember(`list:${JSON.stringify(filter)}`, () => this.inner.findDishes(filter));
  }

  findDishById(id: number) {
    return this.remember(`dish:${id}`, () => this.inner.findDishById(id));
  }

  // Une commande lit toujours le prix et la disponibilité du moment, jamais ceux du cache
  findDishesByIds(ids: number[]) {
    return this.inner.findDishesByIds(ids);
  }

  createDish(data: NewDish) {
    return this.afterWrite(() => this.inner.createDish(data));
  }

  updateDish(id: number, patch: DishPatch) {
    return this.afterWrite(() => this.inner.updateDish(id, patch));
  }

  setDishImage(id: number, imageUrl: string) {
    return this.afterWrite(() => this.inner.setDishImage(id, imageUrl));
  }

  deleteDish(id: number) {
    return this.afterWrite(() => this.inner.deleteDish(id));
  }
}
