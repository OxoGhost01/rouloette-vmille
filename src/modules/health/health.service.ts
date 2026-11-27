import type { HealthRepository } from "./health.repository.js";

export class HealthService {
  constructor(private readonly health: HealthRepository) {}

  async check() {
    const up = await this.health.isDatabaseUp();
    return { status: up ? ("ok" as const) : ("degraded" as const), database: up ? ("up" as const) : ("down" as const) };
  }
}
