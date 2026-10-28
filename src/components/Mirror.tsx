import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, FlipHorizontal2, LoaderCircle, ScanFace } from 'lucide-react';
import type { Accessory } from '../lib/storage';
import { drawAccessory, type Placement } from '../lib/render';
import { createFaceTracker, type FacePosition, type FaceTracker } from '../lib/tracking';

export interface MirrorProps {
  selected: Accessory;
  placement: Placement;
  onCapture: (dataUrl: string) => void;
  onError: (message: string) => void;
}

const DEMO_FACE: FacePosition = { x: 0.495, y: 0.373, width: 0.43, angle: -0.015 };

function cameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Camera access was blocked. Allow camera access in your browser, then try again. You can still try pieces on the demo photo.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No camera was found. Connect a camera or use the demo photo.';
    }
    if (error.name === 'NotReadableError') {
      return 'Your camera is being used by another app. Close it there, then try again.';
    }
  }
  return error instanceof Error ? error.message : 'The camera could not start. Please try again.';
}

export function Mirror({ selected, placement, onCapture, onError }: MirrorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const portraitRef = useRef<HTMLImageElement | null>(null);
  const accessoryRef = useRef<HTMLImageElement | null>(null);
  const loadedAccessoryRef = useRef('');
  const renderedAccessoryRef = useRef('');
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const trackerPromiseRef = useRef<Promise<FaceTracker> | null>(null);
  const faceRef = useRef<FacePosition | null>(DEMO_FACE);
  const demoFaceRef = useRef<FacePosition>(DEMO_FACE);
  const placementRef = useRef(placement);
  const modeRef = useRef<'demo' | 'camera'>('demo');
  const mirroredRef = useRef(false);
  const lifecycleRef = useRef(0);
  const cameraRequestRef = useRef(0);
  const sourceGenerationRef = useRef(0);
  const trackingRequestRef = useRef<{ mode: 'demo' | 'camera'; generation: number } | null>(null);
  const errorCallbackRef = useRef(onError);
  const [mode, setMode] = useState<'demo' | 'camera'>('demo');
  const [starting, setStarting] = useState(false);
  const [loadingTracker, setLoadingTracker] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [accessoryReady, setAccessoryReady] = useState(false);
  const [mirrored, setMirrored] = useState(false);

  placementRef.current = placement;
  errorCallbackRef.current = onError;

  const ensureTracker = useCallback((): Promise<FaceTracker> => {
    if (trackerRef.current) return Promise.resolve(trackerRef.current);
    if (trackerPromiseRef.current) return trackerPromiseRef.current;
    const generation = lifecycleRef.current;
    setLoadingTracker(true);
    const promise = createFaceTracker((face) => {
      if (generation !== lifecycleRef.current) return;
      const request = trackingRequestRef.current;
      if (
        !request ||
        request.generation !== sourceGenerationRef.current ||
        request.mode !== modeRef.current
      )
        return;
      if (modeRef.current === 'demo') {
        if (face) demoFaceRef.current = face;
        faceRef.current = face || demoFaceRef.current;
      } else {
        faceRef.current = face;
      }
      setTracked(Boolean(face));
    })
      .then(async (tracker) => {
        if (generation !== lifecycleRef.current) {
          await tracker.close();
          throw new Error('Mirror was closed.');
        }
        trackerRef.current = tracker;
        setLoadingTracker(false);
        return tracker;
      })
      .catch((error: unknown) => {
        if (generation === lifecycleRef.current) {
          trackerPromiseRef.current = null;
          setLoadingTracker(false);
        }
        throw error;
      });
    trackerPromiseRef.current = promise;
    return promise;
  }, []);

  const sendFrame = useCallback(
    async (
      tracker: FaceTracker,
      image: HTMLVideoElement | HTMLImageElement,
      mode: 'demo' | 'camera',
    ) => {
      if (trackingRequestRef.current) return;
      const request = { mode, generation: sourceGenerationRef.current };
      trackingRequestRef.current = request;
      try {
        await tracker.send(image);
      } finally {
        if (trackingRequestRef.current === request) trackingRequestRef.current = null;
      }
    },
    [],
  );

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    sourceGenerationRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    modeRef.current = 'demo';
    faceRef.current = demoFaceRef.current;
    setMode('demo');
    setStarting(false);
    setTracked(false);
    mirroredRef.current = false;
    setMirrored(false);
  }, []);

  useEffect(() => {
    const generation = ++lifecycleRef.current;
    let frame = 0;
    let sending = false;
    let lastSend = 0;
    const portrait = new Image();
    portraitRef.current = portrait;
    portrait.onload = () => {
      if (generation !== lifecycleRef.current) return;
      setImageReady(true);
      // The demo works immediately with its prepared placement; actual landmarks
      // refine it once the local browser model has loaded.
      void ensureTracker()
        .then((tracker) => {
          if (generation === lifecycleRef.current && modeRef.current === 'demo') {
            return sendFrame(tracker, portrait, 'demo');
          }
        })
        .catch(() => {
          // A static demo remains usable on devices without model support.
        });
    };
    portrait.onerror = () => {
      if (generation === lifecycleRef.current) {
        errorCallbackRef.current(
          'The demo photo could not load. You can start your camera to try on pieces.',
        );
      }
    };
    portrait.src = '/demo-portrait.png';

    const draw = (time: number) => {
      if (generation !== lifecycleRef.current) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const isCamera = modeRef.current === 'camera';
      const source = isCamera ? video : portrait;
      const sourceWidth = isCamera ? video?.videoWidth : portrait.naturalWidth;
      const sourceHeight = isCamera ? video?.videoHeight : portrait.naturalHeight;
      const ctx = canvas?.getContext('2d');
      if (
        ctx &&
        canvas &&
        source &&
        sourceWidth &&
        sourceHeight &&
        (!isCamera || (video && video.readyState >= 2))
      ) {
        const width = Math.min(1000, sourceWidth);
        const height = Math.round((width * sourceHeight) / sourceWidth);
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        if (mirroredRef.current) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(source, 0, 0, width, height);
        if (accessoryRef.current && faceRef.current) {
          drawAccessory(
            ctx,
            accessoryRef.current,
            faceRef.current,
            placementRef.current,
            width,
            height,
          );
          renderedAccessoryRef.current = loadedAccessoryRef.current;
        } else {
          renderedAccessoryRef.current = '';
        }
        ctx.restore();
      }
      if (
        isCamera &&
        video &&
        video.readyState >= 2 &&
        trackerRef.current &&
        !sending &&
        !trackingRequestRef.current &&
        time - lastSend > 45
      ) {
        sending = true;
        lastSend = time;
        void sendFrame(trackerRef.current, video, 'camera')
          .catch((error: unknown) => {
            if (generation === lifecycleRef.current && modeRef.current === 'camera') {
              stopCamera();
              errorCallbackRef.current(cameraError(error));
            }
          })
          .finally(() => {
            sending = false;
          });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const handlePageHide = () => stopCamera();
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      lifecycleRef.current += 1;
      cameraRequestRef.current += 1;
      cancelAnimationFrame(frame);
      window.removeEventListener('pagehide', handlePageHide);
      portrait.onload = null;
      portrait.onerror = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const tracker = trackerRef.current;
      trackerRef.current = null;
      trackerPromiseRef.current = null;
      if (tracker) void tracker.close().catch(() => undefined);
    };
  }, [ensureTracker, sendFrame, stopCamera]);

  useEffect(() => {
    const image = new Image();
    let current = true;
    accessoryRef.current = null;
    loadedAccessoryRef.current = '';
    renderedAccessoryRef.current = '';
    setAccessoryReady(false);
    image.onload = () => {
      if (current) {
        accessoryRef.current = image;
        loadedAccessoryRef.current = selected.image;
        setAccessoryReady(true);
      }
    };
    image.onerror = () => {
      if (current)
        errorCallbackRef.current('This piece could not load. Please select another piece.');
    };
    image.src = selected.image;
    return () => {
      current = false;
    };
  }, [selected.image]);

  const startCamera = async () => {
    if (starting) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      errorCallbackRef.current(
        'Camera access needs a secure HTTPS page or localhost. The demo photo is available here.',
      );
      return;
    }
    const request = ++cameraRequestRef.current;
    setStarting(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1200 } },
        audio: false,
      });
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('The mirror is no longer open.');
      video.srcObject = stream;
      await video.play();
      await ensureTracker();
      if (request !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      modeRef.current = 'camera';
      sourceGenerationRef.current += 1;
      faceRef.current = null;
      setTracked(false);
      mirroredRef.current = true;
      setMirrored(true);
      setMode('camera');
      stream.getVideoTracks()[0]?.addEventListener('ended', stopCamera, { once: true });
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (request === cameraRequestRef.current) {
        stopCamera();
        errorCallbackRef.current(cameraError(error));
      }
    } finally {
      if (request === cameraRequestRef.current) setStarting(false);
    }
  };

  const capture = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || (!imageReady && mode !== 'camera')) return;
    if (
      loadedAccessoryRef.current !== selected.image ||
      (faceRef.current && renderedAccessoryRef.current !== selected.image)
    ) {
      errorCallbackRef.current('Your pair is still loading. Try your snapshot again in a moment.');
      return;
    }
    try {
      // Match the visible object-fit crop, including landscape camera streams.
      const bounds = canvas.getBoundingClientRect();
      const fit = Math.max(bounds.width / canvas.width, bounds.height / canvas.height);
      const cropWidth = bounds.width / fit;
      const cropHeight = bounds.height / fit;
      const position = getComputedStyle(canvas)
        .objectPosition.split(' ')
        .map((value) => parseFloat(value) / 100);
      const snapshot = document.createElement('canvas');
      snapshot.width = Math.round(cropWidth);
      snapshot.height = Math.round(cropHeight);
      const context = snapshot.getContext('2d');
      if (!context) throw new Error('Snapshot canvas unavailable.');
      context.drawImage(
        canvas,
        (canvas.width - cropWidth) * (position[0] || 0.5),
        (canvas.height - cropHeight) * (position[1] || 0.5),
        cropWidth,
        cropHeight,
        0,
        0,
        snapshot.width,
        snapshot.height,
      );
      onCapture(snapshot.toDataURL('image/jpeg', 0.92));
    } catch {
      errorCallbackRef.current('The snapshot could not be saved. Please try again.');
    }
  };

  return (
    <div className={`mirror-frame${mode === 'camera' ? ' is-live' : ''}`}>
      <video ref={videoRef} muted playsInline aria-hidden="true" style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        className="mirror-canvas"
        aria-label={`${selected.name} ${mode === 'camera' ? 'live camera try-on' : 'demo try-on preview'}`}
      />
      {!imageReady && mode === 'demo' && (
        <div className="mirror-loading">
          <LoaderCircle className="spin" size={26} />
          <span>Preparing your mirror</span>
        </div>
      )}
      <div className="mirror-topbar">
        <span className="mirror-status">
          <span className={`status-dot${mode === 'camera' ? ' live' : ''}`} />
          {mode === 'camera' ? 'Live camera' : 'Demo photo'}
        </span>
        <div className="mirror-tools">
          <button
            type="button"
            className="mirror-icon-button"
            aria-label="Flip mirror"
            aria-pressed={mirrored}
            title="Flip mirror"
            onClick={() => {
              mirroredRef.current = !mirroredRef.current;
              setMirrored(mirroredRef.current);
            }}
          >
            <FlipHorizontal2 size={18} />
          </button>
        </div>
      </div>
      <div className="mirror-bottom">
        <div className="tracking-status" role="status">
          <ScanFace size={15} />
          {starting || loadingTracker
            ? 'Preparing face tracking'
            : tracked
              ? 'Face tracked'
              : mode === 'camera'
                ? 'Bring your face into view'
                : 'Demo preview · camera off'}
        </div>
        <div className="mirror-controls">
          <button
            type="button"
            className="camera-button"
            onClick={mode === 'camera' ? stopCamera : () => void startCamera()}
            disabled={starting}
          >
            {starting ? (
              <LoaderCircle size={17} className="spin" />
            ) : mode === 'camera' ? (
              <CameraOff size={17} />
            ) : (
              <Camera size={17} />
            )}
            {starting ? 'Starting camera…' : mode === 'camera' ? 'Stop camera' : 'Start camera'}
          </button>
          <button
            type="button"
            className="snapshot-button"
            aria-label="Save snapshot"
            title="Save snapshot"
            onClick={capture}
            disabled={(!imageReady && mode !== 'camera') || !accessoryReady}
          >
            <Camera size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}
