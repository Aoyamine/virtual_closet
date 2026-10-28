import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadLooks,
  loadUploads,
  saveLooks,
  saveUploads,
  type Accessory,
  type SavedLook,
} from './storage';

const upload: Accessory = {
  id: 'one',
  name: 'My frames',
  image: 'data:image/png;base64,AA==',
  source: 'upload',
  color: 'Black',
  shape: 'Custom',
};
const look: SavedLook = {
  id: 'look-one',
  name: 'A look',
  image: 'data:image/png;base64,AA==',
  createdAt: '2026-10-28T10:00:00.000Z',
};

describe('local library storage', () => {
  let entries: Map<string, string>;
  beforeEach(() => {
    entries = new Map();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => entries.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        entries.set(key, value);
      }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips uploads and saved looks independently', () => {
    saveUploads([upload]);
    saveLooks([look]);
    expect(loadUploads()).toEqual([upload]);
    expect(loadLooks()).toEqual([look]);
    saveUploads([]);
    expect(loadUploads()).toEqual([]);
    expect(loadLooks()).toEqual([look]);
  });

  it('survives invalid JSON and invalid root objects', () => {
    entries.set('forme.uploads.v1', '{broken');
    entries.set('forme.looks.v1', '{}');
    expect(loadUploads()).toEqual([]);
    expect(loadLooks()).toEqual([]);
  });

  it('filters malformed records without losing valid items', () => {
    entries.set(
      'forme.uploads.v1',
      JSON.stringify([upload, { ...upload, source: 'catalog' }, null]),
    );
    entries.set('forme.looks.v1', JSON.stringify([look, { ...look, createdAt: 'invalid' }]));
    expect(loadUploads()).toEqual([upload]);
    expect(loadLooks()).toEqual([look]);
  });

  it('reports quota errors and preserves previously saved entries', () => {
    saveUploads([upload]);
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      const error = new Error('Quota');
      error.name = 'QuotaExceededError';
      throw error;
    });
    expect(() => saveUploads([])).toThrow('browser storage is full');
    expect(loadUploads()).toEqual([upload]);
  });

  it('handles unavailable browser storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Blocked');
      },
      setItem: () => {
        throw new Error('Blocked');
      },
    });
    expect(loadUploads()).toEqual([]);
    expect(() => saveLooks([look])).toThrow('Allow storage for this site');
  });
});
