export type Accessory = {
  id: string;
  name: string;
  image: string;
  source: 'catalog' | 'upload';
  color: string;
  shape: string;
};

export type SavedLook = {
  id: string;
  name: string;
  image: string;
  createdAt: string;
};

const UPLOADS_KEY = 'forme.uploads.v1';
const LOOKS_KEY = 'forme.looks.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasImage(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value);
}

function isUpload(value: unknown): value is Accessory {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    hasImage(value.image) &&
    value.source === 'upload' &&
    typeof value.color === 'string' &&
    typeof value.shape === 'string'
  );
}

function isLook(value: unknown): value is SavedLook {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    hasImage(value.image) &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt))
  );
}

function readItems<T>(key: string, isItem: (value: unknown) => value is T): T[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isItem) : [];
  } catch {
    // A disabled store or an old/corrupt entry must not prevent using the mirror.
    return [];
  }
}

function writeItems(key: string, items: unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      throw new Error(
        'Your browser storage is full. Remove an uploaded piece or a saved look and try again.',
      );
    }
    throw new Error(
      'Your browser could not save this item. Allow storage for this site and try again.',
    );
  }
}

export function loadUploads(): Accessory[] {
  return readItems(UPLOADS_KEY, isUpload);
}

export function saveUploads(items: Accessory[]): void {
  writeItems(UPLOADS_KEY, items);
}

export function loadLooks(): SavedLook[] {
  return readItems(LOOKS_KEY, isLook);
}

export function saveLooks(items: SavedLook[]): void {
  writeItems(LOOKS_KEY, items);
}
