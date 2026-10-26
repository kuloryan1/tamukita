# Lembar kerja penilaian pelindungan anak — TamuKita

> **DRAF KERJA INTERNAL — keputusan produk awal ditetapkan 26 Oktober 2026; penilaian formal, pengesahan operator, dan bukti pelaporan belum ada.** Ini bukan penetapan profil risiko atau pendapat hukum.

**Tanggal pemeriksaan kode:** 27 Oktober 2026

**Nama layanan:** TamuKita by Tigakaki (nama tampilan, bukan identitas legal operator)

**Operator/PSE:** [ISI BADAN USAHA DAN NOMOR PSE, JIKA BERLAKU]

**Penanggung jawab internal:** [ISI NAMA/JABATAN]

**Narahubung pelaporan:** usulan alias `keamanan@tamukita.io`; belum diaktifkan/diuji atau ditetapkan petugasnya.

**Penasihat hukum:** [ISI]

**Versi produk/commit yang dinilai:** fitur usia/consent pada draft PR #1 pertama kali dideploy ke staging pada `52fd1d8`; source staging saat ini `f510dcb`. [CI #40416200637](https://github.com/kuloryan1/tamukita/actions/runs/40416200637) dan [E2E #40416200522](https://github.com/kuloryan1/tamukita/actions/runs/40416200522) lulus (67 lulus, 2 dilewati, tanpa flaky); E2E mencakup consent RSVP/buku tamu sintetis, keyboard dialog, dan audit moderasi pada tiga browser. QA staging 27 Oktober pada 390×844 memeriksa deklarasi usia 18+, RSVP hadir/tidak hadir, consent wali, pemblokiran submit tanpa consent, dan keyboard; tidak ada data form dikirim ke API. Legal review dan pengesahan operator belum ada.

## 1. Keputusan awal dan hal yang masih harus dibuktikan

Permenkomdigi 9/2026 mencakup Produk, Layanan, dan Fitur yang dirancang untuk anak maupun yang mungkin digunakan atau diakses anak. Karena halaman undangan dapat dibuka publik dan fitur RSVP/buku tamu dapat dipakai tamu undangan, **keputusan sementara adalah memperlakukan halaman publik, RSVP, buku tamu, dan media sebagai fitur yang mungkin diakses anak**. Batasan usia akun tidak mengeluarkan fitur publik dari penilaian.

| Pertanyaan | Keputusan awal atas arahan pemilik produk | Bukti/gate yang masih terbuka |
|---|---|---|
| Entitas mana yang menjadi PSE/operator? | Belum bisa ditentukan dari repo; nama badan usaha dan alamat tidak boleh ditebak. | Nama legal, nomor pendaftaran/izin, dan pejabat penanggung jawab operator. |
| Fitur mana yang mungkin diakses anak? | Anggap halaman undangan publik, RSVP, buku tamu, dan media mungkin diakses anak sampai dinilai formal. | Penilaian per fitur berdasarkan indikator yang berlaku dan bukti penggunaan nyata. |
| Apakah ada fitur yang dirancang/ditargetkan kepada anak? | Tidak ada fitur atau promosi yang sengaja ditujukan kepada anak dalam MVP. | Tinjau copy pemasaran, template, dan perubahan produk sebelum tiap rilis. |
| Batas usia akun/transaksi? | Pembuat akun, pembeli, reseller, dan pengembang harus berusia 18 tahun ke atas; hanya pernyataan usia, tanpa tanggal lahir. | Kode pada draft PR #1 pertama kali dideploy ke staging pada `52fd1d8`; staging saat ini `f510dcb`. Pendaftaran meminta pernyataan usia wajib. CI/E2E menguji alur akun dan penolakan tanpa attestation. QA visual staging memeriksa deklarasi wajib di desktop/mobile; tidak membuat akun. Operator/counsel perlu mengesahkan kecukupan self-attestation. |
| Batas minimum usia dan rentang usia untuk fitur publik? | Belum ditetapkan; halaman undangan, RSVP, buku tamu, dan media dapat diakses publik serta mungkin digunakan anak. | Catatan resmi JDIH/BPK untuk Permenkomdigi 9/2026 menyebut batas usia/rentang usia dan verifikasi pengguna anak sebagai materi peraturan, tetapi salinan PDF pada record dimulai dengan tanda “RANCANGAN”. Operator/counsel perlu mengonfirmasi teks Berita Negara dan penerapannya. Kode saat ini membatasi akun pembuat dengan deklarasi 18+ dan meminta pernyataan wali saat data anak dicantumkan; halaman tamu tidak menampilkan informasi/gate usia. |
| Penggunaan publik dan data anak? | Anak dapat melihat undangan. Orang tua/wali mengisi RSVP/ucapan atas nama anak. Persetujuan RSVP menyebut pencatatan kehadiran dan penyampaian kepada pengundang; persetujuan ucapan menyebut kemungkinan tampil publik setelah disetujui. Jangan meminta kontak langsung atau data sensitif anak. | Notice untuk tamu/wali, mekanisme permintaan/takedown, bukti persetujuan, dan tinjauan penasihat hukum. |
| Profil risiko fitur? | Jangan menyatakan profil risiko rendah/tinggi sebelum penilaian formal per fitur dengan instrumen yang berlaku. Terapkan mitigasi konservatif di bagian 4. | Penilaian skor dan pengesahan operator mengikuti Kepmenkomdigi 142/2026 sebagaimana diubah oleh 219/2026. |
| Status penilaian/pelaporan? | Belum ada bukti pelaporan pada repository; status belum dapat dianggap selesai. | Verifikasi segera dengan operator/counsel. Peraturan berlaku sejak 6 Maret 2026 dan menetapkan pelaporan awal paling lambat 3 bulan sejak diundangkan; 6 Juni 2026 telah lewat bila kewajiban berlaku. Dapatkan nasihat tentang tindakan yang harus dilakukan sekarang. |

