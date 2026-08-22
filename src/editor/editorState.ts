export const editorTools = ['adjustments', 'geometry', 'looks'] as const;

export type EditorTool = (typeof editorTools)[number];

export interface EditorState {
  activeTool: EditorTool;
  sourceFileName: string | null;
}

export const initialEditorState: EditorState = {
  activeTool: 'adjustments',
  sourceFileName: null,
};

export type EditorAction =
  | { type: 'select-tool'; tool: EditorTool }
  | { type: 'source-selected'; fileName: string }
  | { type: 'clear-source' };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select-tool':
      return { ...state, activeTool: action.tool };
    case 'source-selected':
      return { ...state, sourceFileName: action.fileName };
    case 'clear-source':
      return { ...state, sourceFileName: null };
    default:
      return state;
  }
}
