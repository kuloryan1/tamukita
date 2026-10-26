# Pemberitahuan Privasi TamuKita

> **DRAF INTERNAL — keputusan operasional awal ditetapkan 26 Oktober 2026.** Identitas operator, kontak aktif, inventaris vendor produksi, implementasi retensi/penghapusan, dan tinjauan penasihat hukum masih wajib sebelum dipublikasikan. Ini bukan pendapat hukum.

**Operator:** [ISI NAMA BADAN USAHA/OPERATOR]

**Alamat:** [ISI ALAMAT USAHA]

**Tanggal versi draf:** 26 Oktober 2026

**Berlaku sejak:** [ISI SETELAH DISETUJUI OPERATOR]

**Kontak privasi (pilihan internal):** `privasi@tamukita.io` — alias ke inbox yang dipantau; alamat dan alias belum diverifikasi.

## 1. Siapa yang mengelola data

TamuKita menyediakan layanan untuk membuat dan menerbitkan undangan digital, mengumpulkan RSVP dan ucapan, mengelola media, serta memproses pembelian dan layanan reseller.

Pembagian kerja operasional awal: TamuKita menentukan penggunaan data akun, platform, keamanan, dukungan, dan transaksi. Pelanggan menentukan data tamu yang mereka masukkan ke undangan dan tujuan undangan; TamuKita mengolah data tersebut untuk menyediakan layanan atas instruksi pelanggan. Status pengendali, pemroses, atau pengendali bersama harus ditetapkan per tujuan dan perjanjian oleh operator serta penasihat hukum—label sementara ini belum merupakan kesimpulan hukum.

**Nama dan alamat operator serta pembagian peran final:** [ISI DAN MINTA TINJAUAN HUKUM].

## 2. Data yang diproses

Bergantung pada fitur yang digunakan, data dapat mencakup:

- **Akun:** nama, alamat email, status verifikasi, pernyataan usia 18+ beserta waktu dan versi teks yang disetujui, data autentikasi dan keamanan akun, keanggotaan workspace, serta peran pengguna. Tanggal lahir tidak dikumpulkan. Kata sandi disimpan sebagai hash, bukan sebagai teks yang dapat dibaca.
- **Undangan:** nama/judul acara, cerita, jadwal, lokasi, alamat, tautan peta, foto/media, draf, versi, publikasi, dan konfigurasi yang dimasukkan pengguna.
- **Tamu dan RSVP:** nama tamu, kontak yang dimasukkan pelanggan, token tautan undangan dalam bentuk hash, nama yang memberi jawaban, status hadir, jumlah peserta, pesan RSVP bila tersedia, serta penanda bahwa data anak dicantumkan dan waktu/versi persetujuan orang tua/wali.
- **Ucapan dan laporan konten:** nama tampilan, isi ucapan, status moderasi, penanda data anak dan waktu/versi persetujuan wali bila berlaku, alasan laporan terstruktur, dan waktu tindakan. Untuk mencegah laporan berulang, aplikasi menyimpan fingerprint berkunci yang diturunkan dari alamat jaringan dan entri terkait; fingerprint bukan alamat IP mentah.
- **Media:** nama berkas, tipe dan ukuran berkas, varian hasil pemrosesan, metadata teknis/crop, dan status pemrosesan.
- **Transaksi:** item dan nilai pesanan, mata uang, status pembayaran/refund, referensi sesi/pembayaran dari penyedia, serta catatan audit transaksi. TamuKita tidak meminta pengguna memasukkan nomor kartu ke formulir aplikasi; metode pembayaran dikelola penyedia pembayaran.
- **Keamanan dan operasi:** catatan audit admin, permintaan akses sementara yang diaudit, data kesehatan layanan, penghitung kunjungan agregat per undangan/hari, dan metadata teknis yang mungkin dicatat oleh infrastruktur hosting.
- **Analitik marketplace:** fitur cookie penghitung browser harian diputuskan **nonaktif untuk peluncuran publik** sampai pemberitahuan, dasar pemrosesan, dan kebutuhan persetujuan ditinjau serta kontrolnya tersedia. Metrik agregat yang sudah tersimpan tidak boleh dikaitkan kembali dengan akun atau alamat IP.
- **Keluhan editor:** kategori kendala, pesan yang dikirim pengguna, hubungan ke akun/workspace, undangan terkait bila laporan dikirim dari editor, dan waktu/status peninjauan. Antrean pesan dapat dibaca oleh peran Support dan Super Admin; perubahan status dicatat di audit. Jangan masukkan kata sandi, nomor kartu, atau data tamu ke laporan. Retensi dan informasi kanal/tindak lanjut harus ditentukan operator sebelum kebijakan ini diterbitkan.

