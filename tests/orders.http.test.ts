import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createTestContainer } from "../src/container.js";
import { menuWith } from "./support.js";

const config = loadConfig({ DATABASE_URL: "file:./test.db", JWT_SECRET: "test-secret-0123456789" });
const dishes = [
  { id: 1, name: "Le Classique", priceCents: 1150, available: true },
  { id: 2, name: "Frites", priceCents: 400, available: true },
  { id: 3, name: "Épuisé", priceCents: 900, available: false },
];

let app: ReturnType<typeof createApp>;

async function signup(email: string) {
  await request(app).post("/auth/register").send({ email, name: "Test", password: "motdepasse1" });
  const login = await request(app).post("/auth/login").send({ email, password: "motdepasse1" });
  return `Bearer ${login.body.token}`;
}

beforeEach(() => {
  app = createApp(createTestContainer(config, { menu: menuWith(dishes) }));
});

describe("POST /orders", () => {
  it("exige une connexion (401)", async () => {
    const res = await request(app).post("/orders").send({ items: [{ dishId: 1, quantity: 1 }] });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("crée la commande : 201, Location, total calculé par le serveur", async () => {
    const token = await signup("a@test.fr");
    const res = await request(app)
      .post("/orders")
      .set("Authorization", token)
      .send({
        items: [
          { dishId: 1, quantity: 2 },
          { dishId: 2, quantity: 1 },
        ],
        note: "sans oignons",
      });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/orders/${res.body.id}`);
    expect(res.body).toMatchObject({ status: "RECEIVED", note: "sans oignons", totalCents: 2700 });
    expect(res.body.items[0]).toMatchObject({ dishId: 1, unitPriceCents: 1150, lineTotalCents: 2300 });
  });
});
