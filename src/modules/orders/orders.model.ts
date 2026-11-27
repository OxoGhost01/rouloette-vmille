import type { PageQuery } from "../../shared/pagination.js";

export const ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "PICKED_UP", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = "UNPAID" | "PAID";

export type OrderLine = { dishId: number; name: string; quantity: number; unitPriceCents: number };

export type OrderRecord = {
  id: number;
  status: OrderStatus;
  note: string | null;
  totalCents: number;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; name: string };
  items: OrderLine[];
};

// Événement annoncé sur le bus : le service des commandes ne sait pas qui l'écoute
export type OrderEvent = { type: "order.created" | "order.updated"; order: OrderRecord };

// Ce que le client demande : le prix et le total viennent de la base, jamais de lui
export type PlaceOrder = { items: { dishId: number; quantity: number }[]; note?: string };

// Ce que le service demande d'écrire au repository
export type NewOrder = { userId: number; note: string | null; totalCents: number; items: OrderLine[] };

// Recherche demandée au service des commandes
export type OrderSearch = PageQuery & { statuses?: OrderStatus[]; newestFirst: boolean };

// Filtre transmis au repository
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
