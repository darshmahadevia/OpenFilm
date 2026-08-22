export type RendererStatus = 'available' | 'unsupported';

export function getRendererStatus(canvas: HTMLCanvasElement | null): RendererStatus {
  if (!canvas) {
    return 'unsupported';
  }

  try {
    return canvas.getContext('webgl2') ? 'available' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}
