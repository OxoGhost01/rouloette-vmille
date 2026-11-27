import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "16 caractères minimum"),
  JWT_EXPIRES_IN: z.string().default("2h"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PAYMENT_PROVIDER: z.enum(["http", "fake"]).default("http"),
  PAYMENT_URL: z.string().min(1).default("http://localhost:4010"),
  PAYMENT_API_KEY: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  MENU_CACHE_TTL_MS: z.coerce.number().int().min(0).default(30_000),
});

export type Config = z.infer<typeof envSchema>;

// Valide l'environnement : une variable manquante ou invalide empêche le démarrage
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuration invalide (voir .env.example) :\n${problems}`);
  }
  return result.data;
}
