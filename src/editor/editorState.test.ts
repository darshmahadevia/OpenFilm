import {
  deserializeEditorState,
  editorReducer,
  initialEditorState,
  serializeEditorState,
  type EditorState,
} from './editorState';

describe('editorReducer', () => {
  it('starts with the adjustment tool and no source photograph', () => {
    expect(initialEditorState).toEqual({
      activeTool: 'adjustments',
      grainSeed: null,
      sourceFileName: null,
    });
  });

  it('changes the active tool without changing the source photograph', () => {
    const state: EditorState = {
      activeTool: 'adjustments',
      grainSeed: 1234,
      sourceFileName: 'morning.webp',
    };

    expect(editorReducer(state, { type: 'select-tool', tool: 'geometry' })).toEqual({
      activeTool: 'geometry',
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
    expect(editorReducer(selected, { type: 'clear-source' })).toEqual(initialEditorState);
  });

  it('round trips the Edit-specific grain seed for local recovery', () => {
    const state: EditorState = {
      activeTool: 'adjustments',
      grainSeed: 456789,
      sourceFileName: 'street.jpg',
    };

    expect(deserializeEditorState(serializeEditorState(state))).toEqual(state);
    expect(() => deserializeEditorState('{"grainSeed": "new seed"}')).toThrow(
      'recover the editor state',
    );
  });
});
