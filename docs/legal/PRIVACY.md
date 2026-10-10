# Pemberitahuan Privasi TamuKita

> **DRAF INTERNAL — jangan dipublikasikan sebelum semua penanda `[ISI]` diselesaikan dan draf ditinjau penasihat hukum.** Ini adalah rancangan operasional, bukan pendapat hukum.

**Operator:** [ISI NAMA BADAN USAHA/OPERATOR]  
**Alamat:** [ISI ALAMAT USAHA]  
**Berlaku sejak:** [ISI TANGGAL]  
**Kontak privasi:** [ISI EMAIL/FORMULIR]

## 1. Siapa yang mengelola data

TamuKita menyediakan layanan untuk membuat dan menerbitkan undangan digital, mengumpulkan RSVP dan ucapan, mengelola media, serta memproses pembelian dan layanan reseller.

Operator menentukan penggunaan data untuk membuat akun, menjalankan platform, keamanan, dukungan, dan transaksi. Untuk data tamu yang dimasukkan pelanggan ke undangan, pelanggan biasanya menentukan tujuan undangannya; peran hukum operator dan pelanggan sebagai pengendali atau pemroses harus ditetapkan sesuai hubungan dan instruksi yang benar-benar berlaku.

**Nama dan alamat operator serta pembagian peran final:** [ISI DAN MINTA TINJAUAN HUKUM].

## 2. Data yang diproses

Bergantung pada fitur yang digunakan, data dapat mencakup:

- **Akun:** nama, alamat email, status verifikasi, data autentikasi dan keamanan akun, keanggotaan workspace, serta peran pengguna. Kata sandi disimpan sebagai hash, bukan sebagai teks yang dapat dibaca.
- **Undangan:** nama/judul acara, cerita, jadwal, lokasi, alamat, tautan peta, foto/media, draf, versi, publikasi, dan konfigurasi yang dimasukkan pengguna.
- **Tamu dan RSVP:** nama tamu, kontak yang dimasukkan pelanggan, token tautan undangan dalam bentuk hash, nama yang memberi jawaban, status hadir, jumlah peserta, dan pesan RSVP bila tersedia.
- **Ucapan dan laporan konten:** nama tampilan, isi ucapan, status moderasi, alasan laporan terstruktur, dan waktu tindakan. Untuk mencegah laporan berulang, aplikasi menyimpan fingerprint berkunci yang diturunkan dari alamat jaringan dan entri terkait; fingerprint bukan alamat IP mentah.
- **Media:** nama berkas, tipe dan ukuran berkas, varian hasil pemrosesan, metadata teknis/crop, dan status pemrosesan.
- **Transaksi:** item dan nilai pesanan, mata uang, status pembayaran/refund, referensi sesi/pembayaran dari penyedia, serta catatan audit transaksi. TamuKita tidak meminta pengguna memasukkan nomor kartu ke formulir aplikasi; metode pembayaran dikelola penyedia pembayaran.
- **Keamanan dan operasi:** catatan audit admin, permintaan akses sementara yang diaudit, data kesehatan layanan, penghitung kunjungan agregat per undangan/hari, dan metadata teknis yang mungkin dicatat oleh infrastruktur hosting.

Operator harus memverifikasi jenis data yang dicatat oleh proxy, hosting, database, penyedia email, penyimpanan objek, dan alat pemantauan sebelum bagian ini diterbitkan.

## 3. Sumber dan tujuan penggunaan

Data berasal dari pemilik akun, anggota workspace, pelanggan yang membuat undangan, tamu yang mengirim RSVP/ucapan, penyedia pembayaran, serta sistem teknis saat layanan digunakan. Data digunakan untuk:

- membuat dan mengamankan akun serta workspace;
- menyimpan, mengedit, memublikasikan, dan menampilkan undangan;
- meneruskan RSVP dan ucapan kepada pemilik undangan serta memoderasi ucapan/laporan;
- memproses lisensi template, aktivasi, hosting, top-up reseller, pembayaran, dan refund;
- mengirim email transaksi atau operasional yang diminta;
- memberi dukungan, mencegah penyalahgunaan, menyelidiki insiden, dan memenuhi kewajiban hukum;
- menghitung penggunaan layanan dan memperbaiki keandalan platform.

Dasar pemrosesan dan pemberitahuan pada saat pengumpulan harus disesuaikan per tujuan oleh operator setelah tinjauan hukum.

## 4. Informasi yang dapat dilihat orang lain

Undangan yang diterbitkan dapat dibuka oleh siapa pun yang memiliki alamat publiknya. Nama, cerita, jadwal, lokasi, foto, dan konten lain yang dipilih pelanggan untuk ditampilkan dapat menjadi informasi publik. Ucapan hanya tampil setelah disetujui pemilik undangan. Jawaban RSVP dan data tamu tersedia bagi pelanggan yang berwenang di workspace sesuai fitur aplikasi.

Pelanggan bertanggung jawab memastikan mereka memiliki dasar yang sesuai untuk memasukkan dan membagikan informasi tamu, terutama kontak, foto, dan informasi anak. Operator perlu menerbitkan instruksi yang mudah dipahami kepada pelanggan dan tamu mengenai penggunaan data tersebut.

