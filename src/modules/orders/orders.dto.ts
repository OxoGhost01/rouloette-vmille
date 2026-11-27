import { z } from "zod";
import { paginationShape } from "../../shared/validation.js";
import { ORDER_STATUSES, type OrderRecord, type OrderSearch, type OrderStatus, type PaymentStatus, type PlaceOrder } from "./orders.model.js";

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
}) satisfies z.ZodType<PlaceOrder>;

export const updateStatusSchema = z.strictObject({ status: z.enum(ORDER_STATUSES) }) satisfies z.ZodType<{
  status: OrderStatus;
}>;

// Le contrat parle de `status=A,B` et `sort=-createdAt` ; le service reçoit des valeurs du domaine
export const listOrdersQuerySchema = z
  .strictObject({
    status: z
      .string()
      .transform((s) => s.split(","))
      .pipe(z.array(z.enum(ORDER_STATUSES)).min(1))
      .optional(),
    sort: z.enum(["createdAt", "-createdAt"]).default("-createdAt"),
    ...paginationShape,
  })
  .transform(({ status, sort, page, pageSize }) => ({
    statuses: status,
    newestFirst: sort === "-createdAt",
    page,
    pageSize,
  })) satisfies z.ZodType<OrderSearch>;

// ---- Sortie : chaque champ est choisi explicitement ----

export type OrderDto = {
  id: number;
  status: OrderStatus;
  note: string | null;
  totalCents: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  customer: { id: number; name: string };
  items: { dishId: number; name: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[];
};

export const toOrderDto = (o: OrderRecord): OrderDto => ({
  id: o.id,
  status: o.status,
  note: o.note,
  totalCents: o.totalCents,
  paymentStatus: o.paymentStatus,
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
