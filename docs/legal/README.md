# Dokumen hukum dan kebijakan TamuKita

**Status: DRAF INTERNAL — belum untuk dipublikasikan atau dijadikan syarat transaksi.** Draf ini disusun dari fitur yang saat ini ada di aplikasi. Bagian dalam tanda kurung siku harus diisi oleh operator, lalu seluruh dokumen ditinjau penasihat hukum Indonesia sebelum peluncuran.

## Dokumen

- [Pemberitahuan Privasi](./PRIVACY.md)
- [Syarat Layanan](./TERMS.md)
- [Kebijakan Refund](./REFUNDS.md)
- [Lisensi Template dan Unggahan](./TEMPLATE-AND-MEDIA-LICENSE.md)
- [Checklist Legal dan Privasi Peluncuran](./LAUNCH-CHECKLIST.md)
- [Lembar Kerja Penilaian Pelindungan Anak](./CHILD-SAFETY-ASSESSMENT.md)

## Keputusan operator yang masih dibutuhkan

1. Nama badan hukum/operator, alamat usaha, nomor registrasi yang perlu dicantumkan, dan email dukungan/pengaduan.
2. Kontak khusus permintaan privasi dan prosedur verifikasi pemohon.
3. Jadwal retensi untuk akun, undangan, data tamu, laporan moderasi, pembayaran/audit, log, dan backup; prosedur penghapusan serta pengecualian retensi yang diwajibkan hukum.
4. Ketentuan refund per produk/komponen dan batas waktu penanganan permintaan/pengaduan.
5. Kebijakan akun anak, usia minimum pembuat undangan, dan penanganan data tamu anak.
6. Klasifikasi produk/fitur dan status penilaian/pelaporan pelindungan anak berdasarkan PP 17/2025 dan Permenkomdigi 9/2026.
7. Identitas vendor produksi, lokasi pemrosesan/penyimpanan, transfer lintas negara, dan masa retensi masing-masing vendor.
8. Cakupan lisensi template, musik/font/aset pihak ketiga, persetujuan penggunaan foto, dan mekanisme keberatan/takedown.

## Catatan implementasi

- Checkout mengaktifkan layanan setelah webhook pembayaran Xendit tervalidasi. Sistem memisahkan lisensi template, biaya aktivasi, dan masa hosting; pengaturan harga dan masa hosting dapat berubah melalui admin.
- Masa hosting default saat ini 365 hari, tetapi nilainya dapat diatur. Jangan menuliskan angka ini sebagai janji tetap sebelum operator memutuskan kebijakan komersial.
- Admin dapat mengajukan refund penuh/sebagian melalui Xendit. Status akhir bergantung pada webhook penyedia. Refund top-up reseller hanya dapat mengambil kredit utuh yang belum dipakai dari lot top-up asal.
- Aplikasi belum menyediakan penghapusan akun mandiri atau jadwal purge untuk semua kategori data. Dokumen publik tidak boleh menjanjikan otomatisasi tersebut sebelum mekanisme operasional/teknis tersedia.
- Pelanggan dapat memasukkan data tamu dan menerbitkan undangan publik. Pembagian peran pengendali/pemroses data perlu ditetapkan dan ditinjau secara hukum berdasarkan alur nyata, bukan hanya label dalam draf ini.