Operator harus memverifikasi jenis data yang dicatat oleh proxy, hosting, database, penyedia email, penyimpanan objek, backup, dan alat pemantauan sebelum bagian ini diterbitkan.

## 3. Sumber dan tujuan penggunaan

Data berasal dari pemilik akun, anggota workspace, pelanggan yang membuat undangan, tamu yang mengirim RSVP/ucapan, penyedia pembayaran, serta sistem teknis saat layanan digunakan. Data digunakan untuk:

- membuat dan mengamankan akun serta workspace;
- menyimpan, mengedit, memublikasikan, dan menampilkan undangan;
- meneruskan RSVP dan ucapan kepada pemilik undangan serta memoderasi ucapan/laporan;
- memproses lisensi template, aktivasi, hosting, top-up reseller, pembayaran, dan refund;
- mengirim email transaksi atau operasional yang diminta;
- memberi dukungan, mencegah penyalahgunaan, menyelidiki insiden, dan memenuhi kewajiban hukum;
- meninjau kendala editor yang dilaporkan pengguna dan memperbaiki layanan;
- menghitung penggunaan layanan dan memperbaiki keandalan platform.
- menghitung page view marketplace dan browser harian secara agregat untuk memahami jangkauan katalog.

Dasar pemrosesan dan pemberitahuan pada saat pengumpulan harus disesuaikan per tujuan oleh operator setelah tinjauan hukum.

## 4. Informasi yang dapat dilihat orang lain

Undangan yang diterbitkan dapat dibuka oleh siapa pun yang memiliki alamat publiknya. Nama, cerita, jadwal, lokasi, foto, dan konten lain yang dipilih pelanggan untuk ditampilkan dapat menjadi informasi publik. Ucapan hanya tampil setelah disetujui pemilik undangan. Jawaban RSVP dan data tamu tersedia bagi pelanggan yang berwenang di workspace sesuai fitur aplikasi.

Pelanggan bertanggung jawab memastikan mereka memiliki dasar yang sesuai untuk memasukkan dan membagikan informasi tamu, terutama kontak, foto, dan informasi anak. Operator perlu menerbitkan instruksi yang mudah dipahami kepada pelanggan dan tamu mengenai penggunaan data tersebut.

## 5. Penyedia layanan dan pengungkapan

Daftar vendor yang dipilih untuk rancangan produksi adalah:

- **Dokploy-managed VPS** untuk aplikasi, worker, PostgreSQL, dan Redis. Nama penyedia VPS dan lokasi fisik region belum tercatat pada bukti repo.
- **Cloudflare** untuk DNS, Tunnel, dan R2. Bucket R2 staging terverifikasi di Automatic Asia-Pacific; keputusan target produksi adalah R2 Asia-Pacific. Cloudflare dapat memproses data jaringan secara global, jadi pilihan region bucket bukan janji bahwa seluruh pemrosesan terjadi di Indonesia.
- **Xendit** untuk sesi pembayaran dan refund.
- **Resend** untuk email transaksional bila diaktifkan.
- **GitHub Actions** untuk CI; workflow staging menggunakan akun/data sintetis `.invalid` dan tidak boleh menerima data pelanggan nyata.

Data hanya dibagikan sejauh diperlukan. Sebelum produksi, operator harus mengonfirmasi bahwa vendor yang benar-benar aktif sama dengan daftar ini, memeriksa subprosesor, region VPS/database, negara pemrosesan Xendit/Resend/Cloudflare, kontrak pemrosesan, masa simpan, mekanisme transfer lintas negara, dan akses dukungan vendor. Produksi belum boleh menerima data pelanggan sampai inventaris itu terdokumentasi. Pengungkapan untuk kewajiban hukum atau keamanan harus dicatat dan dibatasi sesuai kebutuhan.

