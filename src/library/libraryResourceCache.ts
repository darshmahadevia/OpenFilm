export interface ByteBudgetedResource<T> {
  bytes: number;
  dispose: () => void;
  value: T;
}

export class ByteBudgetedResourceCache<T> {
  private readonly resources = new Map<string, ByteBudgetedResource<T>>();
  private bytes = 0;

  constructor(private readonly budget: number) {
    if (!Number.isSafeInteger(budget) || budget < 1)
      throw new Error('A resource cache needs a positive byte budget.');
  }

  admit(key: string, resource: ByteBudgetedResource<T>): boolean {
    if (
      !Number.isSafeInteger(resource.bytes) ||
      resource.bytes < 0 ||
      resource.bytes > this.budget
    ) {
      resource.dispose();
      return false;
    }
    this.remove(key);
    while (this.bytes + resource.bytes > this.budget && this.resources.size > 0) {
      this.remove(this.resources.keys().next().value as string);
    }
    this.resources.set(key, resource);
    this.bytes += resource.bytes;
    return true;
  }

  get(key: string): T | null {
    const resource = this.resources.get(key);
    if (!resource) return null;
    this.touch(key);
    return resource.value;
  }

  touch(key: string): void {
    const resource = this.resources.get(key);
    if (!resource) return;
    this.resources.delete(key);
    this.resources.set(key, resource);
  }

  remove(key: string): void {
    const resource = this.resources.get(key);
    if (!resource) return;
    resource.dispose();
    this.bytes -= resource.bytes;
    this.resources.delete(key);
  }

  snapshot(): { budget: number; bytes: number; count: number } {
    return { budget: this.budget, bytes: this.bytes, count: this.resources.size };
  }

  dispose(): void {
    for (const key of [...this.resources.keys()]) this.remove(key);
  }
}
