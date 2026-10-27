# Dokumen hukum dan kebijakan TamuKita

**Status: DRAF INTERNAL — belum untuk dipublikasikan atau dijadikan syarat transaksi.** Atas arahan pemilik produk pada 26 Oktober 2026, keputusan default operasional sudah ditulis ke draf privasi, refund, syarat layanan, dan lembar kerja pelindungan anak. Draf tetap belum boleh dipublikasikan sebelum fakta badan usaha/kontak diverifikasi, kontrol retensi dan kanal dijalankan, status pelaporan anak dikonfirmasi, dan penasihat hukum Indonesia meninjau seluruh dokumen.

## Dokumen

- [Pemberitahuan Privasi](./PRIVACY.md)
- [Syarat Layanan](./TERMS.md)
- [Kebijakan Refund](./REFUNDS.md)
- [Lisensi Template dan Unggahan](./TEMPLATE-AND-MEDIA-LICENSE.md)
- [Checklist Legal dan Privasi Peluncuran](./LAUNCH-CHECKLIST.md)
- [Lembar Kerja Penilaian Pelindungan Anak](./CHILD-SAFETY-ASSESSMENT.md)

## Keputusan yang sudah ditetapkan sebagai default internal

1. Akun pembuat, pembeli, reseller, dan pengembang dibatasi untuk orang berusia 18 tahun ke atas tanpa mengumpulkan tanggal lahir. Pendaftaran dan alur onboarding/reset meminta pernyataan usia; akun tanpa catatan tidak dapat login. Form RSVP/ucapan meminta persetujuan wali saat data anak dicantumkan dan menyimpan waktu serta versi persetujuan. Source staging yang diverifikasi 27 Oktober 2026 adalah `582ce25` (`582ce254fbcc919ee0888fd4647cf2a6820bd313`); [CI #40434776428](https://github.com/kuloryan1/tamukita/actions/runs/40434776428) dan [E2E #40434776395](https://github.com/kuloryan1/tamukita/actions/runs/40434776395) lulus (67 lulus, 2 dilewati). QA post-deploy memeriksa formulir consent dan validasinya secara visual tanpa mengirim data. Legal review tetap perlu mengesahkan isi dan kecukupan kontrol.
2. Retensi awal: data undangan aktif selama layanan aktif; data RSVP/kontak tamu sampai 90 hari setelah tanggal acara atau 30 hari setelah hosting berakhir (mana yang lebih akhir); media 30 hari setelah hosting berakhir/penghapusan; draft tidak aktif 12 bulan; laporan dan audit 12 bulan; backup 30 hari. Data transaksi ditahan hanya selama diwajibkan aturan akuntansi/pajak/sengketa. Semua masa ini belum boleh dijanjikan sebelum purge dan pengecualiannya terimplementasi.
3. Refund sukarela 7 hari untuk lisensi yang belum dipakai dan undangan yang belum diterbitkan; pembayaran ganda dikembalikan penuh; kegagalan layanan mengikuti perbaikan/penggantian atau refund sesuai draf; kredit reseller berbayar tak kedaluwarsa dan unit utuh yang belum dipakai dapat diminta kembali.
4. Vendor terpilih untuk target produksi: Cloudflare (DNS/Tunnel/R2), Dokploy-managed VPS (aplikasi, worker, PostgreSQL, Redis), Xendit (pembayaran/refund), Resend (email), dan GitHub Actions (CI). Target penyimpanan media produksi adalah Asia-Pacific. Lokasi fisik VPS dan lokasi/retensi vendor lain belum dibuktikan.
5. UX yang sekarang ada diterima sebagai baseline MVP berdasarkan alur aplikasi dan bukti E2E staging yang tersedia; tidak ada file prototype/Figma terpisah yang ditemukan. Ini bukan bukti bahwa flow telah lulus uji publik produksi.
6. Nama tampilan yang dipilih adalah **TamuKita by Tigakaki**, sesuai atribusi UI yang sudah ada. Alias `bantuan@tamukita.io`, `privasi@tamukita.io`, dan `keamanan@tamukita.io` adalah usulan alamat operasional; alamat, inbox penerima, petugas, dan uji kirim/terima belum diverifikasi, jadi jangan publikasikan sebagai kontak aktif.

## Gate yang tidak dapat ditentukan dari repository

1. Nama badan hukum/operator, alamat, nomor registrasi/izin yang perlu dicantumkan, dan siapa yang menerima pembayaran. `TamuKita by Tigakaki` adalah nama tampilan yang dipilih, bukan bukti nama legal operator.
2. Alias email usulan (`bantuan@`, `privasi@`, `keamanan@tamukita.io`) harus dibuat, diuji, dipantau, dan dialokasikan ke petugas sebelum dipublikasikan.
3. Bukti apakah penilaian mandiri pelindungan anak telah dilaporkan belum diberikan. JDIH mencatat aturan pelaksana berlaku dan tenggat awal tiga bulan telah lewat; operator/penasihat hukum harus memastikan cakupan, status filing, dan tindak lanjut yang berlaku.
4. Penasihat hukum Indonesia untuk meninjau model transaksi, peran pengendali/pemroses, pelindungan anak, pajak/refund, perizinan/PSE, transfer lintas negara, lisensi aset, dan naskah publik.
5. Bukti region hosting/database, kontrak pemrosesan, daftar subprosesor, dan retensi aktual Xendit, Resend, Cloudflare, serta VPS.
6. Pemilik operasional yang sanggup menangani permintaan data dalam tenggat UU PDP, laporan konten/anak, refund, dan insiden.

### Status bukti fakta per 27 Oktober 2026

Rincian faktual berikut belum diberikan atau diverifikasi dalam repo/percakapan kerja; tandai sebagai **belum tersedia**, bukan menyimpulkan bahwa badan usaha, inbox, atau filing tidak ada:

| Fakta yang dibutuhkan | Status bukti |
|---|---|
| Nama badan usaha/operator, alamat, nomor OSS/PSE, dan penerima pembayaran | Belum tersedia. |
| Inbox support/privacy/security yang aktif, petugas pemilik, serta jadwal on-call | Belum tersedia. Alias dalam draf hanyalah usulan; belum diuji. |
| Penasihat hukum Indonesia | Belum tersedia. |
| Penilaian mandiri dan bukti/tanggal filing PP TUNAS | Belum tersedia; jangan menganggap sudah atau belum pernah diajukan sebelum operator mengonfirmasi. |

## Catatan implementasi

- Checkout mengaktifkan layanan setelah webhook pembayaran Xendit tervalidasi. Sistem memisahkan lisensi template, biaya aktivasi, dan masa hosting; pengaturan harga dan masa hosting dapat berubah melalui admin.
- Masa hosting default saat ini 365 hari, tetapi nilainya dapat diatur. Jangan menuliskan angka ini sebagai janji tetap sebelum operator memutuskan kebijakan komersial.
- Admin dapat mengajukan refund penuh/sebagian melalui Xendit. Status akhir bergantung pada webhook penyedia. Refund top-up reseller hanya dapat mengambil kredit utuh yang belum dipakai dari lot top-up asal.
- Aplikasi belum menyediakan penghapusan akun mandiri atau jadwal purge untuk semua kategori data. Dokumen publik tidak boleh menjanjikan otomatisasi tersebut sebelum mekanisme operasional/teknis tersedia.
- Pelanggan dapat memasukkan data tamu dan menerbitkan undangan publik. Pembagian peran pengendali/pemroses data perlu ditetapkan dan ditinjau secara hukum berdasarkan alur nyata, bukan hanya label dalam draf ini.
- Nilai retensi pada draf adalah keputusan internal untuk memandu implementasi. Fitur purge, rotasi backup, permintaan subjek data, dan penghapusan provider belum dibuktikan pada produksi.

