import type { Router } from "express";
import type { Config } from "./config.js";
import { createAuth } from "./fourni/auth/index.js";
import { EventsController } from "./modules/events/events.controller.js";
import { SseHub } from "./modules/events/events.hub.js";
import { eventRoutes } from "./modules/events/events.routes.js";
import { HealthController } from "./modules/health/health.controller.js";
import {
  InMemoryHealthRepository,
  PrismaHealthRepository,
  type HealthRepository,
} from "./modules/health/health.repository.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { HealthService } from "./modules/health/health.service.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import { InMemoryMenuRepository, PrismaMenuRepository, type MenuRepository } from "./modules/menu/menu.repository.js";
import { menuRoutes } from "./modules/menu/menu.routes.js";
import { MenuService } from "./modules/menu/menu.service.js";
import { OrderController } from "./modules/orders/orders.controller.js";
import {
  InMemoryOrderRepository,
  PrismaOrderRepository,
  type OrderRepository,
} from "./modules/orders/orders.repository.js";
import { orderRoutes } from "./modules/orders/orders.routes.js";
import type { OrderEvent } from "./modules/orders/orders.model.js";
import { OrderService } from "./modules/orders/orders.service.js";
import { InMemoryUserRepository, PrismaUserRepository, type UserRepository } from "./modules/users/user.repository.js";
import { EventBus } from "./shared/event-bus.js";
import { createLogger, type Logger } from "./shared/logger.js";
import { getPrisma } from "./shared/prisma.js";

// Composition root : le seul endroit qui assemble les objets.
// Pour brancher un module : construire repository -> service -> controller -> router,
// puis ajouter son routeur dans `routes`.
export type Overrides = {
  users?: UserRepository;
  menu?: MenuRepository;
  orders?: OrderRepository;
  health?: HealthRepository;
  logger?: Logger;
};

export function createContainer(config: Config, overrides: Overrides = {}) {
  // Appelé seulement si un repository n'est pas remplacé : les tests ne touchent jamais la base
  const prisma = () => getPrisma(config.DATABASE_URL);

  const users = overrides.users ?? new PrismaUserRepository(prisma());
  const menu = overrides.menu ?? new PrismaMenuRepository(prisma());
  const orders = overrides.orders ?? new PrismaOrderRepository(prisma());
  const health = overrides.health ?? new PrismaHealthRepository(prisma());
  const logger = overrides.logger ?? createLogger(config.LOG_LEVEL);

  // Observer : les commandes annoncent leurs événements, le flux SSE (et plus tard le cache) s'y abonne
  const orderEvents = new EventBus<OrderEvent>((err) => logger.error({ err }, "Abonné aux événements en échec"));
  const sseHub = new SseHub();
  orderEvents.subscribe(sseHub.dispatch);

  const auth = createAuth({ users, jwtSecret: config.JWT_SECRET, jwtExpiresIn: config.JWT_EXPIRES_IN });

  const routes: Array<[path: string, router: Router]> = [
    ["/", healthRoutes(new HealthController(new HealthService(health)))],
    ["/", menuRoutes(new MenuController(new MenuService(menu)), auth)],
    ["/orders", orderRoutes(new OrderController(new OrderService(orders, menu, orderEvents)), auth)],
    ["/events", eventRoutes(new EventsController(sseHub), auth)],
  ];

  return { config, auth, logger, routes };
}

export type Container = ReturnType<typeof createContainer>;

// Container sans base de données, pour les tests Supertest
export function createTestContainer(config: Config, overrides: Overrides = {}) {
  return createContainer(config, {
    users: new InMemoryUserRepository(),
    menu: new InMemoryMenuRepository(),
    orders: new InMemoryOrderRepository(),
    health: new InMemoryHealthRepository(),
    logger: createLogger("silent"),
    ...overrides,
  });
}
