// Observer : l'émetteur annonce un événement sans savoir qui l'écoute (SSE, cache, notifications…)
export class EventBus<E> {
  private readonly listeners = new Set<(event: E) => void>();

  // `onError` : un abonné défaillant ne doit jamais faire échouer l'émetteur ni les autres abonnés
  constructor(private readonly onError: (error: unknown) => void = () => {}) {}

  subscribe(listener: (event: E) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: E) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.onError(error);
      }
    }
  }
}
