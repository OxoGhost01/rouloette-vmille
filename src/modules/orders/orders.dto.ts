import { z } from "zod";
import { paginationShape } from "../../shared/pagination.js";

export const ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "PICKED_UP", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ---- Entrée : schémas stricts (role, unitPriceCents, totalCents… sont refusés) ----
export const placeOrderSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        dishId: z.number().int().min(1),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(20)
    .refine((items) => new Set(items.map((i) => i.dishId)).size === items.length, {
      message: "Un plat ne peut apparaître qu'une fois",
    }),
  note: z.string().max(200).optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const updateStatusSchema = z.strictObject({ status: z.enum(ORDER_STATUSES) });

export const listOrdersQuerySchema = z.strictObject({
  status: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(z.enum(ORDER_STATUSES)).min(1))
    .optional(),
  sort: z.enum(["createdAt", "-createdAt"]).default("-createdAt"),
  ...paginationShape,
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// ---- Échanges service <-> repository ----
export type OrderLine = { dishId: number; name: string; quantity: number; unitPriceCents: number };

export type NewOrder = { userId: number; note: string | null; totalCents: number; items: OrderLine[] };

export type OrderFilter = {
  userId?: number; // absent : toutes les commandes (cuisine, admin)
  statuses?: OrderStatus[];
  newestFirst: boolean;
  skip: number;
  take: number;
};

// Plat dont le stock ne suffit pas : `available` = portions restantes
export type StockShortage = { dishId: number; available: number };

// Résultat de la création : la commande, ou la liste des plats en rupture (rien n'a alors été consommé)
export type CreateOrderResult = { order: OrderRecord } | { shortages: StockShortage[] };

// ---- Sortie ----
export type OrderRecord = {
  id: number;
  status: OrderStatus;
  note: string | null;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; name: string };
  items: { dishId: number; name: string; quantity: number; unitPriceCents: number }[];
};

export const toOrderDto = (o: OrderRecord) => ({
  id: o.id,
  status: o.status,
  note: o.note,
  totalCents: o.totalCents,
  createdAt: o.createdAt.toISOString(),
  updatedAt: o.updatedAt.toISOString(),
  customer: { id: o.user.id, name: o.user.name },
  items: o.items.map((i) => ({
    dishId: i.dishId,
    name: i.name,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    lineTotalCents: i.quantity * i.unitPriceCents,
  })),
});