## 6. Masa simpan

Jadwal berikut adalah keputusan internal awal. **Belum menjadi janji pelanggan** karena aplikasi belum terbukti menjalankan purge untuk seluruh kategori. Sebelum publikasi, operator harus menguji penghapusan dari database, object storage, vendor, dan backup, serta menetapkan pengecualian legal hold. Data dihapus ketika tujuan pemrosesan selesai atau ketika ada permintaan yang sah, kecuali hukum atau sengketa mengharuskan penyimpanan tertentu.

| Kategori | Retensi awal yang dipilih | Mekanisme/pengecualian |
|---|---|---|
| Akun, sesi, dan token | Akun aktif selama akun digunakan; setelah penutupan akun, data operasional dihapus dalam 30 hari. Token sesi/tindakan tetap mengikuti masa berlaku teknis yang lebih singkat. | Verifikasi permintaan; simpan catatan minimal transaksi/keamanan hanya selama diperlukan. Fitur penghapusan akun belum tersedia. |
| Draf tidak aktif | 12 bulan sejak aktivitas terakhir, dengan pemberitahuan 30 hari sebelum penghapusan. | Ekspor sebelum purge. Pengingat dan purge otomatis belum tersedia. |
| Undangan terbit dan data tamu, RSVP, ucapan, kontak | Selama hosting aktif. Setelah acara, data RSVP/kontak/ucapan dihapus 90 hari sesudah tanggal acara atau 30 hari sesudah hosting berakhir, mana yang lebih akhir. | Beri pemilik kemampuan ekspor sebelum purge; matikan halaman dan penerimaan RSVP saat hosting berakhir. Purge belum dibuktikan. |
| Media asli dan varian | Selama undangan aktif; dihapus 30 hari setelah hosting berakhir atau undangan dihapus. | Hapus object storage, cache yang dapat dikendalikan, serta orphaned objects. Belum dibuktikan. |
| Laporan konten, laporan support, dan audit keamanan/admin | 12 bulan sejak kasus ditutup atau tindakan dicatat. | Anonimkan setelah masa itu; perpanjang hanya untuk insiden/sengketa yang masih berjalan. |
| Order, pembayaran, dan refund | Selama periode wajib menurut aturan akuntansi, pajak, pembayaran, dan sengketa yang berlaku. | Penasihat hukum/akuntan harus mengisi masa numerik dan jenis bukti yang wajib disimpan sebelum publikasi. |
| Log aplikasi/infrastruktur | 90 hari untuk log operasional; 12 bulan untuk catatan audit keamanan/admin. | Log vendor mengikuti pengaturan dan kontrak vendor yang diverifikasi; hapus atau anonimisasi pengenal bila tidak dibutuhkan. |
| Backup | Rotasi maksimum 30 hari. | Data yang dihapus dapat tersisa pada backup sampai rotasi 30 hari selesai; backup dipagari aksesnya dan tidak dipakai sebagai arsip kerja. Jadwal VPS/R2 belum diterapkan. |
| Analitik agregat marketplace | 12 bulan. | Tidak menyimpan identitas browser setelah agregasi; penghitung cookie dinonaktifkan untuk peluncuran publik sampai tinjauan selesai. |

Saat masa hosting undangan berakhir, halaman publik dan penerimaan RSVP/buku tamu ditutup oleh aplikasi. Penutupan itu belum menghapus semua database, media, log, atau backup. Masa pada tabel baru dapat diumumkan setelah mekanisme purge dan bukti penghapusan tersedia.

## 7. Permintaan dan hak terkait data

