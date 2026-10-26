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

1. Akun pembuat, pembeli, reseller, dan pengembang dibatasi untuk orang berusia 18 tahun ke atas tanpa mengumpulkan tanggal lahir. Pendaftaran dan alur onboarding/reset meminta pernyataan usia; akun tanpa catatan tidak dapat login. Form RSVP/ucapan meminta persetujuan wali saat data anak dicantumkan dan menyimpan waktu serta versi persetujuan. Implementasi fitur usia/consent pertama kali dideploy pada `52fd1d8`; staging kini memakai `f510dcb`. [CI #40412836255](https://github.com/kuloryan1/tamukita/actions/runs/40412836255) dan [E2E #40412836317](https://github.com/kuloryan1/tamukita/actions/runs/40412836317) lulus (67 lulus, 2 dilewati) dan mencakup consent RSVP/guestbook sintetis serta keyboard dialog. QA visual staging memeriksa deklarasi usia wajib, persetujuan wali kondisional, dan pemblokiran submit tanpa consent; tidak ada data dikirim ke API. Legal review tetap perlu mengesahkan isi dan kecukupan kontrol.
2. Retensi awal: data undangan aktif selama layanan aktif; data RSVP/kontak tamu sampai 90 hari setelah tanggal acara atau 30 hari setelah hosting berakhir (mana yang lebih akhir); media 30 hari setelah hosting berakhir/penghapusan; draft tidak aktif 12 bulan; laporan dan audit 12 bulan; backup 30 hari. Data transaksi ditahan hanya selama diwajibkan aturan akuntansi/pajak/sengketa. Semua masa ini belum boleh dijanjikan sebelum purge dan pengecualiannya terimplementasi.
3. Refund sukarela 7 hari untuk lisensi yang belum dipakai dan undangan yang belum diterbitkan; pembayaran ganda dikembalikan penuh; kegagalan layanan mengikuti perbaikan/penggantian atau refund sesuai draf; kredit reseller berbayar tak kedaluwarsa dan unit utuh yang belum dipakai dapat diminta kembali.
4. Vendor terpilih untuk target produksi: Cloudflare (DNS/Tunnel/R2), Dokploy-managed VPS (aplikasi, worker, PostgreSQL, Redis), Xendit (pembayaran/refund), Resend (email), dan GitHub Actions (CI). Target penyimpanan media produksi adalah Asia-Pacific. Lokasi fisik VPS dan lokasi/retensi vendor lain belum dibuktikan.
5. UX yang sekarang ada diterima sebagai baseline MVP berdasarkan alur aplikasi dan bukti E2E staging yang tersedia; tidak ada file prototype/Figma terpisah yang ditemukan. Ini bukan bukti bahwa flow telah lulus uji publik produksi.
6. Nama tampilan yang dipilih adalah **TamuKita by Tigakaki**, sesuai atribusi UI yang sudah ada. Alamat bersama yang dipilih untuk support/refund adalah `bantuan@tamukita.io`; alias `privasi@tamukita.io` dan `keamanan@tamukita.io` diarahkan ke inbox yang sama dengan petugas akses terbatas. Alamat belum dibuat atau diuji, jadi belum boleh dipublikasikan.

## Gate yang tidak dapat ditentukan dari repository

1. Nama badan hukum/operator, alamat, nomor registrasi/izin yang perlu dicantumkan, dan siapa yang menerima pembayaran. `TamuKita by Tigakaki` adalah nama tampilan yang dipilih, bukan bukti nama legal operator.
2. Alias email yang dipilih (`bantuan@`, `privasi@`, `keamanan@tamukita.io`) harus dibuat, diuji, dipantau, dan dialokasikan ke petugas sebelum dipublikasikan.
3. Bukti apakah penilaian mandiri pelindungan anak telah dilaporkan. Tenggat awal tiga bulan pada aturan pelaksana telah lewat; pemilik dan penasihat hukum harus memastikan status serta langkah koreksi yang berlaku.
4. Penasihat hukum Indonesia untuk meninjau model transaksi, peran pengendali/pemroses, pelindungan anak, pajak/refund, perizinan/PSE, transfer lintas negara, lisensi aset, dan naskah publik.
5. Bukti region hosting/database, kontrak pemrosesan, daftar subprosesor, dan retensi aktual Xendit, Resend, Cloudflare, serta VPS.
6. Pemilik operasional yang sanggup menangani permintaan data dalam tenggat UU PDP, laporan konten/anak, refund, dan insiden.

## Catatan implementasi

- Checkout mengaktifkan layanan setelah webhook pembayaran Xendit tervalidasi. Sistem memisahkan lisensi template, biaya aktivasi, dan masa hosting; pengaturan harga dan masa hosting dapat berubah melalui admin.
- Masa hosting default saat ini 365 hari, tetapi nilainya dapat diatur. Jangan menuliskan angka ini sebagai janji tetap sebelum operator memutuskan kebijakan komersial.
- Admin dapat mengajukan refund penuh/sebagian melalui Xendit. Status akhir bergantung pada webhook penyedia. Refund top-up reseller hanya dapat mengambil kredit utuh yang belum dipakai dari lot top-up asal.
- Aplikasi belum menyediakan penghapusan akun mandiri atau jadwal purge untuk semua kategori data. Dokumen publik tidak boleh menjanjikan otomatisasi tersebut sebelum mekanisme operasional/teknis tersedia.
- Pelanggan dapat memasukkan data tamu dan menerbitkan undangan publik. Pembagian peran pengendali/pemroses data perlu ditetapkan dan ditinjau secara hukum berdasarkan alur nyata, bukan hanya label dalam draf ini.
- Nilai retensi pada draf adalah keputusan internal untuk memandu implementasi. Fitur purge, rotasi backup, permintaan subjek data, dan penghapusan provider belum dibuktikan pada produksi.