### Teks pernyataan pada commit PR #1

| Versi | Alur | Teks persetujuan |
|---|---|
| `adult-18plus-2026-10-v1` | Akun | Saya menyatakan berusia 18 tahun ke atas dan membuat akun ini untuk digunakan sendiri. |
| `child-rsvp-guardian-2026-10-v1` | RSVP | Saya orang tua/wali yang berwenang dan menyetujui TamuKita memproses data anak ini untuk mencatat kehadiran dan menyampaikannya kepada pengundang. |
| `child-guestbook-guardian-2026-10-v1` | Buku tamu | Saya orang tua/wali yang berwenang dan menyetujui TamuKita memproses ucapan dan data anak ini serta menyampaikannya kepada pengundang. Saya memahami bahwa setelah disetujui pengundang, ucapan ini dapat tampil pada halaman undangan yang bisa dilihat publik. |

Naskah ini tampil dalam kode pada PR #1 dan belum menjadi kebijakan publik. Operator dan penasihat hukum perlu mengesahkan tujuan, konteks pemberitahuan, dan masa penyimpanan bukti consent sebelum rilis.

Permenkomdigi 9/2026 memuat kelompok usia 3–5, 6–9, 10–12, 13–15, serta 16 hingga belum 18 tahun, dan melarang penargetan layanan kepada anak di bawah 3 tahun. Peraturan juga meminta penilaian risiko per fitur atas tujuh aspek di bawah. Operator dan penasihat hukum harus menentukan penerapan ketentuan tersebut pada produk ini sebelum mengisi batas usia atau profil risiko.

## 2. Inventaris fitur yang perlu dinilai

Catatan berikut hanya menggambarkan perilaku aplikasi yang terlihat pada kode; ini bukan kesimpulan kepatuhan atau tingkat risiko.

