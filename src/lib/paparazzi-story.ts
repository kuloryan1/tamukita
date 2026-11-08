import { fileURLToPath } from "node:url";
import sharp, { type OverlayOptions, type Sharp } from "sharp";
import { PAPARAZZI_STORY_HEIGHT, PAPARAZZI_STORY_WIDTH } from "./paparazzi";

export const PAPARAZZI_STORY_LAYOUT_VERSION = 3;
const logoPath = fileURLToPath(new URL("../../public/images/paparazi/wr-crest.png", import.meta.url));
const photoAreaHeight = 1600;
const logoSize = 144;
const stampCenterY = photoAreaHeight + (PAPARAZZI_STORY_HEIGHT - photoAreaHeight) / 2;

async function monochromeLogo(shade: number) {
  // This is the visible crest inside the supplied transparent 128 × 128 PNG.
  const { data, info } = await sharp(logoPath)
    .extract({ left: 29, top: 26, width: 77, height: 77 })
    .resize(logoSize, logoSize)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    data[index] = shade;
    data[index + 1] = shade;
    data[index + 2] = shade;
    data[index + 3] = Math.min(255, Math.max(0, (data[index + 3] - 7) * 3));
  }
  return { input: data, raw: { width: info.width, height: info.height, channels: 4 as const } };
}

function storyBackground(light: boolean) {
  return light ? "#f9f6ee" : "#17201c";
}

async function storyStamp(light: boolean): Promise<OverlayOptions[]> {
  const logo = await monochromeLogo(light ? 0 : 255);
  return [{
    ...logo,
    left: Math.floor((PAPARAZZI_STORY_WIDTH - logoSize) / 2),
    top: Math.floor(stampCenterY - logoSize / 2),
  }];
}

export async function refreshPaparazziStoryStamp(image: Sharp) {
  // The corner of the existing footer contains only its solid background.
  const [red, green, blue] = await image.clone().extract({ left: 0, top: PAPARAZZI_STORY_HEIGHT - 1, width: 1, height: 1 })
    .toColourspace("srgb").removeAlpha().raw().toBuffer();
  const light = .2126 * red + .7152 * green + .0722 * blue >= 145;
  const stamp = await storyStamp(light);
  return image.composite([
    { input: { create: {
      width: PAPARAZZI_STORY_WIDTH, height: PAPARAZZI_STORY_HEIGHT - photoAreaHeight,
      channels: 3, background: storyBackground(light),
    } }, left: 0, top: photoAreaHeight },
    ...stamp,
  ]).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });
}

export function cropLegacyPaparazziStamp(image: Sharp, width: number, height: number) {
  const oldBand = 2 * Math.max(8, Math.round(width * .026))
    + Math.max(12, Math.round(width * .028))
    + Math.max(10, Math.round(width * .021))
    + Math.max(3, Math.round(width * .008));
  if (oldBand < height * .3) image.extract({ left: 0, top: 0, width, height: height - oldBand });
  return image;
}

export async function renderPaparazziStory(image: Sharp) {
  const { data, info } = await image.rotate()
    .resize({ width: PAPARAZZI_STORY_WIDTH, height: photoAreaHeight, fit: "inside" })
    .toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const raw = { width: info.width, height: info.height, channels: 4 as const };
  const sample = await sharp(data, { raw }).resize(32, 32, { fit: "fill" }).raw().toBuffer();
  let luma = 0;
  let alpha = 0;
  for (let index = 0; index < sample.length; index += 4) {
    const weight = sample[index + 3] / 255;
    luma += weight * (.2126 * sample[index] + .7152 * sample[index + 1] + .0722 * sample[index + 2]);
    alpha += weight;
  }
  const light = alpha > 0 && luma / alpha >= 145;
  const stamp = await storyStamp(light);
  return sharp({ create: {
    width: PAPARAZZI_STORY_WIDTH,
    height: PAPARAZZI_STORY_HEIGHT,
    channels: 3,
    background: storyBackground(light),
  } }).composite([
    { input: data, raw, left: Math.floor((PAPARAZZI_STORY_WIDTH - raw.width) / 2), top: Math.floor((photoAreaHeight - raw.height) / 2) },
    ...stamp,
  ]).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });
}
