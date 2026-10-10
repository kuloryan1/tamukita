export function stripControlCharacters(value: string) {
  return value.split("").filter((character) => {
    const code = character.charCodeAt(0);
    return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
  }).join("");
}

export function containsControlCharacters(value: string) {
  return value.split("").some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
}
