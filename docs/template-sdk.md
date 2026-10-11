# Template SDK dan Smart Form

Setiap versi template menyimpan manifest dan schema form sebagai snapshot dengan kompatibilitas Template SDK `1.1.0`. Editor menggunakan schema versi yang sedang dipilih untuk membangun field; draft tetap menyimpan field dasar undangan dan nilai tambahan pada `customFields`.

## Field dasar dan tambahan

Schema wajib menyediakan section `identity`, `schedule`, dan `media` serta field standar TamuKita. Schema boleh menambahkan sampai 5 section lain dan field dengan tipe `text`, `textarea`, `datetime`, `time`, atau `url`. Properti opsional `required`, `placeholder`, `helpText`, `maxLength`, dan `defaultValue` mengatur input tanpa membuat editor baru. Field teks dibatasi 500 karakter secara default dan dapat dinaikkan sampai 1.000 karakter.

```ts
{
  key: "dressCode",
  type: "text",
  label: "Dress code",
  placeholder: "Contoh: pakaian bernuansa sage",
  helpText: "Informasi ini tampil di undangan publik.",
  maxLength: 120,
  defaultValue: "",
}
```

Field tambahan dapat ditempatkan dalam section baru. Editor menampilkan section `identity` pada langkah acara, `media` pada langkah foto, dan section lain pada langkah detail. Nilai tambahannya disimpan sebagai `draft.customFields.dressCode`. Renderer React template dapat membacanya dari prop draft. Renderer manifest terkurasi menampilkan field schema yang terisi secara otomatis.

Contoh akses di renderer:

```tsx
{draft.customFields.dressCode && <p>{draft.customFields.dressCode}</p>}
```

Template boleh memberi `defaultValue` untuk field tambahan. Default hanya mengisi field yang belum mempunyai nilai, sehingga draft yang sudah diedit tetap dipertahankan ketika pelanggan berganti template.

## Validasi dan media

Schema dibatasi sampai 8 section dan 64 field; jumlah field tambahannya maksimal 32. Server membatasi panjang nilai per field menjadi 1.000 karakter serta total data schema menjadi 20 KB. Saat pelanggan menerbitkan undangan atau reseller mengaktifkannya, server memvalidasi field wajib, panjang nilai, tanggal kalender, format waktu, dan tautan HTTPS berdasarkan schema versi template.

Slot gambar saat ini menggunakan field `coverPhoto` di section `media`. Slot ini menggunakan alur upload privat, crop, pemrosesan worker, dan validasi kepemilikan aset yang sama dengan editor foto. Field gambar tambahan belum diterima sampai pipeline aset dan metadata slot mendukung banyak slot secara aman.

## Versioning

Setiap versi schema disimpan pada `TemplateVersion.manifest` bersama versi SDK. Perubahan schema harus menaikkan semver template. Undangan terbit menyimpan snapshot data form, dan versi template lama tetap tersedia bagi undangan yang menggunakannya.
