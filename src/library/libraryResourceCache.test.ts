import { ByteBudgetedResourceCache } from './libraryResourceCache';

describe('byte-budgeted Library resource cache', () => {
  it('uses least-recently-used eviction and disposes every admitted resource', () => {
    const first = vi.fn();
    const second = vi.fn();
    const cache = new ByteBudgetedResourceCache(100);
    expect(cache.admit('first', { bytes: 60, dispose: first, value: 'one' })).toBe(true);
    cache.touch('first');
    expect(cache.admit('second', { bytes: 60, dispose: second, value: 'two' })).toBe(true);
    expect(first).toHaveBeenCalledOnce();
    expect(cache.snapshot()).toEqual({ budget: 100, bytes: 60, count: 1 });
    cache.dispose();
    expect(second).toHaveBeenCalledOnce();
  });

  it('refuses a resource larger than its complete budget', () => {
    const dispose = vi.fn();
    const cache = new ByteBudgetedResourceCache(10);
    expect(cache.admit('large', { bytes: 11, dispose, value: 'large' })).toBe(false);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
