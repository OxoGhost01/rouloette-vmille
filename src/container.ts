import type { Router } from "express";
import type { Config } from "./config.js";
import { createAuth } from "./fourni/auth/index.js";
import { OrderController } from "./modules/orders/orders.controller.js";
import {
  InMemoryDishReader,
  InMemoryOrderRepository,
  PrismaDishReader,
  PrismaOrderRepository,
  type DishReader,
  type OrderRepository,
} from "./modules/orders/orders.repository.js";
import { orderRoutes } from "./modules/orders/orders.routes.js";
import { OrderService } from "./modules/orders/orders.service.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import { InMemoryMenuRepository, PrismaMenuRepository, type MenuRepository } from "./modules/menu/menu.repository.js";
import { menuRoutes } from "./modules/menu/menu.routes.js";
import { MenuService } from "./modules/menu/menu.service.js";
import { InMemoryUserRepository, PrismaUserRepository, type UserRepository } from "./modules/users/user.repository.js";
import { getPrisma } from "./shared/prisma.js";

// Composition root : le seul endroit qui assemble les objets.
// Pour brancher un module : construire repository -> service -> controller -> router,
// puis ajouter son routeur dans `routes`.
export type Overrides = { users?: UserRepository; menu?: MenuRepository; orders?: OrderRepository; orderDishes?: DishReader };

export function createContainer(config: Config, overrides: Overrides = {}) {
  const users = overrides.users ?? new PrismaUserRepository(getPrisma(config.DATABASE_URL));
  const menu = overrides.menu ?? new PrismaMenuRepository(getPrisma(config.DATABASE_URL));

  const orders = overrides.orders ?? new PrismaOrderRepository(getPrisma(config.DATABASE_URL));
  const orderDishes = overrides.orderDishes ?? new PrismaDishReader(getPrisma(config.DATABASE_URL));

  const auth = createAuth({ users, jwtSecret: config.JWT_SECRET, jwtExpiresIn: config.JWT_EXPIRES_IN });

  const routes: Array<[path: string, router: Router]> = [];
  routes.push(["/", menuRoutes(new MenuController(new MenuService(menu)), auth)]);

  routes.push(["/orders", orderRoutes(new OrderController(new OrderService(orders, orderDishes)), auth)]);

  return { config, auth, routes };
}

export type Container = ReturnType<typeof createContainer>;

// Container sans base de données, pour les tests Supertest
export function createTestContainer(config: Config, overrides: Overrides = {}) {
  return createContainer(config, {
    users: new InMemoryUserRepository(),
    menu: new InMemoryMenuRepository(),
    orders: new InMemoryOrderRepository(),
    orderDishes: new InMemoryDishReader(),
    ...overrides,
  });
}
