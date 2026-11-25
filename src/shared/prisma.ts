import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.js";

// Singleton : un seul PrismaClient pour toute l'application
let instance: PrismaClient | undefined;

export function getPrisma(databaseUrl: string): PrismaClient {
  instance ??= new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
  return instance;
}
