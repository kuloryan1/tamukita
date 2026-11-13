import { fileURLToPath } from "node:url";
import sharp, { type OverlayOptions, type Sharp } from "sharp";
import { PAPARAZZI_STORY_HEIGHT, PAPARAZZI_STORY_WIDTH } from "./paparazzi";

export const PAPARAZZI_STORY_LAYOUT_VERSION = 4;
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
    data[index + 3] = Math.round(Math.min(255, Math.max(0, (data[index + 3] - 7) * 3)) * .92);
  }
  return { input: data, raw: { width: info.width, height: info.height, channels: 4 as const } };
}

function storyBackground(light: boolean) {
  return light ? "#f9f6ee" : "#17201c";
}

async function storyStamp(): Promise<OverlayOptions[]> {
  const logo = await monochromeLogo(255);
  return [{
    ...logo,
    left: Math.floor((PAPARAZZI_STORY_WIDTH - logoSize) / 2),
    top: Math.floor(stampCenterY - logoSize / 2),
    blend: "difference",
  }];
}

export async function extractLegacyPaparazziStoryPhoto(image: Sharp) {
  // Version 3 stored the photo inside a 1080 × 1600 area and filled the rest with a matte.
  const [red, green, blue] = await image.clone().extract({ left: 0, top: PAPARAZZI_STORY_HEIGHT - 1, width: 1, height: 1 })
    .toColourspace("srgb").removeAlpha().raw().toBuffer();
  const light = .2126 * red + .7152 * green + .0722 * blue >= 145;
  return image.clone()
    .extract({ left: 0, top: 0, width: PAPARAZZI_STORY_WIDTH, height: photoAreaHeight })
    .trim({ background: storyBackground(light), threshold: 8 });
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
  const stamp = await storyStamp();
  return image.clone().rotate()
    .resize({ width: PAPARAZZI_STORY_WIDTH, height: PAPARAZZI_STORY_HEIGHT, fit: "cover", position: "centre" })
    .toColourspace("srgb")
    .composite(stamp)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
}
