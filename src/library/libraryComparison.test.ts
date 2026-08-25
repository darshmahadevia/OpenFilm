import { neutralGeometry } from '../editor/geometry';
import {
  BoundedComparisonResources,
  createComparisonState,
  mapSourceFocalPointToPane,
  removeComparisonPane,
  setComparisonZoom,
  toggleComparisonPaneLink,
} from './libraryComparison';

describe('bounded Comparison', () => {
  it('admits exactly two to four selected panes and keeps linked scale and Source focal point', () => {
    expect(() => createComparisonState(['one'])).toThrow(/two to four/);
    expect(() => createComparisonState(['1', '2', '3', '4', '5'])).toThrow(/two to four/);
    let state = createComparisonState(['1', '2', '3', '4']);
    state = setComparisonZoom(state, '2', 2, { x: 0.75, y: 0.25 });
    expect(state.panes.every((pane) => pane.zoomScale === 2)).toBe(true);
    expect(state.focalPoint).toEqual({ x: 0.75, y: 0.25 });

    state = toggleComparisonPaneLink(state, '4');
    state = setComparisonZoom(state, '2', 1.5, { x: 0.3, y: 0.7 });
    expect(state.panes.find((pane) => pane.photographId === '4')?.zoomScale).toBe(2);
    state = removeComparisonPane(state, '4');
    expect(state.panes.map((pane) => pane.photographId)).toEqual(['1', '2', '3']);
  });

  it('maps and clamps an uncropped Source focal point through crop, rotation, and flip', () => {
    expect(mapSourceFocalPointToPane({ x: 0.5, y: 0.5 }, neutralGeometry)).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(
      mapSourceFocalPointToPane(
        { x: 0, y: 1 },
        { ...neutralGeometry, crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, rotation: 90 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it('evicts admitted resources under pressure and removes the 100 percent claim on fallback', () => {
    const firstDispose = vi.fn();
    const resources = new BoundedComparisonResources(100);
    expect(resources.admit('one', 60, firstDispose)).toMatchObject({ resolutionLimited: false });
    expect(resources.admit('two', 60, vi.fn())).toMatchObject({ resolutionLimited: false });
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(resources.snapshot()).toMatchObject({ bytes: 60, count: 1 });
    expect(resources.admit('huge', 101, vi.fn())).toMatchObject({ resolutionLimited: true });
    expect(resources.labelFor('huge', '100%')).toBe('Resolution limited · Fit');
  });
});
