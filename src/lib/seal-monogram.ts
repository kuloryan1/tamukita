export const SEAL_MONOGRAM_PATTERN = /^[A-Za-z]{0,3}$/;

export function normalizeSealMonogram(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)
    : "";
}

export function resolveSealMonogram(value: unknown, names: readonly string[]) {
  return normalizeSealMonogram(value)
    || normalizeSealMonogram(names.map((name) => name.trim().charAt(0)).join(""))
    || "TK";
}
