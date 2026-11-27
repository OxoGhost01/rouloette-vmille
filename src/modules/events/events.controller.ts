import type { Request, Response } from "express";
import { currentUser } from "../../fourni/auth/index.js";
import type { SseHub } from "./events.hub.js";

export class EventsController {
  constructor(private readonly hub: SseHub) {}

  stream = (req: Request, res: Response) => {
    this.hub.connect(currentUser(req), res);
  };
}
