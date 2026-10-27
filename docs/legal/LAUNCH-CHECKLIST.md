# Checklist legal dan privasi sebelum peluncuran

**Status saat ini: BELUM SIAP UNTUK PUBLIKASI.** Staging menjalankan `63d528c`; kandidat branch PR #1 `ace0e16` lulus CI #40432677407 dan E2E #40432677272, termasuk backup/restore disposable dan 67 dari 69 skenario E2E (2 skip konfigurasi pembayaran Chromium). E2E kandidat mencakup laporan ucapan dan halaman undangan, alasan laporan wajib dipilih, moderator, suspend/restore, dan audit pada database disposable. QA post-deploy staging memeriksa validasi pendaftaran/login/lupa kata sandi/RSVP/buku tamu serta consent wali mobile tanpa request tulis untuk submit yang ditolak. Fitur laporan halaman belum dideploy ke staging. Default usia, retensi, refund, vendor target, dan baseline UX sudah dicatat di draf; identitas/kontak operator, pelaksanaan kontrol pada provider nyata, status pelaporan anak, dan tinjauan penasihat hukum masih terbuka.

**Gate prioritas:** untuk perencanaan, perlakukan halaman undangan publik, RSVP, buku tamu, dan media sebagai fitur yang mungkin diakses anak. Record [JDIH BPK untuk Permenkomdigi 9/2026](https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026) mencatat status berlaku, pengundangan 6 Maret 2026, BN 2026 No. 163, dan 29 halaman; abstrak mencakup batas minimum/rentang usia, verifikasi pengguna anak, penilaian mandiri, dan desain pelindungan. PDF yang ditautkan pada record yang sama masih ber-watermark “RANCANGAN”. Operator/counsel perlu memperoleh dan memastikan teks Berita Negara final serta penerapan tepatnya sebelum memutuskan desain usia/verifikasi. Record resmi juga mencatat kewajiban pelaporan hasil penilaian awal paling lambat tiga bulan setelah diundangkan; tenggat 6 Juni 2026 telah lewat bila kewajiban berlaku bagi operator, dan bukti filing TamuKita belum ada di repository. Operator/counsel harus memastikan cakupan, status filing, dan tindakan yang berlaku sekarang. Rujukan resmi lain: [PP 17/2025](https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025), [Kepmenkomdigi 142/2026](https://jdih.komdigi.go.id/index.php/produk_hukum/view/id/1009/t/keputusan-menteri-komunikasi-dan-digital-nomor-142-tahun-2026), dan [perubahan Kepmenkomdigi 219/2026](https://jdih.komdigi.go.id/index.php/produk_hukum/view/id/1011/t/keputusan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B219%2Btahun%2B2026).

## Identitas operator dan konsumen

- [ ] Tetapkan dan buktikan nama legal operator, alamat, nomor pendaftaran/izin usaha yang relevan, serta siapa yang menerima pembayaran. Nama produk atau atribusi merek tidak cukup sebagai identitas legal.
- [ ] Validasi model transaksi default di Syarat Layanan: platform menjual lisensi template, aktivasi, hosting, dan kredit melalui Xendit; reseller bertindak berdasarkan perjanjian tertulis terpisah. Tetapkan pihak penerima pembayaran dan tanggung jawab untuk tiap item.
- [ ] Aktifkan dan uji alias yang dipilih `bantuan@tamukita.io`, `privasi@tamukita.io`, dan `keamanan@tamukita.io`; tetapkan inbox, petugas, jadwal pantau, SLA, eskalasi sengketa, dan bukti uji kirim/terima. Alias belum terbukti aktif dan jangan dipublikasikan dahulu.
- [ ] Tetapkan pemilik antrean laporan kendala editor, waktu respons yang dijanjikan, akses peran, jalur eskalasi, dan masa retensi laporan sebelum menawarkan kanal ini sebagai dukungan publik.
- [ ] Verifikasi kewajiban informasi, transaksi, dan perlindungan konsumen terhadap PP 80/2019 dan [Permendag 19/2026](https://jdih.kemendag.go.id/peraturan/peraturan-menteri-perdagangan-republik-indonesia-nomor-19-tahun-2026-tentang-penyelenggaraan-usaha-perdagangan-melalui-sistem-elektronik-1), berlaku sejak 8 Juni 2026 dan mencabut Permendag 31/2023.

## Privasi dan sistem elektronik

- [ ] Tetapkan peran operator dan pelanggan untuk tiap tujuan/data (pengendali/pemroses bila relevan), dasar pemrosesan, pemberitahuan, kontrak/instruksi, serta proses permintaan subjek data.
- [ ] Tinjau cookie analitik marketplace yang berisi tanggal UTC dan kedaluwarsa harian: tentukan dasar pemrosesan/pemberitahuan dan kebutuhan persetujuan sebelum mengaktifkannya untuk publik.
- [x] Tambahkan dukungan kode untuk sweep retensi harian: RSVP/ucapan/tautan tamu, media R2 privat/publik, token/sesi kedaluwarsa, antrean kerja selesai, laporan/feedback/grant/audit lama, bucket rate-limit, dan analitik harian. Worker hanya menjalankannya bila `DATA_RETENTION_ENABLED=true`; default masih `false`.
- [ ] Uji sweep di staging memakai data dan objek sintetis: verifikasi batas 90/30 hari, renewal tertunda, baris database, kedua bucket R2, log hasil tanpa PII, dan retry saat object storage gagal. Langkah integrasi `npm run test:data-retention` lulus pada [E2E CI #40425809477](https://github.com/kuloryan1/tamukita/actions/runs/40425809477): PostgreSQL disposable menguji pesanan pending, laporan belum selesai, penghapusan objek private/public melalui adapter sintetis, dan retry setelah gagal hapus. Unit test memeriksa deadline 90/30 hari. Ini belum membuktikan operasi sweep staging, penghapusan R2 nyata, log worker tanpa PII, atau retry vendor.
- [ ] Aktifkan retensi hanya setelah uji dan tinjauan operasional; implementasikan penghapusan akun 30 hari, purge draf + pemberitahuan, ekspor guest, log provider 90 hari, backup 30 hari, legal hold, dan transaksi sesuai masa wajib. Ekspor akun JSON tersedia di branch PR #1 dan diuji oleh E2E CI dengan akun disposable; download manual di staging belum dilakukan dan kategori lain masih belum didukung penuh.
- [ ] Tentukan masa numerik retensi transaksi bersama penasihat hukum/akuntan sebelum dokumen dipublikasikan.
- [ ] Tetapkan retensi dan proses penghapusan untuk kategori serta pesan laporan editor, termasuk penghapusan saat akun/workspace dihapus.
- [ ] Lengkapi proses ekspor/koreksi/penghapusan, verifikasi identitas, pengecualian legal hold, SLA dan bukti penyelesaian. E2E CI memeriksa ekspor akun JSON; download manual di staging belum dilakukan. Koreksi, penghapusan akun, legal hold, dan proses pemenuhan permintaan belum tersedia. Proses harus memenuhi tenggat UU PDP yang berlaku, termasuk 3×24 jam untuk hak tertentu.
- [ ] Verifikasi vendor target yang dipilih: Dokploy-managed VPS (app/worker/PostgreSQL/Redis), Cloudflare (DNS/Tunnel/R2), Xendit, Resend, dan GitHub Actions. Target region R2 produksi Asia-Pacific; bukti region VPS, subprosesor, akses admin, transfer lintas negara, kontrak pemrosesan, dan masa simpan provider masih harus didapat.
- [ ] Tetapkan prosedur insiden privasi dan keamanan, jalur eskalasi, pencatatan, penilaian dampak, dan notifikasi sesuai hukum.
- [ ] Tinjau kewajiban pendaftaran dan perizinan sistem elektronik serta klasifikasi kegiatan usaha melalui OSS berdasarkan model dan lokasi operator. Pastikan aturan yang berlaku saat peluncuran; Permenkomdigi 15/2025 adalah standar kegiatan usaha sektor terkait dan tidak boleh diperlakukan sebagai satu-satunya pemeriksaan pendaftaran.
- [ ] Sesuaikan kebijakan dan kontrol dengan UU 27/2022 tentang Pelindungan Data Pribadi, PP 71/2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik, serta aturan pelaksana yang berlaku saat peluncuran.

## Anak, konten, dan hak kekayaan intelektual

- [ ] Lakukan dan dokumentasikan penilaian mandiri per produk, layanan, dan fitur TamuKita; tetapkan penanggung jawab, narahubung, bukti pendukung, mekanisme pembaruan, dan status pelaporan kepada Komdigi bila diwajibkan.
- [ ] Lengkapi dan sahkan [lembar kerja penilaian pelindungan anak](./CHILD-SAFETY-ASSESSMENT.md) berdasarkan fitur yang benar-benar diluncurkan; gunakan indikator Kepmenkomdigi 142/2026 sebagaimana diubah oleh 219/2026, lampirkan bukti penilaian, kontrol, review hukum, keputusan usia/profil risiko, dan status pelaporan.
- [ ] Tetapkan batas minimum/rentang usia dan perlakuan verifikasi untuk setiap fitur yang mungkin diakses anak setelah operator/counsel mengonfirmasi teks final Permenkomdigi 9/2026. JDIH/BPK mencatat peraturan berstatus berlaku, BN 2026 No. 163, diundangkan 6 Maret 2026; PDF unduhan resmi yang tersedia masih ber-watermark “RANCANGAN”. Minta/konfirmasi salinan Berita Negara final sebelum memutuskan desain usia/verifikasi. Saat ini halaman undangan/RSVP/buku tamu publik tidak menampilkan informasi atau gate usia; deklarasi 18+ untuk akun pembuat dan checkbox wali untuk data anak tidak menyelesaikan penilaian per fitur dengan sendirinya. Keputusan serta desain harus disahkan sebelum production.
- [ ] Tinjau dan sahkan kontrol usia akun pada commit PR #1: pendaftaran dan onboarding/reset meminta pernyataan usia 18+ tanpa tanggal lahir, dan login/sesi menolak akun tanpa catatan. CI/E2E lulus; QA visual staging memastikan pernyataan usia 18+ pada pendaftaran wajib. Tidak ada akun dibuat pada pengecekan visual. Rencanakan persetujuan ulang akun lama melalui reset kata sandi. Usia akun tidak mengeluarkan undangan publik, RSVP, buku tamu, atau media dari penilaian fitur anak.
- [ ] Tinjau kontrol consent anak pada PR #1: RSVP/ucapan menawarkan pilihan data anak; bila dipilih, server mensyaratkan pernyataan wali dan menyimpan waktu/versi persetujuan. QA staging 390×844 memastikan persetujuan kondisional muncul dan wajib pada kedua formulir. Jalur RSVP kosong diblokir, jumlah tamu hanya relevan saat hadir, dan buku tamu meminta nama; penolakan consent tidak mengirim request tulis. Redaksi menjelaskan penerima data dan bahwa ucapan dapat tampil publik setelah persetujuan pengundang. Submit valid belum dilakukan pada staging. Tautkan dengan pemberitahuan privasi yang telah disahkan, minta tinjauan hukum atas redaksi, lalu lakukan uji submission terkontrol di staging sebelum peluncuran.
- [ ] Tetapkan cara menangani data tamu anak, laporan dari anak/orang tua/wali, serta pemberitahuan yang mudah dipahami dan diakses anak/wali.
- [ ] Terbitkan kebijakan konten/UGC yang menjelaskan kanal laporan, jenis laporan, proses moderasi, banding, pembatasan penyalahgunaan, dan waktu respons.
- [ ] Uji proses laporan publik, antrean moderator, audit keputusan, serta hapus/pulihkan konten di aplikasi. E2E CI #40432677272 pada kandidat `ace0e16` memeriksa laporan guestbook dan halaman undangan, pilihan alasan wajib, akses reviewer, suspend/restore, dan event audit pada database disposable; kode laporan halaman belum dideploy ke staging. Uji operasi staging, banding, SLA, dan petugas belum dilakukan.
- [ ] Lengkapi lisensi template, perjanjian developer/marketplace, daftar lisensi dependensi, chain-of-title untuk musik/font/foto/ikon, dan mekanisme klaim/takedown.
- [ ] Tulis persetujuan penggunaan foto/konten dari orang lain dan tata cara bukti izin, termasuk perlindungan anak.

## Harga, pembayaran, refund, dan reseller

- [ ] Tetapkan ketentuan lisensi, aktivasi, masa hosting, renewal, biaya tambahan, pajak/faktur, dan waktu publikasi; sinkronkan dengan konfigurasi admin dan tampilan checkout.
- [ ] Terapkan keputusan refund internal: 7 hari kalender untuk lisensi belum dipakai/undangan belum terbit; kelebihan bayar dikembalikan penuh; gangguan/kegagalan mengikuti aturan perbaikan, penggantian atau refund; kredit berbayar tak kedaluwarsa dan unit utuh belum terpakai dapat diminta refund. Minta penasihat hukum memvalidasi PP 80/2019 Pasal 69 dan mekanismenya.
- [ ] Pastikan redaksi refund tidak mengesampingkan hak wajib konsumen dan cocok dengan proses Xendit/webhook serta perilaku penghentian entitlement.
- [ ] Tetapkan masa berlaku, transferabilitas, bonus, pajak, dan refund kredit reseller; sinkronkan dengan ledger dan persetujuan reseller.
- [ ] Tetapkan kontrak reseller: komisi/margin, dukungan pelanggan, pajak, izin mengakses data pelanggan, penggunaan merek, dan penyelesaian sengketa.
- [ ] Jalankan checkout/refund dengan kredensial Xendit Test Mode/staging dan verifikasi bukti transaksi/pengaduan sebelum production.

## Kesiapan publikasi

- [ ] Minta penasihat hukum Indonesia memeriksa semua dokumen dan aturan yang berlaku tepat sebelum peluncuran. Review ini belum dilakukan dan tidak dapat digantikan oleh draf internal atau audit kode.
- [ ] Publikasikan versi bertanggal pada situs, tautkan di footer/checkout/form yang relevan, dan rekam persetujuan syarat yang sesuai.
- [ ] Latih support/moderator untuk permintaan privasi, pengaduan konsumen, laporan konten, takedown, dan insiden.
- [ ] Catat pemilik tugas, bukti penyelesaian, dan review berkala setiap 3 bulan; lakukan review di luar jadwal bila fitur, vendor, atau aturan berubah.

## Sumber resmi untuk verifikasi

- [UU 27 Tahun 2022 tentang Pelindungan Data Pribadi — JDIH BPK](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022-10)
- [PP 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik — JDIH BPK](https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019)
- [PP 80 Tahun 2019 tentang Perdagangan Melalui Sistem Elektronik — JDIH BPK](https://peraturan.bpk.go.id/Details/126143/pp-no-80-tahun-2019)
- [Permendag 19 Tahun 2026 tentang Penyelenggaraan Usaha Perdagangan Melalui Sistem Elektronik — JDIH BPK](https://peraturan.bpk.go.id/Details/351720/permendag-no-19-tahun-2026)
- [Permenkomdigi 15 Tahun 2025 tentang Standar Kegiatan Usaha dan Standar Produk/Jasa pada sektor terkait — JDIH Komdigi](https://jdih.komdigi.go.id/produk_hukum/view/id/985/t/peraturan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B15%2Btahun%2B2025)
- [PP 17 Tahun 2025 tentang Tata Kelola Penyelenggaraan Sistem Elektronik dalam Pelindungan Anak — JDIH BPK](https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025)
- [Permenkomdigi 9 Tahun 2026 tentang peraturan pelaksanaan tata kelola PSE dalam pelindungan anak — JDIH BPK](https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026)
- [Kepmenkomdigi 142 Tahun 2026 tentang indikator penilaian akses anak — JDIH Komdigi](https://jdih.komdigi.go.id/index.php/produk_hukum/view/id/1009/t/keputusan-menteri-komunikasi-dan-digital-nomor-142-tahun-2026)
- [Kepmenkomdigi 219 Tahun 2026 yang mengubah Kepmen 142/2026 — JDIH Komdigi](https://jdih.komdigi.go.id/index.php/produk_hukum/view/id/1011/t/keputusan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B219%2Btahun%2B2026)

Sumber di atas membantu menemukan peraturan primer; checklist ini bukan kesimpulan tentang kewajiban hukum spesifik TamuKita. Validasi ruang lingkup, aturan pelaksana terbaru, izin, tenggat, dan model transaksi oleh penasihat hukum/operator.

