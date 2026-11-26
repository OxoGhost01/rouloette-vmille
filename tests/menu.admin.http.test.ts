import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createTestContainer } from "../src/container.js";
import { hashPassword, type Role } from "../src/fourni/auth/index.js";
import { InMemoryMenuRepository } from "../src/modules/menu/menu.repository.js";
import { InMemoryUserRepository } from "../src/modules/users/user.repository.js";

const config = loadConfig({ DATABASE_URL: "file:./test.db", JWT_SECRET: "test-secret-0123456789" });

let app: ReturnType<typeof createApp>;
let admin: string;
let staff: string;
let customer: string;

async function tokenFor(users: InMemoryUserRepository, role: Role) {
  const email = `${role.toLowerCase()}@test.fr`;
  await users.create({ email, name: "Test", role, passwordHash: await hashPassword("Motdepasse1!") });
  const res = await request(app).post("/auth/login").send({ email, password: "Motdepasse1!" });
  return `Bearer ${res.body.token}`;
}

const body = { name: "Tarte citron", priceCents: 450, categoryId: 1 };
const post = (token: string | null, data: object = body) => {
  const req = request(app).post("/dishes");
  return (token ? req.set("Authorization", token) : req).send(data);
};
const patch = (id: number, data: object) => request(app).patch(`/dishes/${id}`).set("Authorization", admin).send(data);
const remove = (id: number) => request(app).delete(`/dishes/${id}`).set("Authorization", admin);

beforeEach(async () => {
  const users = new InMemoryUserRepository();
  const menu = new InMemoryMenuRepository({
    categories: [{ id: 1, name: "Desserts", position: 1 }],
    allergens: [
      { id: 1, code: "gluten", label: "Gluten" },
      { id: 2, code: "oeufs", label: "Oeufs" },
    ],
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
    orderedDishIds: [1],
  });
  app = createApp(createTestContainer(config, { users, menu }));
  admin = await tokenFor(users, "ADMIN");
  staff = await tokenFor(users, "STAFF");
  customer = await tokenFor(users, "CUSTOMER");
});

describe("POST /dishes", () => {
  it("401 sans token, 403 pour un client ou la cuisine", async () => {
    expect((await post(null)).status).toBe(401);
    expect((await post(customer)).body.error.code).toBe("FORBIDDEN");
    expect((await post(staff)).status).toBe(403);
  });

  it("201 avec Location, valeurs par défaut et allergènes reliés", async () => {
    const res = await post(admin, { ...body, allergens: ["gluten", "oeufs"] });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/dishes/${res.body.id}`);
    expect(res.body).toMatchObject({ name: "Tarte citron", description: "", available: true, stock: null });
    expect(res.body.allergens.map((a: { code: string }) => a.code)).toEqual(["gluten", "oeufs"]);
    expect((await request(app).get(`/dishes/${res.body.id}`)).status).toBe(200);
  });

  it("409 nom déjà pris, 422 référence inconnue, 400 champ inconnu ou prix invalide", async () => {
    expect((await post(admin, { ...body, name: "Brownie" })).body.error.code).toBe("CONFLICT");
    expect((await post(admin, { ...body, categoryId: 99 })).body.error.code).toBe("INVALID_REFERENCE");
    expect((await post(admin, { ...body, allergens: ["kryptonite"] })).status).toBe(422);
    expect((await post(admin, { ...body, promo: true })).body.error.code).toBe("VALIDATION_ERROR");
    expect((await post(admin, { ...body, priceCents: 10 })).status).toBe(400);
  });
});

describe("PATCH /dishes/:id", () => {
  it("modifie partiellement sans toucher aux autres champs", async () => {
    const res = await patch(1, { priceCents: 650 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Brownie", priceCents: 650, available: true });
  });

  it("rend un plat indisponible", async () => {
    expect((await patch(1, { available: false })).body.available).toBe(false);
  });

  it("400 sur un corps vide ou un champ inconnu, 404 sur un plat inconnu, 403 pour la cuisine", async () => {
    expect((await patch(1, {})).body.error.code).toBe("VALIDATION_ERROR");
    expect((await patch(1, { id: 5 })).status).toBe(400);
    expect((await patch(99, { priceCents: 600 })).status).toBe(404);
    const res = await request(app).patch("/dishes/1").set("Authorization", staff).send({ priceCents: 600 });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /dishes/:id", () => {
  it("409 pour un plat déjà commandé, 204 puis 404 pour un plat jamais commandé", async () => {
    expect((await remove(1)).body.error.code).toBe("CONFLICT");

    const created = await post(admin);
    expect((await remove(created.body.id)).status).toBe(204);
    expect((await request(app).get(`/dishes/${created.body.id}`)).status).toBe(404);
    expect((await remove(created.body.id)).status).toBe(404);
  });

  it("exige le rôle ADMIN", async () => {
    expect((await request(app).delete("/dishes/1")).status).toBe(401);
    expect((await request(app).delete("/dishes/1").set("Authorization", customer)).status).toBe(403);
  });
});
