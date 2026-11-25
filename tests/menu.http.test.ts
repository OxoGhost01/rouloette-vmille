import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createTestContainer } from "../src/container.js";
import { InMemoryMenuRepository } from "../src/modules/menu/menu.repository.js";

const burgers = { id: 1, name: "Burgers", position: 1 };
const boissons = { id: 2, name: "Boissons", position: 2 };
const gluten = { code: "gluten", label: "Gluten" };
const lait = { code: "lait", label: "Lait" };

const dish = (id: number, name: string, category: typeof burgers, allergens = [] as (typeof gluten)[], available = true) => ({
  id,
  name,
  description: "",
  priceCents: 1000,
  available,
  category: { id: category.id, name: category.name },
  allergens,
});

const menu = new InMemoryMenuRepository({
  categories: [boissons, burgers],
  allergens: [
    { id: 2, ...lait },
    { id: 1, ...gluten },
  ],
  dishes: [
    dish(1, "Classic", burgers, [gluten, lait]),
    dish(2, "Veggie", burgers, [gluten], false),
    dish(3, "Limonade", boissons),
  ],
});

const config = loadConfig({ DATABASE_URL: "file:./test.db", JWT_SECRET: "test-secret-0123456789" });
const app = createApp(createTestContainer(config, { menu }));

describe("carte (HTTP)", () => {
  it("GET /dishes?allergenFree=lait exclut les plats contenant du lait", async () => {
    const res = await request(app).get("/dishes?allergenFree=lait");
    expect(res.body.items.map((d: { name: string }) => d.name)).toEqual(["Veggie", "Limonade"]);
    const both = await request(app).get("/dishes?allergenFree=gluten,lait");
    expect(both.body.items.map((d: { name: string }) => d.name)).toEqual(["Limonade"]);
  });
});
