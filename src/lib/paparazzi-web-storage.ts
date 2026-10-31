import "server-only";
import { getR2Client, getR2Config } from "./r2";
import { ensurePaparazziDirectory } from "./paparazzi-server-files";
import { paparazziStorage, paparazziStorageProvider, type PaparazziProvider } from "./paparazzi-storage";

export async function ensurePaparazziStorage(provider = paparazziStorageProvider()) {
  if (provider === "SERVER") await ensurePaparazziDirectory();
  else if (!getR2Config()) throw new Error("Penyimpanan R2 foto belum tersedia.");
  return provider;
}

export function paparazziWebStore(provider: PaparazziProvider, signal?: AbortSignal) {
  if (provider === "SERVER") return paparazziStorage(provider, null, undefined, signal);
  const config = getR2Config();
  if (!config) throw new Error("Penyimpanan R2 foto belum tersedia.");
  return paparazziStorage(provider, getR2Client(), config.privateBucket, signal);
}
