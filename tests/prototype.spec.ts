import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';

async function waitForDemo(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Face tracked', { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect
    .poll(() =>
      page.locator('canvas.mirror-canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width),
    )
    .toBeGreaterThan(100);
}

async function canvasFingerprint(page: Page): Promise<number> {
  return page.locator('canvas.mirror-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    for (let i = 0; i < pixels.length; i += 64) hash = ((hash << 5) - hash + pixels[i]) | 0;
    return hash;
  });
}

test('local face model tracks the demo and controls change the composited preview', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await waitForDemo(page);

  const original = await canvasFingerprint(page);
  await page.getByRole('button', { name: 'Try on The Weekender', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Try on The Weekender', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => canvasFingerprint(page)).not.toBe(original);
  const weekender = await canvasFingerprint(page);
  const size = page.getByRole('slider', { name: 'Size', exact: true });
  await size.focus();
  await size.press('End');
  await expect(size).toHaveValue('160');
  await expect.poll(() => canvasFingerprint(page)).not.toBe(weekender);
  await page.getByRole('button', { name: 'Reset adjustments', exact: true }).click();
  await expect(size).toHaveValue('100');
  await expect.poll(() => canvasFingerprint(page)).toBe(weekender);
  await page.getByRole('button', { name: 'Flip mirror', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Flip mirror', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => canvasFingerprint(page)).not.toBe(weekender);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('prototype-desktop.png'), fullPage: true });
});

test('a saved snapshot matches the mirror crop, survives reload, downloads a JPEG, and can be deleted', async ({
  page,
}) => {
  await waitForDemo(page);
  const bounds = await page.locator('canvas.mirror-canvas').boundingBox();
  const visibleAspectRatio = bounds!.width / bounds!.height;
  await page.getByRole('button', { name: 'Save snapshot', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Look saved.' })).toBeVisible();
  await page.getByRole('button', { name: 'Saved looks', exact: true }).click();
  await expect(page.getByAltText('Saved try-on wearing The Everyday')).toBeVisible();
  const savedAspectRatio = await page
    .getByAltText('Saved try-on wearing The Everyday')
    .evaluate((image: HTMLImageElement) => image.naturalWidth / image.naturalHeight);
  expect(savedAspectRatio).toBeCloseTo(visibleAspectRatio, 2);
  await page.reload();
  await page.getByRole('button', { name: 'Saved looks', exact: true }).click();
  await expect(page.getByAltText('Saved try-on wearing The Everyday')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('forme-the-everyday.jpg');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const image = Buffer.concat(chunks);
  expect(image.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  expect(image.subarray(-2).toString('hex')).toBe('ffd9');
  expect(image.length).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Delete saved look The Everyday', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your good side. Saved.' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Saved looks', exact: true }).click();
  await expect(page.getByAltText('Saved try-on wearing The Everyday')).toHaveCount(0);
});

test('uploads validate file types, prepare an image, persist it, and allow removal', async ({
  page,
}) => {
  await waitForDemo(page);
  await page.getByRole('button', { name: 'Upload a piece', exact: true }).click();
  const input = page.getByLabel('Accessory image', { exact: true });
  await input.setInputFiles({
    name: 'invalid.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toHaveText('Please choose a PNG, JPEG, or WebP image.');
  const encodedImage = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white';
    context.fillRect(0, 0, 400, 160);
    context.strokeStyle = '#442924';
    context.lineWidth = 13;
    context.strokeRect(35, 35, 135, 85);
    context.strokeRect(230, 35, 135, 85);
    context.beginPath();
    context.moveTo(170, 65);
    context.lineTo(230, 65);
    context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await input.setInputFiles({
    name: 'custom-frames.png',
    mimeType: 'image/png',
    buffer: Buffer.from(encodedImage, 'base64'),
  });
  await page
    .getByRole('textbox', { name: 'Give your pair a name', exact: true })
    .fill('My test frames');
  await page.getByRole('button', { name: 'Add to my collection', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Try on My test frames', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('button', { name: 'Your uploads', exact: false }).click();
  await expect(
    page.getByRole('button', { name: 'Try on My test frames', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try on The Everyday', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await page.getByRole('button', { name: 'Remove My test frames', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Try on My test frames', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Your uploads', exact: false }).click();
  await expect(page.getByText('Your next favorite belongs here.', { exact: true })).toBeVisible();
});

test('camera denial reports a useful error and leaves the demo usable', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Denied by test user', 'NotAllowedError'));
  });
  await waitForDemo(page);
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Camera access was blocked.');
  await expect(page.getByText('Demo photo', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start camera', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save snapshot', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Look saved.' })).toBeVisible();
});

test('a real browser media stream starts, handles no face, and stops on navigation', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as Window & { testCameraStream?: MediaStream }).testCameraStream = stream;
      return stream;
    };
  });
  await waitForDemo(page);
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByText('Live camera', { exact: true })).toBeVisible();
  await expect(page.getByText('Bring your face into view', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & { testCameraStream?: MediaStream }
          ).testCameraStream?.getVideoTracks()[0]?.readyState,
      ),
    )
    .toBe('live');
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await expect(page.getByText('Demo photo', { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & { testCameraStream?: MediaStream }
          ).testCameraStream?.getVideoTracks()[0]?.readyState,
      ),
    )
    .toBe('ended');
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByText('Live camera', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My collection', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & { testCameraStream?: MediaStream }
          ).testCameraStream?.getVideoTracks()[0]?.readyState,
      ),
    )
    .toBe('ended');
});

test('help works with the keyboard and a phone viewport has no horizontal overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForDemo(page);
  await page.getByRole('button', { name: 'How it works', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Your own little fitting room.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Try on Soft Focus', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Try on Soft Focus', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('prototype-mobile.png'), fullPage: true });
});

test('face tracking follows a real video input and renders the selected frames', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  // Build Chromium's fake-camera fixture from the bundled portrait. Encoding
  // YUV420 in JavaScript keeps this regression independent of ffmpeg and APIs.
  const encodedFrame = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/demo-portrait.png';
    await image.decode();
    const width = 320;
    const height = 400;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    const yuv = new Uint8Array((width * height * 3) / 2);
    const ySize = width * height;
    const chromaSize = ySize / 4;
    const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        yuv[y * width + x] = byte(
          16 + 0.257 * rgba[offset] + 0.504 * rgba[offset + 1] + 0.098 * rgba[offset + 2],
        );
        if (x % 2 || y % 2) continue;
        let red = 0;
        let green = 0;
        let blue = 0;
        for (const pixel of [offset, offset + 4, offset + width * 4, offset + width * 4 + 4]) {
          red += rgba[pixel] / 4;
          green += rgba[pixel + 1] / 4;
          blue += rgba[pixel + 2] / 4;
        }
        const chromaOffset = (y / 2) * (width / 2) + x / 2;
        yuv[ySize + chromaOffset] = byte(128 - 0.148 * red - 0.291 * green + 0.439 * blue);
        yuv[ySize + chromaSize + chromaOffset] = byte(
          128 + 0.439 * red - 0.368 * green - 0.071 * blue,
        );
      }
    }
    let binary = '';
    for (let i = 0; i < yuv.length; i += 16_384) {
      binary += String.fromCharCode(...yuv.subarray(i, i + 16_384));
    }
    return btoa(binary);
  });

  const directory = await mkdtemp(join(tmpdir(), 'forme-camera-'));
  const videoPath = join(directory, 'portrait.y4m');
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Buffer.from(encodedFrame, 'base64')]);
  await writeFile(
    videoPath,
    Buffer.concat([
      Buffer.from('YUV4MPEG2 W320 H400 F10:1 Ip A1:1 C420jpeg\n'),
      ...Array.from({ length: 20 }, () => frame),
    ]),
  );

  const launchOptions = testInfo.project.use.launchOptions;
  const browser = await chromium.launch({
    ...launchOptions,
    args: [...(launchOptions?.args || []), `--use-file-for-fake-video-capture=${videoPath}`],
  });
  try {
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    await context.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await original(constraints);
        (window as Window & { testCameraStream?: MediaStream }).testCameraStream = stream;
        return stream;
      };
    });
    const livePage = await context.newPage();
    await waitForDemo(livePage);
    await livePage.getByRole('button', { name: 'Start camera', exact: true }).click();
    await expect(livePage.getByText('Live camera', { exact: true })).toBeVisible();
    await expect(livePage.getByText('Face tracked', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(livePage.locator('canvas')).toHaveAttribute(
      'aria-label',
      'The Everyday live camera try-on',
    );
    const original = await canvasFingerprint(livePage);
    await livePage.getByRole('button', { name: 'Try on The Weekender', exact: true }).click();
    await expect.poll(() => canvasFingerprint(livePage)).not.toBe(original);
    await expect(livePage.getByText('Face tracked', { exact: true })).toBeVisible();
    await livePage.getByRole('button', { name: 'Stop camera', exact: true }).click();
    await expect(livePage.getByText('Demo photo', { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        livePage.evaluate(
          () =>
            (
              window as Window & { testCameraStream?: MediaStream }
            ).testCameraStream?.getVideoTracks()[0]?.readyState,
        ),
      )
      .toBe('ended');
  } finally {
    await browser.close();
    await rm(directory, { recursive: true, force: true });
  }
});
