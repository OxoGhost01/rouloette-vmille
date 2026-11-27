import type { Response } from "express";
import type { AuthUser } from "../../fourni/auth/index.js";
import { toOrderDto } from "../orders/orders.dto.js";
import type { OrderEvent } from "../orders/orders.model.js";

type Connection = { user: AuthUser; res: Response };

// Qui reçoit quoi : cuisine et admin voient tout ; un client ne voit que les mises à jour de SA commande
export function canReceive(user: AuthUser, event: OrderEvent) {
  if (user.role !== "CUSTOMER") return true;
  return event.type === "order.updated" && event.order.user.id === user.id;
}

// Connexions SSE ouvertes. Ne connaît que le bus d'événements : le service des commandes ignore SSE.
export class SseHub {
  private readonly connections = new Set<Connection>();

  constructor(private readonly heartbeatMs = 25_000) {}

  connect(user: AuthUser, res: Response) {
    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    const connection = { user, res };
    this.connections.add(connection);
    // Un commentaire régulier garde la connexion ouverte
    const heartbeat = setInterval(() => res.write(": ping\n\n"), this.heartbeatMs);
    res.on("close", () => {
      clearInterval(heartbeat);
      this.connections.delete(connection);
    });
  }

  dispatch = (event: OrderEvent) => {
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(toOrderDto(event.order))}\n\n`;
    for (const { user, res } of this.connections) {
      if (canReceive(user, event)) res.write(frame);
    }
  };
}
