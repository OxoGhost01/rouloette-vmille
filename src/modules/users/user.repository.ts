import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthUserStore, StoredUser } from "../../fourni/auth/index.js";

// Adapter : le module d'authentification fourni ne connaît que AuthUserStore
export interface UserRepository extends AuthUserStore {}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: Parameters<AuthUserStore["create"]>[0]) {
    return this.prisma.user.create({ data });
  }
}

// Pour les tests : aucune base nécessaire
export class InMemoryUserRepository implements UserRepository {
  private users: StoredUser[] = [];
  private nextId = 1;

  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: number) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async create(data: Parameters<AuthUserStore["create"]>[0]) {
    const user = { id: this.nextId++, ...data };
    this.users.push(user);
    return user;
  }
}
