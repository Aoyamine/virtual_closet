import { describe, expect, it } from 'vitest';
import { removeLightBackground } from './images';

function makePixels(rows: string[]): Uint8ClampedArray {
  const colors: Record<string, number[]> = {
    W: [255, 255, 255, 255],
    B: [10, 10, 10, 255],
    R: [250, 220, 190, 255],
    T: [0, 0, 0, 0],
  };
  return new Uint8ClampedArray(rows.flatMap((row) => [...row].flatMap((pixel) => colors[pixel])));
}

describe('removeLightBackground', () => {
  it('removes a border background while retaining a bright enclosed lens', () => {
    const pixels = makePixels(['WWWWW', 'WBBBW', 'WBWBW', 'WBBBW', 'WWWWW']);
    const result = removeLightBackground(pixels, 5, 5);
    expect(result[3]).toBe(0);
    expect(result[(2 * 5 + 2) * 4 + 3]).toBe(255);
    expect(result[(1 * 5 + 1) * 4 + 3]).toBe(255);
    expect(pixels[3]).toBe(255);
  });

  it('preserves colored product pixels and existing transparency', () => {
    const pixels = makePixels(['TWT', 'BRB', 'BBB']);
    const result = removeLightBackground(pixels, 3, 3);
    expect(result[3]).toBe(0);
    expect(result[7]).toBe(0);
    expect(result[(1 * 3 + 1) * 4 + 3]).toBe(255);
    expect([...result.slice((1 * 3 + 1) * 4, (1 * 3 + 2) * 4)]).toEqual([250, 220, 190, 255]);
  });

  it('does not remove diagonal-only connections through a frame', () => {
    const pixels = makePixels(['WBB', 'BWB', 'BBB']);
    const result = removeLightBackground(pixels, 3, 3);
    expect(result[3]).toBe(0);
    expect(result[(1 * 3 + 1) * 4 + 3]).toBe(255);
  });

  it('handles one-pixel-wide images and rejects inconsistent dimensions', () => {
    expect([...removeLightBackground(makePixels(['W', 'B', 'W']), 1, 3)]).toEqual([
      255, 255, 255, 0, 10, 10, 10, 255, 255, 255, 255, 0,
    ]);
    expect(() => removeLightBackground(new Uint8ClampedArray(4), 2, 2)).toThrow(RangeError);
  });
});
