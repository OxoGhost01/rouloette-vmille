import type { PrismaClient } from "../../generated/prisma/client.js";

export interface HealthRepository {
  isDatabaseUp(): Promise<boolean>;
}

export class PrismaHealthRepository implements HealthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isDatabaseUp() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

// Pour les tests sans base
export class InMemoryHealthRepository implements HealthRepository {
  constructor(private readonly up = true) {}

  async isDatabaseUp() {
    return this.up;
  }
}
