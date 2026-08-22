import type { SourcePhotographMimeType } from './sourcePhotograph';

export interface SourcePhotographFixture {
  readonly encodedBase64: string;
  readonly fileName: string;
  readonly height: number;
  readonly mimeType: SourcePhotographMimeType;
  readonly orientation: 'from-image';
  readonly width: number;
}

export const sourcePhotographFixtures: readonly SourcePhotographFixture[] = [
  {
    encodedBase64:
      '/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAADAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDbooor5Q+yP//Z',
    fileName: 'orientation-6-portrait.jpg',
    height: 4,
    mimeType: 'image/jpeg',
    orientation: 'from-image',
    width: 3,
  },
  {
    encodedBase64:
      'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAFElEQVR4nGMMaLrEAAZMEIqBgQEAHUIBqPmZOUcAAAAASUVORK5CYII=',
    fileName: 'landscape.png',
    height: 2,
    mimeType: 'image/png',
    orientation: 'from-image',
    width: 3,
  },
  {
    encodedBase64:
      'UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAIAAUAmJaACdLoAA5gA/upl//1Bn/kGf+QZ+ql5GQ25gAA=',
    fileName: 'square.webp',
    height: 2,
    mimeType: 'image/webp',
    orientation: 'from-image',
    width: 2,
  },
];

export function createSourcePhotographFixtureFile(fixture: SourcePhotographFixture): File {
  const binary = atob(fixture.encodedBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new File([bytes], fixture.fileName, { type: fixture.mimeType });
}
