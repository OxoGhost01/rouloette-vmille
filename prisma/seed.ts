import { readFileSync } from "node:fs";
import { loadConfig } from "../src/config.js";
import { hashPassword } from "../src/fourni/auth/index.js";
import { getPrisma } from "../src/shared/prisma.js";

type Menu = {
  categories: { name: string; position: number }[];
  allergens: { code: string; label: string }[];
  dishes: {
    name: string;
    description: string;
    priceCents: number;
    category: string;
    allergens: string[];
    available: boolean;
    stock: number | null; // null = illimité
  }[];
  users: { email: string; name: string; password: string; role: "CUSTOMER" | "STAFF" | "ADMIN" }[];
};

const config = loadConfig();
const prisma = getPrisma(config.DATABASE_URL);
const menu: Menu = JSON.parse(readFileSync(new URL("../data/menu.json", import.meta.url), "utf-8"));

// Vide la base puis charge data/menu.json
await prisma.orderItem.deleteMany();
await prisma.order.deleteMany();
await prisma.dish.deleteMany();
await prisma.allergen.deleteMany();
await prisma.category.deleteMany();
await prisma.user.deleteMany();

await prisma.category.createMany({ data: menu.categories });
await prisma.allergen.createMany({ data: menu.allergens });

for (const d of menu.dishes) {
  await prisma.dish.create({
    data: {
      name: d.name,
      description: d.description,
      priceCents: d.priceCents,
      available: d.available,
      stock: d.stock,
      category: { connect: { name: d.category } },
      allergens: { connect: d.allergens.map((code) => ({ code })) },
    },
  });
}

for (const u of menu.users) {
  await prisma.user.create({
    data: { email: u.email, name: u.name, role: u.role, passwordHash: await hashPassword(u.password) },
  });
}

console.log(
  `Seed terminé : ${menu.categories.length} catégories, ${menu.allergens.length} allergènes, ` +
    `${menu.dishes.length} plats, ${menu.users.length} comptes.`,
);
await prisma.$disconnect();
