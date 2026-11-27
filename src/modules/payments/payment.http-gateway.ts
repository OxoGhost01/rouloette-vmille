import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import {
  PaymentProviderError,
  type ChargeRequest,
  type ChargeResult,
  type PaymentGateway,
  type ProviderFailure,
} from "./payment.gateway.js";

export type HttpGatewayOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number; // par tentative
  attempts?: number;
  backoffMs?: number; // attente avant la 2e tentative ; doublée ensuite
};

// Réponses du prestataire, validées avant d'être utilisées
const succeededSchema = z.object({ status: z.literal("succeeded") });
const declinedSchema = z.object({ status: z.literal("declined"), declineReason: z.string().optional() });

export class HttpPaymentGateway implements PaymentGateway {
  private readonly timeoutMs: number;
  private readonly attempts: number;
  private readonly backoffMs: number;

  constructor(private readonly options: HttpGatewayOptions) {
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.attempts = options.attempts ?? 3;
    this.backoffMs = options.backoffMs ?? 100;
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    // Une seule clé par paiement, réutilisée à chaque tentative : le prestataire ne débite qu'une fois
    const idempotencyKey = randomUUID();
    let failure: PaymentProviderError | undefined;

    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      try {
        return await this.callOnce(request, idempotencyKey);
      } catch (error) {
        if (!(error instanceof PaymentProviderError) || error.kind === "invalid") throw error;
        failure = error; // timeout ou panne : on réessaie
      }
      if (attempt < this.attempts) await sleep(this.backoffMs * 2 ** (attempt - 1));
    }
    throw failure;
  }

  private async callOnce({ amountCents, reference, token }: ChargeRequest, idempotencyKey: string) {
    let res: Response;
    try {
      res = await fetch(`${this.options.baseUrl}/v1/charges`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Idempotency-Key": idempotencyKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amountCents, currency: "EUR", reference, token }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new PaymentProviderError(isTimeout(error) ? "timeout" : "unavailable");
    }

    if (res.status >= 500) throw new PaymentProviderError("unavailable");
    if (res.status === 402) {
      const body = declinedSchema.safeParse(await readJson(res));
      if (!body.success) throw new PaymentProviderError("invalid");
      return { status: "declined", reason: body.data.declineReason ?? "refusé" } as const;
    }
    if (res.status === 201 && succeededSchema.safeParse(await readJson(res)).success) {
      return { status: "succeeded" } as const;
    }
    throw new PaymentProviderError("invalid"); // 400, 401 ou corps inattendu : réessayer ne changerait rien
  }
}

const isTimeout = (error: unknown) => (error as { name?: string })?.name === "TimeoutError";

const readJson = (res: Response) => res.json().catch(() => undefined);

export type { ProviderFailure };
