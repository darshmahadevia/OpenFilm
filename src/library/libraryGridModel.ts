export const LIBRARY_GRID_DENSITIES = ['overview', 'standard', 'detail'] as const;
export type LibraryGridDensity = (typeof LIBRARY_GRID_DENSITIES)[number];
