// Erreur métier ou HTTP, rendue au format du contrat : { error: { code, message, details? } }
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
