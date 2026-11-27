import { describe, expect, it, vi } from "vitest";
import { CachedMenuRepository } from "../../src/modules/menu/cached-menu.repository.js";
import type { DishFilter, DishRecord } from "../../src/modules/menu/menu.model.js";
import { InMemoryMenuRepository } from "../../src/modules/menu/menu.repository.js";

const dish = (id: number, name: string, priceCents = 500): DishRecord => ({
  id,
  name,
  description: "",
  priceCents,
  available: true,
  category: { id: 1, name: "Desserts" },
  allergens: [],
});

const all: DishFilter = { skip: 0, take: 20 };

function setup(ttlMs = 30_000) {
  const inner = new InMemoryMenuRepository({
    categories: [{ id: 1, name: "Desserts", position: 1 }],
    dishes: [dish(1, "Brownie"), dish(2, "Tarte")],
  });
  let time = 0;
  const cached = new CachedMenuRepository(inner, ttlMs, () => time);
  return { inner, cached, advance: (ms: number) => (time += ms) };
}

describe("CachedMenuRepository (Decorator)", () => {
  it("sert la deuxième lecture identique depuis le cache, une clé par combinaison de filtres", async () => {
    const { inner, cached } = setup();
    const findDishes = vi.spyOn(inner, "findDishes");

    await cached.findDishes(all);
    await cached.findDishes(all);
    expect(findDishes).toHaveBeenCalledTimes(1);

    await cached.findDishes({ ...all, q: "tarte" });
    expect(findDishes).toHaveBeenCalledTimes(2);
  });

  it("met aussi en cache un plat seul, y compris son absence", async () => {
    const { inner, cached } = setup();
    const findDishById = vi.spyOn(inner, "findDishById");

    await cached.findDishById(1);
    await cached.findDishById(1);
    await cached.findDishById(99);
    await cached.findDishById(99);

    expect(findDishById).toHaveBeenCalledTimes(2);
  });

  it("recharge une fois la durée de vie dépassée", async () => {
    const { inner, cached, advance } = setup(30_000);
    const findDishes = vi.spyOn(inner, "findDishes");

    await cached.findDishes(all);
    advance(29_999);
    await cached.findDishes(all);
    expect(findDishes).toHaveBeenCalledTimes(1);

    advance(2);
    await cached.findDishes(all);
    expect(findDishes).toHaveBeenCalledTimes(2);
  });

  it("une modification vide le cache : la lecture suivante voit le nouveau prix", async () => {
    const { cached } = setup();
    await cached.findDishes(all);
    await cached.findDishById(1);

    await cached.updateDish(1, { priceCents: 990 });

    expect((await cached.findDishById(1))?.priceCents).toBe(990);
    expect((await cached.findDishes(all)).items.find((d) => d.id === 1)?.priceCents).toBe(990);
  });

  it("création, photo et suppression vident aussi le cache", async () => {
    const { cached } = setup();

    await cached.findDishes(all);
    await cached.createDish({
      name: "Flan",
      description: "",
      priceCents: 400,
      categoryId: 1,
      allergens: [],
      available: true,
      stock: null,
    });
    expect((await cached.findDishes(all)).total).toBe(3);

    await cached.setDishImage(1, "/uploads/dishes/a.png");
    expect((await cached.findDishById(1))?.imageUrl).toBe("/uploads/dishes/a.png");

    await cached.deleteDish(2);
    expect((await cached.findDishes(all)).total).toBe(2);
  });

  it("invalidate() vide le cache (appelé quand une commande change le stock)", async () => {
    const { inner, cached } = setup();
    const findDishById = vi.spyOn(inner, "findDishById");

    await cached.findDishById(1);
    cached.invalidate();
    await cached.findDishById(1);

    expect(findDishById).toHaveBeenCalledTimes(2);
  });

  it("ne met jamais en cache la lecture faite pour passer commande", async () => {
    const { inner, cached } = setup();
    const findDishesByIds = vi.spyOn(inner, "findDishesByIds");

    await cached.findDishesByIds([1]);
    await cached.findDishesByIds([1]);

    expect(findDishesByIds).toHaveBeenCalledTimes(2);
  });

  it("une lecture commencée avant une invalidation ne remplit pas le cache avec des données périmées", async () => {
    const { inner, cached } = setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const original = inner.findDishById.bind(inner);
    vi.spyOn(inner, "findDishById").mockImplementationOnce(async (id) => {
      const stale = await original(id);
      await gate;
      return stale;
    });

    const slowRead = cached.findDishById(1);
    await cached.updateDish(1, { priceCents: 990 });
    release();
    await slowRead;

    expect((await cached.findDishById(1))?.priceCents).toBe(990);
  });

  it("borne le nombre d'entrées : des recherches libres ne font pas grossir la mémoire sans limite", async () => {
    const inner = new InMemoryMenuRepository({ dishes: [dish(1, "Brownie")] });
    const cached = new CachedMenuRepository(inner, 30_000, () => 0, 3);
    const findDishes = vi.spyOn(inner, "findDishes");

    for (const q of ["a", "b", "c", "d"]) await cached.findDishes({ ...all, q });
    await cached.findDishes({ ...all, q: "a" });

    expect(findDishes).toHaveBeenCalledTimes(5);
  });
});
