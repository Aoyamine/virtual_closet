/** Position is normalized to the unmirrored camera image; angle is in radians. */
export interface FacePosition {
  x: number;
  y: number;
  width: number;
  angle: number;
}

export interface FaceTracker {
  send: (image: HTMLVideoElement | HTMLImageElement) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * MediaPipe runs entirely in the browser using the assets served by this app.
 * Callers own the frame loop and may mirror the complete rendered scene.
 */
export async function createFaceTracker(
  onFace: (face: FacePosition | null) => void,
): Promise<FaceTracker> {
  const { FaceMesh } = await import('@mediapipe/face_mesh');
  const mesh = new FaceMesh({
    locateFile: (file) => `/mediapipe/${file}`,
  });

  let previous: FacePosition | null = null;
  let closed = false;
  let sourceWidth = 1;
  let sourceHeight = 1;
  let pending: Promise<void> | null = null;

  mesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: false,
  });

  mesh.onResults((results) => {
    if (closed) return;
    const landmarks = results.multiFaceLandmarks?.[0];
    const left = landmarks?.[33];
    const right = landmarks?.[263];
    const bridge = landmarks?.[168];

    if (!left || !right || !bridge) {
      previous = null;
      onFace(null);
      return;
    }

    // Account for the image aspect ratio when deriving an angle and eye span.
    const dx = (right.x - left.x) * sourceWidth;
    const dy = (right.y - left.y) * sourceHeight;
    const next: FacePosition = {
      x: bridge.x,
      y: (left.y + right.y) / 2,
      width: (Math.hypot(dx, dy) / sourceWidth) * 1.5,
      angle: Math.atan2(dy, dx),
    };

    if (!Object.values(next).every(Number.isFinite) || next.width < 0.025) {
      previous = null;
      onFace(null);
      return;
    }

    if (previous) {
      const weight = 0.5;
      // Wrap the angle difference so smoothing never spins across ±π.
      const delta = Math.atan2(
        Math.sin(next.angle - previous.angle),
        Math.cos(next.angle - previous.angle),
      );
      next.x = previous.x + (next.x - previous.x) * weight;
      next.y = previous.y + (next.y - previous.y) * weight;
      next.width = previous.width + (next.width - previous.width) * weight;
      next.angle = previous.angle + delta * weight;
    }

    previous = next;
    onFace(next);
  });

  try {
    await mesh.initialize();
  } catch (error) {
    await mesh.close().catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Face tracking could not load. Please reload and try again. ${detail}`);
  }

  return {
    async send(image) {
      if (closed) return;
      // MediaPipe does not accept overlapping send calls. Reuse the pending
      // promise instead of queueing stale camera frames when inference is slow.
      if (pending) return pending;
      sourceWidth = image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth;
      sourceHeight = image instanceof HTMLVideoElement ? image.videoHeight : image.naturalHeight;
      if (!sourceWidth || !sourceHeight) return;

      pending = mesh.send({ image });
      try {
        await pending;
      } finally {
        pending = null;
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await pending?.catch(() => undefined);
      await mesh.close();
      previous = null;
    },
  };
}