Permintaan akses, koreksi, penarikan persetujuan bila relevan, pembatasan/penghentian pemrosesan, penghapusan, atau hak lain yang berlaku diajukan ke **`privasi@tamukita.io`** setelah alias itu diaktifkan dan diuji. Petugas memverifikasi identitas secara proporsional, mencatat waktu masuk, menilai hubungan pemohon dengan data, dan menyampaikan hasil dalam tenggat tiap hak. Proses harus mampu memenuhi tenggat 3 × 24 jam untuk hak yang diberi tenggat tersebut oleh UU PDP, termasuk akses dan koreksi, serta menjelaskan pengecualian yang sah. Data yang wajib disimpan untuk transaksi, keamanan, sengketa, atau kewajiban hukum dipisahkan dan dibatasi.

**Proses saat ini:** belum ada fitur penghapusan akun mandiri yang teridentifikasi. Tetapkan petugas, proses manual, SLA, pelacakan permintaan, mekanisme penghapusan/anonymisasi, dan alur keberatan sebelum janji ini dipublikasikan.

## 8. Keamanan dan insiden

Operator menerapkan kontrol akses berbasis peran, pembatasan akses lintas workspace, pencatatan tindakan admin, autentikasi, backup, dan kontrol teknis lain yang sesuai. Tidak ada sistem yang dapat dijamin bebas risiko. Operator harus menetapkan prosedur respons insiden, penilaian dampak, pemberitahuan kepada pihak yang diwajibkan, dan kontak eskalasi.

Kontak insiden privasi: **`keamanan@tamukita.io`** setelah alias itu dialihkan ke inbox yang dijaga petugas piket dan uji kirim/terima berhasil. Runbook harus menyediakan penilaian, pembatasan dampak, bukti, komunikasi, dan pemulihan. Bila terjadi kegagalan pelindungan data, pemberitahuan tertulis yang diwajibkan UU PDP disampaikan paling lambat 3 × 24 jam kepada subjek data dan lembaga yang berwenang; kewajiban dan format akhir harus disahkan penasihat hukum.

## 9. Anak dan perubahan pemberitahuan

Keputusan awal: akun pembuat, pembeli, reseller, dan pengembang hanya untuk orang berusia 18 tahun ke atas; pernyataan diminta tanpa mengumpulkan tanggal lahir, dan waktu/versinya dicatat. Halaman undangan publik dapat dilihat anak, sehingga TamuKita menganggap halaman publik, RSVP, buku tamu, dan media mungkin diakses anak sampai penilaian resmi menyatakan lain. Orang tua/wali mengirim RSVP/ucapan atas nama anak. Form publik meminta pernyataan wali bila data anak dicantumkan dan menyimpan waktu/versi persetujuan per alur. RSVP dipakai untuk mencatat kehadiran dan disampaikan kepada pengundang; ucapan dapat ditampilkan pada halaman undangan publik setelah disetujui pengundang. Hindari kontak langsung atau data sensitif anak, dan unggah foto anak hanya dengan izin yang sah. TamuKita tidak menargetkan pemasaran kepada anak. Pemrosesan data pribadi anak wajib mengikuti persetujuan orang tua/wali dan aturan yang berlaku.

Keputusan produk ini tidak mengecualikan TamuKita dari ruang lingkup. UU PDP Pasal 25 mewajibkan persetujuan orang tua/wali untuk pemrosesan data pribadi anak. Operator harus menyelesaikan penilaian mandiri, desain pelindungan, verifikasi usia yang sepadan, dan pelaporan berdasarkan [PP 17/2025](https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025), [Permenkomdigi 9/2026](https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026), serta indikator yang diubah oleh [Kepmenkomdigi 142/2026](https://jdih.komdigi.go.id/index.php/produk_hukum/view/id/1009/t/keputusan-menteri-komunikasi-dan-digital-nomor-142-tahun-2026) dan [Kepmenkomdigi 219/2026](https://jdih.komdigi.go.id/index.php/produk_hukum/view/id/1011/t/keputusan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B219%2Btahun%2B2026). Status pelaporan aktual belum diketahui; tenggat awal 3 bulan dari pengundangan Permenkomdigi 9/2026 telah lewat pada Juni 2026 dan perlu segera dikonfirmasi oleh operator/penasihat hukum.

Perubahan material akan diberitahukan melalui situs dan email akun bila sesuai. Tanggal versi terbaru: setelah disahkan operator.

