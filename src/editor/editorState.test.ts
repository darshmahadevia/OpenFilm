import { editorReducer, initialEditorState, type EditorState } from './editorState';

describe('editorReducer', () => {
  it('starts with the adjustment tool and no source photograph', () => {
    expect(initialEditorState).toEqual({
      activeTool: 'adjustments',
      sourceFileName: null,
    });
  });

  it('changes the active tool without changing the source photograph', () => {
    const state: EditorState = { activeTool: 'adjustments', sourceFileName: 'morning.webp' };

    expect(editorReducer(state, { type: 'select-tool', tool: 'geometry' })).toEqual({
      activeTool: 'geometry',
      sourceFileName: 'morning.webp',
    });
  });

  it('records and clears the selected source photograph', () => {
    const selected = editorReducer(initialEditorState, {
      type: 'source-selected',
      fileName: 'street.jpg',
    });

    expect(selected.sourceFileName).toBe('street.jpg');
    expect(editorReducer(selected, { type: 'clear-source' })).toEqual(initialEditorState);
  });
});
