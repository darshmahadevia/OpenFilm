import {
  deserializeEditorState,
  editorReducer,
  initialEditorState,
  serializeEditorState,
  type EditorState,
} from './editorState';
import { neutralGeometry } from './geometry';

describe('editorReducer', () => {
  it('starts with the adjustment tool and no source photograph', () => {
    expect(initialEditorState).toEqual({
      activeTool: 'adjustments',
      geometry: neutralGeometry,
      grainSeed: null,
      sourceFileName: null,
    });
  });

  it('changes the active tool without changing the source photograph', () => {
    const state: EditorState = {
      activeTool: 'adjustments',
      geometry: neutralGeometry,
      grainSeed: 1234,
      sourceFileName: 'morning.webp',
    };

    expect(editorReducer(state, { type: 'select-tool', tool: 'geometry' })).toEqual({
      activeTool: 'geometry',
      geometry: neutralGeometry,
      grainSeed: 1234,
      sourceFileName: 'morning.webp',
    });
  });

  it('records and clears the selected source photograph', () => {
    const selected = editorReducer(initialEditorState, {
      type: 'source-selected',
      fileName: 'street.jpg',
      grainSeed: 9876,
    });

    expect(selected.sourceFileName).toBe('street.jpg');
    expect(selected.grainSeed).toBe(9876);
    expect(selected.geometry).toEqual(neutralGeometry);
    expect(editorReducer(selected, { type: 'clear-source' })).toEqual(initialEditorState);
  });

  it('round trips Edit-specific geometry and grain seed for local recovery', () => {
    const state: EditorState = {
      activeTool: 'adjustments',
      geometry: {
        ...neutralGeometry,
        crop: { height: 0.8, width: 0.75, x: 0.1, y: 0.05 },
        rotation: 90,
      },
      grainSeed: 456789,
      sourceFileName: 'street.jpg',
    };

    expect(deserializeEditorState(serializeEditorState(state))).toEqual(state);
    expect(() => deserializeEditorState('{"grainSeed": "new seed"}')).toThrow(
      'recover the editor state',
    );
  });

  it('updates geometry without putting it into adjustment state', () => {
    const geometry = {
      ...neutralGeometry,
      flipHorizontal: true,
    };

    expect(editorReducer(initialEditorState, { type: 'set-geometry', geometry })).toEqual({
      ...initialEditorState,
      geometry,
    });
  });
});
