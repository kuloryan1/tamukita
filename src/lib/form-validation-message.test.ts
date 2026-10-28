import { describe, expect, it } from "vitest";
import { getIndonesianFormValidationMessage } from "@/lib/form-validation-message";

const valid = {
  patternMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valueMissing: false,
};

describe("getIndonesianFormValidationMessage", () => {
  it("names a missing required field in Indonesian", () => {
    expect(getIndonesianFormValidationMessage({
      name: "name",
      type: "text",
      label: "Nama lengkap",
      minLength: 2,
      validity: { ...valid, valueMissing: true },
    })).toBe("Nama lengkap wajib diisi.");
  });

  it("explains an invalid email format in Indonesian", () => {
    expect(getIndonesianFormValidationMessage({
      name: "email",
      type: "email",
      label: "Alamat email",
      minLength: -1,
      validity: { ...valid, typeMismatch: true },
    })).toBe("Masukkan alamat email dengan format yang benar.");
  });

  it("explains the required guardian consent", () => {
    expect(getIndonesianFormValidationMessage({
      name: "guardianConsent",
      type: "checkbox",
      label: "",
      minLength: -1,
      validity: { ...valid, valueMissing: true },
    })).toBe("Persetujuan orang tua/wali wajib sebelum mengirim data anak.");
  });

  it("explains the required adult attestation", () => {
    expect(getIndonesianFormValidationMessage({
      name: "adultAttested",
      type: "checkbox",
      label: "",
      minLength: -1,
      validity: { ...valid, valueMissing: true },
    })).toBe("Centang pernyataan usia sebelum membuat akun.");
  });
});
