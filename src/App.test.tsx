import { fireEvent, render, screen } from '@testing-library/react';

import App from './App';

describe('OpenFilm shell', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives the preview priority and shows one active tool area', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Your photograph, in focus.' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Adjust', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Adjustments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import photograph' })).toBeInTheDocument();
  });

  it('switches tools and opens the help dialog', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Geometry' }));
    expect(screen.getByRole('heading', { name: 'Geometry' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Geometry', selected: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open editor help' }));
    expect(screen.getByRole('dialog', { name: 'A quiet place to edit' })).toBeInTheDocument();
  });
});
