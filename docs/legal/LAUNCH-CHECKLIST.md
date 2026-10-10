# Checklist legal dan privasi sebelum peluncuran

**Status saat ini: BELUM SIAP UNTUK PUBLIKASI.** Draf kebijakan tersedia di folder ini, tetapi keputusan bisnis, verifikasi teknis, dan tinjauan hukum masih diperlukan.

**Gate prioritas:** tentukan segera apakah produk, layanan, atau fitur TamuKita termasuk cakupan tata kelola PSE dalam pelindungan anak. PP 17/2025 dan aturan pelaksananya, Permenkomdigi 9/2026, berstatus berlaku. Permenkomdigi 9/2026 mengatur antara lain informasi batas usia, penilaian mandiri, desain pelindungan anak, verifikasi usia, dan pelaporan hasil penilaian. Ketentuan peralihannya menetapkan tenggat pelaporan awal tiga bulan sejak pengundangan; bila kewajiban itu berlaku bagi operator, periodenya telah berlalu pada tanggal audit ini (10 Oktober 2026). Minta penasihat hukum/operator memastikan cakupan, status, dan langkah yang diperlukan sebelum layanan diluncurkan atau diakses anak.

## Identitas operator dan konsumen

- [ ] Tetapkan badan usaha/operator, alamat, identitas/nomor pendaftaran dan izin usaha yang relevan.
- [ ] Tentukan model transaksi TamuKita: penyedia layanan, penjual lisensi, reseller, marketplace template, atau kombinasi; jelaskan siapa menerima pembayaran dan bertanggung jawab atas setiap item.
- [ ] Publikasikan kanal dukungan, pengaduan, privasi, keamanan, SLA respons, eskalasi sengketa, dan jam operasional.
- [ ] Verifikasi kewajiban informasi, transaksi, dan perlindungan konsumen terhadap PP 80/2019 dan Permendag 19/2026 yang berlaku sejak 8 Juni 2026 dan mencabut Permendag 31/2023.

## Privasi dan sistem elektronik

- [ ] Tetapkan peran operator dan pelanggan untuk tiap tujuan/data (pengendali/pemroses bila relevan), dasar pemrosesan, pemberitahuan, kontrak/instruksi, serta proses permintaan subjek data.
- [ ] Isi jadwal retensi terukur dan implementasikan purge untuk akun, draf, RSVP, buku tamu, kontak, file sumber/varian R2, laporan konten, log, audit, transaksi, dan backup.
- [ ] Tetapkan proses ekspor/koreksi/penghapusan, verifikasi identitas, pengecualian legal hold, SLA, dan bukti penyelesaian. Saat ini belum teridentifikasi penghapusan akun mandiri atau purge lengkap.
- [ ] Inventarisasikan subprosesor, lokasi data, akses admin/vendor, transfer lintas negara, kontrak pemrosesan, dan masa simpan provider untuk deployment yang benar-benar dipakai.
- [ ] Tetapkan prosedur insiden privasi dan keamanan, jalur eskalasi, pencatatan, penilaian dampak, dan notifikasi sesuai hukum.
- [ ] Tinjau kewajiban pendaftaran dan perizinan sistem elektronik serta klasifikasi kegiatan usaha melalui OSS berdasarkan model dan lokasi operator. Pastikan aturan yang berlaku saat peluncuran; Permenkomdigi 15/2025 adalah standar kegiatan usaha sektor terkait dan tidak boleh diperlakukan sebagai satu-satunya pemeriksaan pendaftaran.
- [ ] Sesuaikan kebijakan dan kontrol dengan UU 27/2022 tentang Pelindungan Data Pribadi, PP 71/2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik, serta aturan pelaksana yang berlaku saat peluncuran.

## Anak, konten, dan hak kekayaan intelektual

