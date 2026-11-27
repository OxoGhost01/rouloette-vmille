import type { Request, Response } from "express";
import type { HealthService } from "./health.service.js";

export class HealthController {
  constructor(private readonly service: HealthService) {}

  check = async (_req: Request, res: Response) => {
    const report = await this.service.check();
    res.status(report.database === "up" ? 200 : 503).json(report);
  };
}
