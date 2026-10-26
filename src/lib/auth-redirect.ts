const postLoginFallback = "/dashboard";
const internalUrlBase = "https://tamukita.invalid";

export function getSafePostLoginPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || [...value].some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 0x20 || codePoint === 0x7f;
  })) {
    return postLoginFallback;
  }

  try {
    const destination = new URL(value, internalUrlBase);
    const decodedPath = decodeURIComponent(destination.pathname);
    if (destination.origin !== internalUrlBase || decodedPath.startsWith("//") || decodedPath.includes("\\")) {
      return postLoginFallback;
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return postLoginFallback;
  }
}