- [ ] Lakukan dan dokumentasikan penilaian mandiri per produk, layanan, dan fitur TamuKita; tetapkan penanggung jawab, narahubung, bukti pendukung, mekanisme pembaruan, dan status pelaporan kepada Komdigi bila diwajibkan.
- [ ] Isi dan sahkan [lembar kerja penilaian pelindungan anak](./CHILD-SAFETY-ASSESSMENT.md) berdasarkan fitur yang benar-benar diluncurkan; lampirkan bukti penilaian, kontrol, review hukum, keputusan usia/profil risiko, dan status pelaporan.
- [ ] Tentukan batas usia minimum dan rentang usia yang sesuai, informasi usia yang ditampilkan, verifikasi usia, persetujuan orang tua/wali bila diperlukan, profil risiko, serta desain pelindungan anak sesuai hasil tinjauan hukum. Permenkomdigi 9/2026 memuat kelompok usia 3–5, 6–9, 10–12, 13–15, dan 16–<18 tahun serta larangan menargetkan layanan bagi anak di bawah 3 tahun; penasihat hukum/operator harus memetakan ketentuan ini pada setiap fitur TamuKita. Nilai akses anak pada akun, undangan publik, RSVP, buku tamu, unggahan media, komunikasi, dan transaksi—jangan hanya menilai pemilik akun.
- [ ] Tetapkan cara menangani data tamu anak, laporan dari anak/orang tua/wali, serta pemberitahuan yang mudah dipahami dan diakses anak/wali.
- [ ] Terbitkan kebijakan konten/UGC yang menjelaskan kanal laporan, jenis laporan, proses moderasi, banding, pembatasan penyalahgunaan, dan waktu respons.
- [ ] Uji proses laporan publik, antrean moderator, audit keputusan, serta hapus/pulihkan konten di aplikasi.
- [ ] Lengkapi lisensi template, perjanjian developer/marketplace, daftar lisensi dependensi, chain-of-title untuk musik/font/foto/ikon, dan mekanisme klaim/takedown.
- [ ] Tulis persetujuan penggunaan foto/konten dari orang lain dan tata cara bukti izin, termasuk perlindungan anak.

## Harga, pembayaran, refund, dan reseller

- [ ] Tetapkan ketentuan lisensi, aktivasi, masa hosting, renewal, biaya tambahan, pajak/faktur, dan waktu publikasi; sinkronkan dengan konfigurasi admin dan tampilan checkout.
- [ ] Putuskan refund per item: lisensi template, aktivasi, hosting/perpanjangan, pembayaran ganda, kegagalan layanan, dan kredit reseller; masukkan SLA, jalur pengaduan, serta akibat untuk undangan yang sudah terbit.
- [ ] Pastikan redaksi refund tidak mengesampingkan hak wajib konsumen dan cocok dengan proses Xendit/webhook serta perilaku penghentian entitlement.
- [ ] Tetapkan masa berlaku, transferabilitas, bonus, pajak, dan refund kredit reseller; sinkronkan dengan ledger dan persetujuan reseller.
- [ ] Tetapkan kontrak reseller: komisi/margin, dukungan pelanggan, pajak, izin mengakses data pelanggan, penggunaan merek, dan penyelesaian sengketa.
- [ ] Jalankan checkout/refund dengan kredensial Xendit Test Mode/staging dan verifikasi bukti transaksi/pengaduan sebelum production.

## Kesiapan publikasi

- [ ] Minta penasihat hukum Indonesia memeriksa semua dokumen dan aturan yang berlaku tepat sebelum peluncuran.
- [ ] Publikasikan versi bertanggal pada situs, tautkan di footer/checkout/form yang relevan, dan rekam persetujuan syarat yang sesuai.
- [ ] Latih support/moderator untuk permintaan privasi, pengaduan konsumen, laporan konten, takedown, dan insiden.
- [ ] Simpan pemilik tugas, bukti penyelesaian, dan tanggal review berkala: **[ISI]**.

## Sumber resmi untuk verifikasi

- [UU 27 Tahun 2022 tentang Pelindungan Data Pribadi — JDIH BPK](https://peraturan.bpk.go.id/Details/229798/uu-no-27-)
- [PP 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik — JDIH BPK](https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019)
- [PP 80 Tahun 2019 tentang Perdagangan Melalui Sistem Elektronik — JDIH BPK](https://peraturan.bpk.go.id/Details/126143/pp-no-80-tahun-2019)
- [Permendag 19 Tahun 2026 tentang Penyelenggaraan Usaha Perdagangan Melalui Sistem Elektronik — JDIH BPK](https://peraturan.bpk.go.id/Details/351720/permendag-no-19-tahun-2026)
- [Permenkomdigi 15 Tahun 2025 tentang Standar Kegiatan Usaha dan Standar Produk/Jasa pada sektor terkait — JDIH Komdigi](https://jdih.komdigi.go.id/produk_hukum/view/id/985/t/peraturan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B15%2Btahun%2B2025)
- [PP 17 Tahun 2025 tentang Tata Kelola Penyelenggaraan Sistem Elektronik dalam Pelindungan Anak — JDIH BPK](https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025)
- [Permenkomdigi 9 Tahun 2026 tentang peraturan pelaksanaan tata kelola PSE dalam pelindungan anak — JDIH BPK](https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026)

Sumber di atas membantu menemukan peraturan primer; checklist ini bukan kesimpulan tentang kewajiban hukum spesifik TamuKita. Validasi ruang lingkup, aturan pelaksana terbaru, izin, tenggat, dan model transaksi oleh penasihat hukum/operator.