| Produk/fitur | Perilaku aplikasi saat ini | Pertanyaan pelindungan anak | Bukti kode/konfigurasi yang perlu disimpan |
|---|---|---|---|
| Akun pelanggan dan editor | Kode staging meminta deklarasi usia 18+ pada pendaftaran dan onboarding/atur ulang, mencatat waktu/versi, dan menolak login/sesi tanpa catatan. Pengumpulan tanggal lahir atau verifikasi umur formal tidak ada. QA visual memeriksa deklarasi wajib di desktop 1280×720 dan mobile 390×844; E2E menjalankan pendaftaran, verifikasi email mock, login, pemulihan/reset kata sandi. | Apakah self-attestation mencukupi untuk tiap fitur? Bagaimana akun lama mengulang persetujuan dan kapan izin wali diperlukan? | Register/reset flow, `User`, versi teks consent, hasil CI/staging, tinjauan counsel. |
| Halaman undangan publik | Halaman terbit menggunakan slug publik, dapat memuat teks, jadwal, lokasi, foto, informasi hadiah, dan musik. | Apakah halaman dapat dibuka anak? Konten apa yang dapat dipilih pemilik? Bagaimana risiko paparan konten dan data pribadi ditangani? | Renderer publik, field editor, aturan publikasi, laporan/takedown, contoh konten uji. |
| RSVP | Tamu dapat mengirim nama, kehadiran, dan jumlah peserta tanpa akun. Kode staging memperingatkan agar tidak memasukkan kontak/data sensitif anak, meminta penanda data anak, lalu mewajibkan pernyataan wali dan menyimpan waktu/versi consent. QA visual staging memeriksa pilihan hadir/tidak hadir, jumlah tamu kondisional, consent, dan keyboard; E2E CI menyimpan consent RSVP sintetis di database disposable. | Apakah tamu memahami tujuan dan penerima data? Dapatkah anak melewatkan penanda? Siapa yang melihat dan kapan data dihapus? | Form/API, tinjauan copy notice, kontrol akses pemilik, retensi, bukti QA/E2E, consent yang disahkan. |
| Buku tamu dan laporan ucapan | Ucapan baru menunggu persetujuan pemilik; ucapan yang tampil dapat dilaporkan dengan alasan terstruktur. Kode staging memperingatkan agar tidak memasukkan kontak/data sensitif anak, meminta penanda data anak, mewajibkan consent wali, dan mencatat waktu/versi. QA visual memeriksa consent kondisional; E2E CI menyimpan consent buku tamu sintetis di database disposable. | Dapatkah anak berinteraksi dengan orang tak dikenal atau melihat/mengirim konten berisiko? Bagaimana laporan anak/wali dan banding ditangani? | Alur moderasi, tinjauan notice, kanal laporan, SLA, audit, eskalasi, bukti penghapusan/pemulihan, E2E CI/staging. |
| Daftar tamu dan tautan pribadi | Pemilik undangan dapat mengelola daftar tamu, kontak, dan tautan RSVP bertoken. | Bagaimana data dan tautan anak dilindungi dari publikasi, penyalinan, penemuan, dan akses tanpa izin? | Model guest/link, izin anggota workspace, mekanisme revoke, retensi dan audit akses. |
| Media foto dan musik | Pengguna dapat mengunggah/crop media; sumber tertentu disimpan privat dan hasil yang dipilih dapat tampil publik. | Bagaimana menghindari publikasi identitas anak tanpa dasar/izin? Adakah metadata lokasi? Siapa menghapus media dan salinannya? | Alur EXIF, bucket visibility, consent, penghapusan objek/varian/backup. |
| Checkout dan kredit reseller | Checkout Xendit dilindungi sesi akun; commit PR #1 menolak login/sesi akun yang belum mencatat deklarasi usia 18+. | Apakah self-attestation cukup untuk pembelian? Apakah verifikasi tambahan, persetujuan wali, dan refund khusus diperlukan? | Jalur autentikasi, checkout, copy harga, kontrol usia, refund, alur reseller, iklan/promosi, tinjauan counsel. |
| Berbagi ke layanan lain | Pengguna dapat membagikan tautan undangan secara manual/eksternal. | Apa yang terjadi ketika anak diarahkan ke layanan pihak ketiga? Apakah pengguna diberi informasi dan kontrol yang sesuai? | Tombol share, deep link, kebijakan/notice, inventaris layanan eksternal. |

Referensi pemeriksaan utama pada kode saat ini mencakup `src/app/[slug]/page.tsx`, `src/app/api/public/invitations/[slug]/rsvp/route.ts`, `src/app/api/public/invitations/[slug]/guestbook/route.ts`, `src/app/api/public/invitations/[slug]/guestbook/[entryId]/reports/route.ts`, `src/app/dashboard/invitations/[id]/guests/`, dan `prisma/schema.prisma`.

## 3. Penilaian mandiri tujuh aspek

Untuk setiap fitur pada inventaris, catat indikator yang relevan, kemungkinan dampak, kontrol yang sudah berjalan, kekurangan, bukti, pemilik tindakan, dan keputusan penasihat hukum. Jangan mengisi profil risiko sebelum penilaian disahkan operator.

