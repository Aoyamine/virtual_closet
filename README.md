# Forme — virtual fitting room

A working browser prototype of the accessories try-on plan: choose eyewear, start your camera, and see the frames follow your face. A generated demo portrait makes the complete experience usable without granting camera access.

## Run locally

Use Node.js 24 (see `.nvmrc`; minimum 22.12) and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The development server listens on port 5173. Camera access requires **HTTPS or localhost**; a plain HTTP remote IP cannot request camera permission. If camera permission is unavailable, the demo photo, uploads, adjustments, and snapshots still work.

`npm ci` copies the pinned MediaPipe package's model/WASM assets to `public/mediapipe`. These generated files are ignored by Git and included in the production build. Fonts, sample frames, and the demo photo are also served locally. No API keys, external model downloads at runtime, account, or backend are needed.

## Try the prototype

1. Choose one of six original frames in **The edit**, or use **Upload a piece** to add your own front-facing product image.
2. Try the demo or select **Start camera**. Allow camera access and face the camera. When no face is visible, frames are hidden rather than attached to an invented position.
3. Adjust size, height, or tilt. Flip the mirror or reset adjustments when needed.
4. Select the camera icon to save a snapshot. **Saved looks** supports download and deletion; snapshots match the visible mirror crop.
5. Use **My collection** to revisit or remove uploads. Reload the page to check persistence.

Uploads accept PNG, JPEG, and WebP up to 10 MB. Images are validated, resized to at most 1200 px, and optionally have light neutral background pixels connected to the image border removed. Transparent PNGs give the best results. This simple background cleanup is not a general segmentation model; busy backgrounds and white regions enclosed by the frames may need preparation in an image editor.

Camera frames, uploads, and snapshots stay on the device. Camera tracks stop when you stop the mirror, navigate to another view, or leave the page. Uploaded pieces and saved JPEGs persist in this browser's local storage, subject to its storage limit; they do not sync across devices. Clearing site data removes them.

## Validate

```sh
npm test             # Image preparation and storage tests
npm run build        # Strict TypeScript check and production build
npm run test:e2e     # Real Chromium integration tests
```

The browser tests load the actual local face model, verify rendered pixels change, exercise uploads and persisted snapshots, and check camera denial, media stream cleanup, and the phone layout. They use system Chromium when available, or Playwright Chromium otherwise. To install the latter on another machine, run `npx playwright install --with-deps chromium`. `CHROMIUM_PATH` can select an existing Chromium executable. Camera tests use synthetic browser devices, so no personal camera is needed.

## Production / HTTPS testing

```sh
npm ci
npm run build
npm run preview
```

Deploy the contents of `dist/` to a static host at the domain root, served over HTTPS. Include the `mediapipe/` directory and preserve `.wasm` and `.data` files; `application/wasm` is the recommended WASM MIME type. Allow same-origin camera access if your host sets a Permissions Policy. Embedded testing additionally requires the parent frame to grant camera permission.

The repository does not provision a public domain or hosting account. A `.chatgpt` testing domain would need to be supplied by the hosting product; running Vite alone does not create one. `npm run preview` validates the built site locally and is not a production hosting service.

## Scope and structure

This first milestone is a **front-facing 2D eyewear preview**, using MediaPipe Face Mesh for local landmark tracking and Canvas 2D for compositing. Scale, rotation, and eye placement follow the detected face with smoothing. It does not estimate physical fit, reconstruct hidden sides, render 3D assets, handle occlusion, or try on clothing. The renderer and tracking modules are separated so 3D assets or additional trackers can be introduced later.

| Location                    | Responsibility                                     |
| --------------------------- | -------------------------------------------------- |
| `src/App.tsx`               | Fitting room, collection, upload flow, saved looks |
| `src/components/Mirror.tsx` | Camera lifecycle, frame loop, demo, snapshots      |
| `src/lib/tracking.ts`       | Local MediaPipe inference and landmark smoothing   |
| `src/lib/render.ts`         | Accessory positioning and canvas rendering         |
| `src/lib/images.ts`         | Upload validation and background preparation       |
| `src/lib/storage.ts`        | Typed local persistence and storage errors         |
| `public/accessories/`       | Six original transparent SVG frame assets          |
| `tests/prototype.spec.ts`   | End-to-end browser validation                      |

The demo portrait was generated for this prototype; the eyewear SVGs are original illustrations. MediaPipe is an Apache-2.0 dependency. DM Sans and Newsreader are locally bundled through Fontsource under the SIL Open Font License. The project license is in `LICENSE`.
