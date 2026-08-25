import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { neutralGeometry } from '../editor/geometry';
import {
  createRenderer,
  MAX_PREVIEW_DIMENSION,
  neutralRendererAdjustments,
  type PreviewRenderer,
} from '../rendering/renderer';
import { getLibraryEdit } from './libraryReview';
import type { LibraryPhotographRecord } from './libraryModel';

interface LibraryPhotoViewProps {
  photograph: LibraryPhotographRecord;
  onLoadSource: (relativePath: string, signal?: AbortSignal) => Promise<File>;
  onSourceZoomAvailability: (available: boolean) => void;
  sourceView: boolean;
  renderGeneration: number;
  zoomScale: number;
}

function readImageSize(objectUrl: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.onerror = () => reject(new Error('OpenFilm could not decode this Source photograph.'));
    image.src = objectUrl;
  });
}

export function LibraryPhotoView({
  photograph,
  onLoadSource,
  onSourceZoomAvailability,
  sourceView,
  renderGeneration,
  zoomScale,
}: LibraryPhotoViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const zoomScaleRef = useRef(zoomScale);
  const [message, setMessage] = useState('Reading Source photograph.');
  const [sourceDimensions, setSourceDimensions] = useState<{
    height: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas, {
      onError: (error) => setMessage(error.message),
      onStatusChange: (status) => {
        if (status === 'context-lost')
          setMessage(
            'Graphics context lost. OpenFilm will restore this view when the browser recovers it.',
          );
        else if (status === 'available') setMessage('');
      },
    });
    if (!renderer) {
      setMessage('This browser does not provide the WebGL2 renderer OpenFilm needs.');
      return;
    }
    rendererRef.current = renderer;
    const resize = () =>
      renderer.resize(
        canvas.clientWidth,
        canvas.clientHeight,
        zoomScaleRef.current === 2 ? 1 : window.devicePixelRatio,
      );
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || photograph.sourceState === 'missing') {
      setMessage('The Source photograph is Missing. Refresh or relink it to continue.');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setMessage('Reading Source photograph.');
    setSourceDimensions(null);
    onSourceZoomAvailability(false);
    void onLoadSource(photograph.relativePath, controller.signal)
      .then(async (file) => {
        objectUrl = URL.createObjectURL(file);
        const dimensions = await readImageSize(objectUrl);
        if (cancelled) return;
        setSourceDimensions(dimensions);
        onSourceZoomAvailability(
          Math.max(dimensions.width, dimensions.height) <= MAX_PREVIEW_DIMENSION,
        );
        await renderer.replaceImage({ ...dimensions, objectUrl });
        if (!cancelled) setMessage('');
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage(
            error instanceof Error
              ? error.message
              : 'OpenFilm could not show this Source photograph.',
          );
      });
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [onLoadSource, onSourceZoomAvailability, photograph.relativePath, photograph.sourceState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;
    requestAnimationFrame(() =>
      renderer.resize(
        canvas.clientWidth,
        canvas.clientHeight,
        zoomScale === 2 ? 1 : window.devicePixelRatio,
      ),
    );
  }, [sourceDimensions, zoomScale]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const edit = getLibraryEdit(photograph);
    renderer.setAdjustments(sourceView ? neutralRendererAdjustments : edit.adjustments);
    renderer.setGeometry(sourceView ? neutralGeometry : edit.geometry);
    renderer.setGrainSeed(edit.grainSeed);
  }, [photograph, renderGeneration, sourceView]);

  return (
    <div
      className="library-photo-view"
      style={
        {
          '--library-photo-height':
            zoomScale === 2 && sourceDimensions ? `${sourceDimensions.height}px` : '100%',
          '--library-photo-width':
            zoomScale === 2 && sourceDimensions ? `${sourceDimensions.width}px` : '100%',
        } as CSSProperties
      }
    >
      <canvas
        aria-label={`${photograph.fileName} ${sourceView ? 'Source view' : 'Rendered Edit'}`}
        ref={canvasRef}
      />
      {message ? (
        <p
          className="library-photo-view__message"
          role={message.includes('lost') ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
