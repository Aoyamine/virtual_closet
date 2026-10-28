const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_SIZE = 1200;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** Remove light neutral background only where it connects to an image edge. */
export function removeLightBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    pixels.length !== width * height * 4
  ) {
    throw new RangeError('The image dimensions do not match its pixels.');
  }

  const output = new Uint8ClampedArray(pixels);
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (index: number) => {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const alpha = pixels[offset + 3];
    const lightest = Math.max(red, green, blue);
    const darkest = Math.min(red, green, blue);
    if (alpha <= 16 || (darkest >= 215 && lightest - darkest <= 30)) {
      queue[tail++] = index;
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    output[index * 4 + 3] = 0;
    const x = index % width;
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index < width * (height - 1)) enqueue(index + width);
  }

  return output;
}

async function verifyImageSignature(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(
    (file.type === 'image/png' && png) ||
    (file.type === 'image/jpeg' && jpeg) ||
    (file.type === 'image/webp' && webp)
  )) {
    throw new Error('This file is not a valid PNG, JPEG, or WebP image.');
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error('This image could not be opened. Try a different PNG, JPEG, or WebP.'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareAccessory(file: File, removeBackground: boolean): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image. SVG files are not supported.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Choose an image smaller than 10 MB.');
  }
  await verifyImageSignature(file);
  const image = await loadImage(file);
  if (image.naturalWidth < 16 || image.naturalHeight < 16) {
    throw new Error('Choose an image that is at least 16 × 16 pixels.');
  }
  const ratio = Math.min(1, MAX_IMAGE_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * ratio);
  canvas.height = Math.round(image.naturalHeight * ratio);
  const context = canvas.getContext('2d', { willReadFrequently: removeBackground });
  if (!context) throw new Error('Your browser does not support preparing images.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (removeBackground) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    imageData.data.set(removeLightBackground(imageData.data, canvas.width, canvas.height));
    context.putImageData(imageData, 0, 0);
  }
  return canvas.toDataURL('image/png');
}
