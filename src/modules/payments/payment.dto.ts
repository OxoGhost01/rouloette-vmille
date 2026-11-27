import { z } from "zod";

export const payOrderSchema = z.strictObject({ token: z.string().min(1).max(100) });
