/** Independent instances separate NASA metadata from JPL trajectory caches. */
export class AsyncCache<T> {
  private values = new Map<string, { value: T; expires: number }>();
  private pending = new Map<string, Promise<T>>();
  constructor(
    private ttlMs: number,
    private maxEntries: number,
  ) {}
  get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key);
    if (cached && cached.expires > Date.now())
      return Promise.resolve(cached.value);
    this.values.delete(key);
    const running = this.pending.get(key);
    if (running) return running;
    const promise = Promise.resolve()
      .then(load)
      .then((value) => {
        if (this.values.size >= this.maxEntries)
          this.values.delete(this.values.keys().next().value!);
        this.values.set(key, { value, expires: Date.now() + this.ttlMs });
        return value;
      })
      .finally(() => {
        this.pending.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }
}
/** One provider request at a time. A failed request never poisons the queue. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