| Aspek menurut aturan | Temuan awal dari produk | Prioritas kontrol internal, bukan profil hukum | Mitigasi yang dipilih |
|---|---|---|---|
| Kontak dengan orang tak dikenal | Tidak ada pesan langsung atau jejaring pengguna. RSVP dan ucapan dapat dikirim ke halaman publik; data tamu dan tautan terbatas juga tersedia bagi pemilik workspace. | Sedang | Batasi field publik; jangan menampilkan RSVP/kontak; sediakan laporan dan pembatasan/takedown yang dipantau. |
| Paparan konten | Pemilik dapat menerbitkan teks, jadwal, lokasi, foto, hadiah, dan musik. Ucapan menunggu persetujuan pemilik sebelum tampil; moderasi konten undangan tidak terbukti. | Tinggi | Larang eksploitasi/pelecehan anak; sediakan kanal laporan aktif; takedown cepat; tinjau konten publik dan aset anak. |
| Eksploitasi anak sebagai konsumen | Checkout, lisensi, aktivasi, hosting, dan top-up tersedia; commit PR #1 menambahkan gate pernyataan 18+ untuk sesi akun, tanpa verifikasi umur formal. | Sedang | Uji login/checkout di staging setelah migrasi; sahkan kecukupan self-attestation; tak ada iklan/upsell anak; tampilkan harga dan refund jelas. |
| Keamanan data pribadi anak | Nama RSVP, jumlah hadir, daftar tamu/kontak, foto dan lokasi dapat dikumpulkan atau ditampilkan; pilihan consent wali berlaku untuk RSVP/ucapan. E2E CI memeriksa consent tersimpan dan retensi pada PostgreSQL disposable, termasuk pesanan tertunda, laporan belum selesai, dan retry penghapusan objek memakai adapter sintetis. Sweep tetap default nonaktif; uji sweep live, R2 nyata, backup, CDN, penghapusan akun/draf, dan legal hold belum dibuktikan. | Tinggi | Uji consent dan purge sintetis; minimalisasi field, jangan tampilkan data RSVP, batasi akses workspace; tinjau consent foto, ekspor, penghapusan, dan retensi. |
| Adiksi/penggunaan berlebihan | Tidak ada feed sosial, rekomendasi, streak, atau notifikasi berulang yang mendorong durasi; musik hanya dimainkan setelah klik. | Rendah | Pertahankan kontrol musik manual dan tidak menambahkan pola pemaksaan perhatian tanpa penilaian ulang. |
| Kesehatan psikologis | Ucapan dapat memuat pelecehan; ada moderasi pemilik dan laporan ucapan, tetapi cakupan laporan lain serta SLA belum operasional. | Sedang | Larang perundungan, ancaman, grooming, dan pelecehan; sediakan laporan yang mudah ditemukan, eskalasi, banding, serta audit moderator. |
| Kesehatan fisiologis | Halaman web biasa; tidak ditemukan autoplay audio, feed tanpa batas, atau fitur yang mengharuskan penggunaan lama. | Rendah | Pertahankan musik hanya atas tindakan pengguna, hormati reduced motion, dan tinjau ulang bila fitur berubah. |

Prioritas Sedang/Tinggi pada tabel adalah penilaian teknik untuk mengurutkan mitigasi saja. Ini **bukan** pengisian skor regulator atau penetapan profil resmi. Penetapan akhir harus menggunakan instrumen pada Kepmenkomdigi 142/2026 sebagaimana diubah 219/2026, disahkan operator, lalu dilaporkan bila diwajibkan. Profil resmi tidak ditetapkan di draf ini.

## 4. Kontrol dan rencana tindak lanjut

