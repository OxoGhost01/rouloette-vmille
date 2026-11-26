import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createTestContainer } from "../../src/container.js";
import { hashPassword } from "../../src/fourni/auth/index.js";
import { InMemoryOrderRepository } from "../../src/modules/orders/orders.repository.js";
import { InMemoryUserRepository } from "../../src/modules/users/user.repository.js";
import { menuWith } from "../support/menu.js";

const config = loadConfig({ DATABASE_URL: "file:./test.db", JWT_SECRET: "test-secret-0123456789" });
const dishes = [
  { id: 1, name: "Frites", priceCents: 400, available: true },
  { id: 2, name: "Brownie", priceCents: 500, available: true },
];

let app: ReturnType<typeof createApp>;
let stocks: Map<number, number | null>;

async function login(email: string, password: string) {
  const res = await request(app).post("/auth/login").send({ email, password });
  return `Bearer ${res.body.token}`;
}

async function signup(email: string) {
  await request(app).post("/auth/register").send({ email, name: "Test", password: "motdepasse1" });
  return login(email, "motdepasse1");
}

const order = (token: string, items = [{ dishId: 1, quantity: 1 }]) =>
  request(app).post("/orders").set("Authorization", token).send({ items });

const setStatus = (token: string, id: number, status: string) =>
  request(app).patch(`/orders/${id}/status`).set("Authorization", token).send({ status });

beforeEach(async () => {
  stocks = new Map([[2, 3]]); // Brownie : 3 portions ; Frites : illimité
  const users = new InMemoryUserRepository();
  await users.create({
    email: "cuisine@test.fr",
    name: "Cuisine",
    role: "STAFF",
    passwordHash: await hashPassword("Cuisine123!"),
  });
  app = createApp(
    createTestContainer(config, {
      users,
      orders: new InMemoryOrderRepository(undefined, stocks),
      menu: menuWith(dishes),
    }),
  );
});

describe("PATCH /orders/:id/status", () => {
  it("exige une connexion (401)", async () => {
    const res = await request(app).patch("/orders/1/status").send({ status: "PREPARING" });
    expect(res.status).toBe(401);
  });

  it("la cuisine fait avancer la commande puis 409 INVALID_TRANSITION si elle saute une étape", async () => {
    const staff = await login("cuisine@test.fr", "Cuisine123!");
    const { body } = await order(await signup("a@test.fr"));

    expect((await setStatus(staff, body.id, "READY")).body.error.code).toBe("INVALID_TRANSITION");
    for (const status of ["PREPARING", "READY", "PICKED_UP"]) {
      const res = await setStatus(staff, body.id, status);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
    expect((await setStatus(staff, body.id, "CANCELLED")).status).toBe(409);
  });

  it("refuse un statut inconnu ou un champ en trop (400 VALIDATION_ERROR)", async () => {
    const staff = await login("cuisine@test.fr", "Cuisine123!");
    const { body } = await order(await signup("a@test.fr"));
    expect((await setStatus(staff, body.id, "EN_COURS")).body.error.code).toBe("VALIDATION_ERROR");
    const extra = await request(app)
      .patch(`/orders/${body.id}/status`)
      .set("Authorization", staff)
      .send({ status: "PREPARING", note: "x" });
    expect(extra.status).toBe(400);
  });

  it("404 sur une commande inconnue", async () => {
    const staff = await login("cuisine@test.fr", "Cuisine123!");
    expect((await setStatus(staff, 999, "PREPARING")).status).toBe(404);
  });

  it("un client annule sa commande, mais ne peut rien faire d'autre (403) ni toucher celle d'un autre (404)", async () => {
    const alice = await signup("a@test.fr");
    const bob = await signup("b@test.fr");
    const { body } = await order(alice);

    expect((await setStatus(alice, body.id, "PREPARING")).status).toBe(403);
    expect((await setStatus(bob, body.id, "CANCELLED")).status).toBe(404);
    const cancelled = await setStatus(alice, body.id, "CANCELLED");
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");
  });
});

describe("stock", () => {
  it("commander décrémente le stock, trop demander → 409 OUT_OF_STOCK avec details", async () => {
    const token = await signup("a@test.fr");
    expect((await order(token, [{ dishId: 2, quantity: 2 }])).status).toBe(201);
    expect(stocks.get(2)).toBe(1);

    const res = await order(token, [{ dishId: 2, quantity: 2 }]);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "OUT_OF_STOCK", details: [{ dishId: 2, available: 1 }] });
  });

  it("tout ou rien : la commande refusée ne consomme pas le stock du plat disponible", async () => {
    stocks.set(1, 10);
    const token = await signup("a@test.fr");
    const res = await order(token, [
      { dishId: 1, quantity: 2 },
      { dishId: 2, quantity: 5 },
    ]);
    expect(res.status).toBe(409);
    expect(stocks.get(1)).toBe(10);
  });

  it("une annulation par la cuisine remet les portions en stock", async () => {
    const staff = await login("cuisine@test.fr", "Cuisine123!");
    const { body } = await order(await signup("a@test.fr"), [{ dishId: 2, quantity: 3 }]);
    expect(stocks.get(2)).toBe(0);
    expect((await setStatus(staff, body.id, "CANCELLED")).status).toBe(200);
    expect(stocks.get(2)).toBe(3);
  });
});
