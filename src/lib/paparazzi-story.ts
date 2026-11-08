import { fileURLToPath } from "node:url";
import sharp, { type OverlayOptions, type Sharp } from "sharp";
import { PAPARAZZI_STORY_HEIGHT, PAPARAZZI_STORY_WIDTH } from "./paparazzi";

export const PAPARAZZI_STORY_LAYOUT_VERSION = 2;
const logoPath = fileURLToPath(new URL("../../public/images/paparazi/wr-crest.png", import.meta.url));
const photoAreaHeight = 1600;
const logoSize = 88;
const captionGap = 24;
const stampCenterY = photoAreaHeight + 94;
const xmlEntities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

function captionSvg(handle: string, color: string) {
  const safeHandle = handle.replace(/[&<>"']/g, character => xmlEntities[character]);
  const fontSize = Math.min(42, Math.floor(930 / Math.max(handle.length, 1)));
  return Buffer.from(`<svg width="${PAPARAZZI_STORY_WIDTH}" height="80" xmlns="http://www.w3.org/2000/svg"><text x="540" y="55" text-anchor="middle" fill="${color}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="700">${safeHandle}</text></svg>`);
}

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

async function storyStamp(light: boolean, handle: string | null | undefined): Promise<OverlayOptions[]> {
  const logo = await monochromeLogo(light ? 0 : 255);
  const caption = handle ? await sharp(captionSvg(handle, light ? "#000000" : "#ffffff"))
    .trim({ background: "#00000000", threshold: 8 })
    .resize({ width: PAPARAZZI_STORY_WIDTH - logoSize - captionGap - 96, withoutEnlargement: true })
    .png().toBuffer({ resolveWithObject: true }) : null;
  const captionSpace = caption ? caption.info.width + captionGap : 0;
  const left = Math.floor((PAPARAZZI_STORY_WIDTH - captionSpace - logoSize) / 2);
  return [
    ...(caption ? [{ input: caption.data, left, top: stampCenterY - Math.floor(caption.info.height / 2) }] : []),
    { ...logo, left: left + captionSpace, top: stampCenterY - Math.floor(logoSize / 2) },
  ];
}

export async function refreshPaparazziStoryStamp(image: Sharp, handle: string | null | undefined) {
  // The corner of the existing footer contains only its solid background.
  const [red, green, blue] = await image.clone().extract({ left: 0, top: PAPARAZZI_STORY_HEIGHT - 1, width: 1, height: 1 })
    .toColourspace("srgb").removeAlpha().raw().toBuffer();
  const light = .2126 * red + .7152 * green + .0722 * blue >= 145;
  const stamp = await storyStamp(light, handle);
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

export async function renderPaparazziStory(image: Sharp, instagramHandle: string | null | undefined) {
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
  const stamp = await storyStamp(light, instagramHandle);
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