| Temuan | Tindakan yang disetujui | Status |
|---|---|---|
| Akun lama belum memiliki bukti pernyataan usia dan verifikasi umur formal belum tersedia. | Terapkan pernyataan usia 18+ tanpa menyimpan tanggal lahir; pastikan akun tanpa catatan tidak bisa login atau bertransaksi. | Kode pada draft PR #1 meminta pernyataan saat pendaftaran dan reset kata sandi, menolak login/sesi tanpa catatan, serta menyimpan waktu/versi. QA visual memeriksa deklarasi wajib di staging; akun lama perlu menyetujui melalui pemulihan. Kontrol ini bukan verifikasi umur formal dan perlu legal review. |
| Undangan publik, RSVP, dan buku tamu dapat diakses tanpa akun. | Anggap bisa diakses anak; minta persetujuan wali bila data anak dicantumkan, minimalisasi data, jangan tampilkan respons RSVP, dan sediakan report/takedown. | QA visual staging memeriksa pilihan data anak dan consent kondisional; E2E CI menguji submission sintetis, consent, flow report, antrean moderator, sembunyikan/pulihkan, dan audit pada database disposable. Formulir tidak dikirim dalam QA visual. Gate usia/rentang usia dan verifikasi anak untuk fitur publik belum diimplementasikan; notice disahkan, tinjauan operator/legal, cakupan laporan, petugas, banding, dan SLA operasional masih belum ada. |
| Batas/rentang usia dan perlakuan verifikasi anak untuk fitur publik belum tersedia. | Tetapkan strategi akses anak per fitur setelah operator/counsel mengonfirmasi teks resmi dan menyelesaikan penilaian. | Belum ada implementasi/informasi usia publik. Jangan menyimpulkan cakupan persis dari PDF yang tertaut karena salinannya bertanda “RANCANGAN”; catatan JDIH/BPK berstatus berlaku dan menyebut topik tersebut. |
| Moderasi laporan saat ini berfokus pada ucapan buku tamu. | Tetapkan cakupan laporan untuk semua konten publik, SLA, eskalasi child safety, banding, dan bukti tindakan. | E2E CI menguji report, antrean moderator, sembunyikan/pulihkan, dan baris audit pada PostgreSQL disposable. Petugas/kontak aktif, SLA, cakupan report selain ucapan, banding, dan operasi live masih terbuka. |
| Purge akun, RSVP, media, log, dan backup belum dijalankan menurut jadwal yang dipilih. | Implementasikan jadwal di `PRIVACY.md`, ekspor sebelum purge, dan audit penghapusan menyeluruh. | E2E CI menguji aturan retensi dengan PostgreSQL disposable dan adapter penghapusan objek sintetis; sweep live staging/production, R2 nyata, log, cache/CDN, dan backup belum dijalankan. |
| Status penilaian/laporan kepada Komdigi tidak ada di repo. | Konfirmasi filing sebelumnya; jika tidak ada, minta nasihat hukum segera dan simpan bukti langkah korektif. | Gate prioritas; tenggat awal 6 Juni 2026 telah lewat bila berlaku. |
| Penilaian resmi belum disahkan. | Selesaikan lembar kerja per fitur menggunakan indikator terbaru, sahkan oleh operator, dan tetapkan siklus review. | Menunggu identitas operator dan penasihat hukum. |

## 5. Persetujuan, pelaporan, dan review ulang

- **Ruang lingkup dan profil risiko yang disetujui:** [ISI PER PRODUK/LAYANAN/FITUR]
- **Tanggal pengesahan internal dan pejabat yang mengesahkan:** [ISI]
- **Tanggal dan bukti pelaporan kepada Komdigi bila diwajibkan:** [ISI]
- **Tanggal peninjauan berikutnya:** 26 Januari 2027, atau lebih cepat jika produk, akses anak, vendor, atau peraturan berubah.
- **Pemicu penilaian ulang:** perubahan fitur/teknologi, perubahan data atau akses publik, temuan insiden/laporan, perubahan risiko, dan perubahan peraturan.
- **Dokumen bukti yang disimpan:** penilaian mandiri, lampiran teknis, notula review internal/eksternal, bukti laporan, tindak lanjut, versi aplikasi, dan riwayat perubahan.

## 6. Rujukan resmi

- [UU 27 Tahun 2022 tentang Pelindungan Data Pribadi — JDIH BPK](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022-10), khususnya Pasal 25 tentang persetujuan orang tua/wali untuk pemrosesan data pribadi anak.
- [PP 17 Tahun 2025 — JDIH BPK](https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025)
- [Permenkomdigi 9 Tahun 2026 — JDIH BPK](https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026)
- [Record resmi Permenkomdigi 9 Tahun 2026 — JDIH Kemkomdigi](https://jdih.komdigi.go.id/produk_hukum/view/id/1007/t/peraturan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B9%2Btahun%2B2026) (status tercatat berlaku; salinan PDF pada record dimulai dengan tanda “RANCANGAN”, sehingga teks Berita Negara perlu dikonfirmasi)
- [Kepmenkomdigi 142 Tahun 2026 — indikator dan petunjuk penilaian](https://jdih.komdigi.go.id/index.php/produk_hukum/view/id/1009/t/keputusan-menteri-komunikasi-dan-digital-nomor-142-tahun-2026)
- [Kepmenkomdigi 219 Tahun 2026 — perubahan atas Kepmen 142/2026](https://jdih.komdigi.go.id/index.php/produk_hukum/view/id/1011/t/keputusan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B219%2Btahun%2B2026)

Lembar kerja ini belum membuktikan bahwa TamuKita telah memenuhi kewajiban. Temuan/priority internal di atas mengarahkan pekerjaan mitigasi, tetapi tidak menggantikan penilaian regulator, pengesahan operator, atau opini penasihat hukum untuk model dan fitur yang benar-benar dijalankan.

