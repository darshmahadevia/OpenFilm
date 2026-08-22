import { isValidGrainSeed, type GrainSeed } from './grain';

export const editorTools = ['adjustments', 'geometry', 'looks'] as const;

export type EditorTool = (typeof editorTools)[number];

export interface EditorState {
  activeTool: EditorTool;
  grainSeed: GrainSeed | null;
  sourceFileName: string | null;
}

export const initialEditorState: EditorState = {
  activeTool: 'adjustments',
  grainSeed: null,
  sourceFileName: null,
};

export type EditorAction =
  | { type: 'select-tool'; tool: EditorTool }
  | { type: 'source-selected'; fileName: string; grainSeed: GrainSeed }
  | { type: 'clear-source' };

function isEditorTool(value: unknown): value is EditorTool {
  return editorTools.includes(value as EditorTool);
}

export function serializeEditorState(state: EditorState): string {
  return JSON.stringify({
    activeTool: state.activeTool,
    grainSeed: state.grainSeed,
    sourceFileName: state.sourceFileName,
  });
}

export function deserializeEditorState(serialized: string): EditorState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('OpenFilm could not recover the editor state.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OpenFilm could not recover the editor state.');
  }

  const record = parsed as Record<string, unknown>;

  if (
    !isEditorTool(record.activeTool) ||
    (record.sourceFileName !== null && typeof record.sourceFileName !== 'string') ||
    (record.grainSeed !== null && !isValidGrainSeed(record.grainSeed))
  ) {
    throw new Error('OpenFilm could not recover the editor state.');
  }

  return {
    activeTool: record.activeTool,
    grainSeed: record.grainSeed,
    sourceFileName: record.sourceFileName,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select-tool':
      return { ...state, activeTool: action.tool };
    case 'source-selected':
      return { ...state, grainSeed: action.grainSeed, sourceFileName: action.fileName };
    case 'clear-source':
      return { ...state, grainSeed: null, sourceFileName: null };
    default:
      return state;
  }
}
