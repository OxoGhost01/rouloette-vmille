import type { OrderStatus } from "./orders.model.js";

// Machine à états des commandes : les transitions autorisées sont décrites ICI, et nulle part ailleurs.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  RECEIVED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
};

// Le client ne peut annuler que tant que la cuisine n'a pas commencé.
const CUSTOMER_CAN_CANCEL_FROM: readonly OrderStatus[] = ["RECEIVED"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function customerCanCancel(from: OrderStatus): boolean {
  return CUSTOMER_CAN_CANCEL_FROM.includes(from) && canTransition(from, "CANCELLED");
}
