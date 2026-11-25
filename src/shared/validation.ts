import type { z } from "zod";
import { HttpError } from "./errors.js";

// Valide une entrée (body, query, params) avec un schéma Zod ; sinon 400 VALIDATION_ERROR
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new HttpError(400, "VALIDATION_ERROR", "Données invalides", details);
  }
  return result.data;
}
