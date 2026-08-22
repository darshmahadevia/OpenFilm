import { isValidGrainSeed, type GrainSeed } from './grain';
import {
  isValidGeometry,
  neutralGeometry,
  normalizeGeometry,
  type GeometryValues,
} from './geometry';

export const editorTools = ['adjustments', 'geometry', 'looks'] as const;

export type EditorTool = (typeof editorTools)[number];

export interface EditorState {
  activeTool: EditorTool;
  geometry: GeometryValues;
  grainSeed: GrainSeed | null;
  sourceFileName: string | null;
}

export const initialEditorState: EditorState = {
  activeTool: 'adjustments',
  geometry: normalizeGeometry(neutralGeometry),
  grainSeed: null,
  sourceFileName: null,
};

export type EditorAction =
  | { type: 'select-tool'; tool: EditorTool }
  | { type: 'set-geometry'; geometry: GeometryValues }
  | { type: 'source-selected'; fileName: string; grainSeed: GrainSeed }
  | { type: 'attach-source'; fileName: string; grainSeed?: GrainSeed }
  | { type: 'clear-source' }
  | {
      type: 'restore';
      state: Pick<EditorState, 'activeTool' | 'geometry' | 'grainSeed' | 'sourceFileName'>;
    };

function isEditorTool(value: unknown): value is EditorTool {
  return editorTools.includes(value as EditorTool);
}

export function serializeEditorState(state: EditorState): string {
  return JSON.stringify({
    activeTool: state.activeTool,
    geometry: normalizeGeometry(state.geometry),
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
    (record.grainSeed !== null && !isValidGrainSeed(record.grainSeed)) ||
    (record.geometry !== undefined && !isValidGeometry(record.geometry))
  ) {
    throw new Error('OpenFilm could not recover the editor state.');
  }

  return {
    activeTool: record.activeTool,
    geometry:
      record.geometry === undefined
        ? normalizeGeometry(neutralGeometry)
        : normalizeGeometry(record.geometry),
    grainSeed: record.grainSeed,
    sourceFileName: record.sourceFileName,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select-tool':
      return { ...state, activeTool: action.tool };
    case 'set-geometry':
      return { ...state, geometry: normalizeGeometry(action.geometry) };
    case 'source-selected':
      return {
        ...state,
        geometry: normalizeGeometry(neutralGeometry),
        grainSeed: action.grainSeed,
        sourceFileName: action.fileName,
      };
    case 'attach-source':
      return {
        ...state,
        grainSeed: action.grainSeed ?? state.grainSeed,
        sourceFileName: action.fileName,
      };
    case 'restore':
      return {
        ...state,
        activeTool: action.state.activeTool,
        geometry: normalizeGeometry(action.state.geometry),
        grainSeed: action.state.grainSeed,
        sourceFileName: action.state.sourceFileName,
      };
    case 'clear-source':
      return {
        ...state,
        geometry: normalizeGeometry(neutralGeometry),
        grainSeed: null,
        sourceFileName: null,
      };
    default:
      return state;
  }
}
