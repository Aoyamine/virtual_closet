import type { FacePosition } from './tracking';

export interface Placement {
  /** Multiplier applied to the tracked accessory width. */
  scale: number;
  /** Vertical offset as a fraction of the tracked accessory width. */
  offsetY: number;
  /** Additional rotation in degrees. */
  rotation: number;
  /** Image opacity, from zero to one. */
  opacity: number;
}

/** Draw a transparent front-facing accessory in the source image coordinates. */
export function drawAccessory(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  face: FacePosition,
  placement: Placement,
  width: number,
  height: number,
): void {
  if (
    !image.complete ||
    !image.naturalWidth ||
    !image.naturalHeight ||
    width <= 0 ||
    height <= 0 ||
    placement.scale <= 0 ||
    face.width <= 0 ||
    ![...Object.values(face), ...Object.values(placement), width, height].every(Number.isFinite)
  ) {
    return;
  }

  const faceWidth = face.width * width;
  const accessoryWidth = faceWidth * placement.scale;
  const accessoryHeight = accessoryWidth * (image.naturalHeight / image.naturalWidth);

  ctx.save();
  ctx.translate(face.x * width, face.y * height);
  ctx.rotate(face.angle + (placement.rotation * Math.PI) / 180);
  ctx.globalAlpha = Math.min(1, Math.max(0, placement.opacity));
  ctx.drawImage(
    image,
    -accessoryWidth / 2,
    -accessoryHeight / 2 + faceWidth * placement.offsetY,
    accessoryWidth,
    accessoryHeight,
  );
  ctx.restore();
}
