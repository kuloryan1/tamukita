type FieldValidity = Pick<ValidityState, "patternMismatch" | "tooLong" | "tooShort" | "typeMismatch" | "valueMissing">;

type FormFieldDetails = {
  name: string;
  type: string;
  label: string;
  minLength: number;
  validity: FieldValidity;
};

export function getIndonesianFormValidationMessage(field: FormFieldDetails): string {
  if (field.type === "checkbox" && field.name === "adultAttested") {
    return "Centang pernyataan usia sebelum membuat akun.";
  }
  if (field.type === "checkbox" && field.name === "guardianConsent") {
    return "Persetujuan orang tua/wali wajib sebelum mengirim data anak.";
  }
  if (field.type === "checkbox") return "Centang persetujuan sebelum melanjutkan.";
  if (field.validity.valueMissing) {
    const label = field.label.trim();
    return label ? `${label} wajib diisi.` : "Lengkapi kolom wajib ini.";
  }
  if (field.validity.typeMismatch && field.type === "email") {
    return "Masukkan alamat email dengan format yang benar.";
  }
  if (field.validity.tooShort && field.minLength > 0) {
    return `Isi minimal ${field.minLength} karakter.`;
  }
  if (field.validity.tooLong) return "Isian terlalu panjang. Persingkat sebelum melanjutkan.";
  if (field.validity.patternMismatch) return "Periksa kembali format isian ini.";
  return "Periksa kembali isian sebelum melanjutkan.";
}

export function getFirstInvalidFormMessage(form: HTMLFormElement): string {
  const field = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(":invalid");
  if (!field) return "Periksa kembali isian sebelum melanjutkan.";

  const label = field.labels?.[0]?.querySelector(".field-label")?.textContent?.trim()
    || field.labels?.[0]?.textContent?.trim()
    || "";
  const minLength = "minLength" in field ? field.minLength : -1;

  return getIndonesianFormValidationMessage({
    name: field.name,
    type: field.type,
    label,
    minLength,
    validity: field.validity,
  });
}
