import { getRendererStatus } from './renderer';

describe('getRendererStatus', () => {
  it('reports WebGL2 as unsupported when no canvas is available', () => {
    expect(getRendererStatus(null)).toBe('unsupported');
  });

  it('reports WebGL2 as available when the canvas exposes a WebGL2 context', () => {
    const canvas = {
      getContext: (contextId: string) => (contextId === 'webgl2' ? {} : null),
    } as unknown as HTMLCanvasElement;

    expect(getRendererStatus(canvas)).toBe('available');
  });

  it('treats a browser context failure as unsupported', () => {
    const canvas = {
      getContext: () => {
        throw new Error('context unavailable');
      },
    } as unknown as HTMLCanvasElement;

    expect(getRendererStatus(canvas)).toBe('unsupported');
  });
});
