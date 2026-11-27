import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createTestContainer } from "../../src/container.js";
import { hashPassword, type Role } from "../../src/fourni/auth/index.js";
import { InMemoryMenuRepository } from "../../src/modules/menu/menu.repository.js";
import { InMemoryUserRepository } from "../../src/modules/users/user.repository.js";

const env = { DATABASE_URL: "file:./test.db", JWT_SECRET: "test-secret-0123456789" };

let menu: InMemoryMenuRepository;
let app: ReturnType<typeof createApp>;

async function tokenFor(users: InMemoryUserRepository, role: Role) {
  const email = `${role.toLowerCase()}@test.fr`;
  await users.create({ email, name: "Test", role, passwordHash: await hashPassword("Motdepasse1!") });
  const res = await request(app).post("/auth/login").send({ email, password: "Motdepasse1!" });
  return `Bearer ${res.body.token}`;
}

async function boot(overrides: Record<string, string> = {}) {
  const users = new InMemoryUserRepository();
  menu = new InMemoryMenuRepository({
    categories: [{ id: 1, name: "Desserts", position: 1 }],
    dishes: [
      {
        id: 1,
        name: "Brownie",
        description: "",
        priceCents: 450,
        available: true,
        category: { id: 1, name: "Desserts" },
        allergens: [],
      },
    ],
  });
  app = createApp(createTestContainer(loadConfig({ ...env, ...overrides }), { users, menu }));
  return { admin: await tokenFor(users, "ADMIN"), customer: await tokenFor(users, "CUSTOMER") };
}

describe("cache de la carte (HTTP)", () => {
  let tokens: Awaited<ReturnType<typeof boot>>;

  beforeEach(async () => {
    tokens = await boot();
  });

  it("une lecture répétée ne retourne pas à la base", async () => {
    const findDishes = vi.spyOn(menu, "findDishes");
    await request(app).get("/dishes");
    await request(app).get("/dishes");
    expect(findDishes).toHaveBeenCalledTimes(1);
  });

  it("une modification de prix est visible immédiatement, cache chaud", async () => {
    await request(app).get("/dishes");
    await request(app).get("/dishes/1");

    const patch = await request(app).patch("/dishes/1").set("Authorization", tokens.admin).send({ priceCents: 990 });
    expect(patch.status).toBe(200);

    expect((await request(app).get("/dishes")).body.items[0].priceCents).toBe(990);
    expect((await request(app).get("/dishes/1")).body.priceCents).toBe(990);
  });

  it("passer une commande vide le cache, puisque le stock affiché change", async () => {
    await request(app).get("/dishes/1");
    const findDishById = vi.spyOn(menu, "findDishById");

    const order = await request(app)
      .post("/orders")
      .set("Authorization", tokens.customer)
      .send({ items: [{ dishId: 1, quantity: 1 }] });
    expect(order.status).toBe(201);

    await request(app).get("/dishes/1");
    expect(findDishById).toHaveBeenCalledTimes(1);
  });

  it("MENU_CACHE_TTL_MS=0 débranche le cache", async () => {
    await boot({ MENU_CACHE_TTL_MS: "0" });
    const findDishes = vi.spyOn(menu, "findDishes");
    await request(app).get("/dishes");
    await request(app).get("/dishes");
    expect(findDishes).toHaveBeenCalledTimes(2);
  });
});