## 5. Penyedia layanan dan pengungkapan

Data hanya boleh dibagikan sejauh diperlukan kepada penyedia yang mendukung layanan, misalnya:

- **Xendit** untuk sesi pembayaran dan refund;
- **Cloudflare R2** untuk penyimpanan media bila digunakan pada deployment;
- **Resend** untuk email bila digunakan pada deployment;
- penyedia hosting aplikasi, database, Redis/antrean pekerjaan, observabilitas, dan backup: **[ISI NAMA, FUNGSI, LOKASI, DAN TAUTAN PRIVASI]**.

Daftar aktual, peran tiap penyedia, subprosesor, lokasi penyimpanan/pemrosesan, dan mekanisme transfer lintas negara harus diverifikasi sebelum publikasi. Data juga dapat diungkap untuk memenuhi kewajiban hukum, melindungi keamanan layanan, atau menanggapi pengaduan/permintaan yang sah.

## 6. Masa simpan

Operator belum menetapkan jadwal retensi yang disetujui untuk seluruh kategori di bawah ini. Lengkapi dan implementasikan jadwal sebelum menerbitkan dokumen ini; jangan menggunakan tabel ini sebagai janji retensi sampai nilainya diputuskan.

| Kategori | Retensi yang harus ditetapkan | Mekanisme penghapusan/pengecualian |
|---|---|---|
| Akun, sesi, dan token | [ISI] | [ISI; termasuk akun tidak aktif] |
| Draf dan undangan terbit | [ISI] | [ISI; termasuk masa setelah hosting berakhir] |
| Kontak tamu, RSVP, dan ucapan | [ISI] | [ISI; termasuk permintaan pemilik/tamu] |
| Media asli dan varian | [ISI] | [ISI; termasuk object storage dan orphaned objects] |
| Laporan konten dan audit | [ISI] | [ISI; kebutuhan keamanan/pengaduan] |
| Order, pembayaran, dan refund | [ISI] | [ISI; kewajiban akuntansi/hukum] |
| Log aplikasi/infrastruktur | [ISI per vendor] | [ISI per vendor] |
| Backup | [ISI] | [ISI; siklus rotasi dan restore] |

Saat masa hosting undangan berakhir, halaman publik dan penerimaan RSVP/buku tamu ditutup oleh aplikasi. Hal itu tidak dengan sendirinya menghapus seluruh data dari database, media, log, atau backup. Operator harus menjelaskan dan menerapkan masa simpan setelah kedaluwarsa.

## 7. Permintaan dan hak terkait data

Permintaan akses, koreksi, penarikan persetujuan bila relevan, penghentian pemrosesan, penghapusan, atau hak lain yang berlaku dapat diajukan melalui **[ISI EMAIL/FORMULIR]**. Operator akan memverifikasi identitas secara proporsional, menilai hubungan pemohon dengan data, menyampaikan hasil dalam jangka waktu yang ditetapkan hukum, dan menjelaskan bila sebagian data perlu disimpan untuk transaksi, keamanan, sengketa, atau kewajiban hukum.

**Proses saat ini:** belum ada fitur penghapusan akun mandiri yang teridentifikasi. Tetapkan petugas, proses manual, SLA, pelacakan permintaan, mekanisme penghapusan/anonymisasi, dan alur keberatan sebelum janji ini dipublikasikan.

## 8. Keamanan dan insiden

Operator menerapkan kontrol akses berbasis peran, pembatasan akses lintas workspace, pencatatan tindakan admin, autentikasi, backup, dan kontrol teknis lain yang sesuai. Tidak ada sistem yang dapat dijamin bebas risiko. Operator harus menetapkan prosedur respons insiden, penilaian dampak, pemberitahuan kepada pihak yang diwajibkan, dan kontak eskalasi.

Kontak insiden privasi: **[ISI]**. Prosedur dan tenggat pemberitahuan: **[VALIDASI TERHADAP HUKUM DAN RUNBOOK OPERASIONAL]**.

## 9. Anak dan perubahan pemberitahuan

Kebijakan usia minimum pembuat akun/undangan, penggunaan oleh wali, dan pemrosesan data tamu anak: **[ISI KEBIJAKAN DAN MINTA TINJAUAN HUKUM]**. Jangan menyatakan layanan ditujukan atau tidak ditujukan untuk anak sebelum keputusan ini ditetapkan. Operator juga harus menilai apakah produk, layanan, atau fitur dapat diakses anak dan memenuhi langkah yang berlaku untuk penilaian mandiri, dokumentasi, desain pelindungan, verifikasi usia, serta pelaporan sesuai [PP 17/2025](https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025) dan [Permenkomdigi 9/2026](https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026). Halaman undangan publik, RSVP, buku tamu, media, dan transaksi perlu dipertimbangkan dalam penilaian; penasihat hukum harus menetapkan cakupan dan kewajiban operator.

Perubahan material akan diberitahukan melalui **[ISI SALURAN]**. Tanggal versi terbaru: **[ISI]**.

