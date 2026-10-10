# Lembar kerja penilaian pelindungan anak — TamuKita

> **DRAF KERJA INTERNAL — belum dinilai, disahkan, atau dilaporkan.** Ini membantu operator mengumpulkan bukti; dokumen ini bukan penetapan profil risiko dan bukan pendapat hukum.

**Tanggal pemeriksaan kode:** 10 Oktober 2026  
**Operator/PSE:** [ISI BADAN USAHA DAN NOMOR PSE, JIKA BERLAKU]  
**Penanggung jawab internal:** [ISI NAMA/JABATAN]  
**Narahubung pelaporan:** [ISI NAMA/JABATAN/KONTAK]  
**Penasihat hukum:** [ISI]  
**Versi produk/commit yang dinilai:** [ISI]

## 1. Keputusan cakupan yang belum dibuat

Permenkomdigi 9/2026 mencakup Produk, Layanan, dan Fitur yang dirancang untuk anak maupun yang mungkin digunakan atau diakses anak. Karena halaman undangan dapat dibuka publik dan fitur RSVP/buku tamu dapat dipakai tamu undangan, operator harus menilai setiap fitur berdasarkan penggunaan nyatanya; jangan menganggap layanan di luar cakupan hanya karena pembuat akun ditargetkan dewasa.

| Pertanyaan | Keputusan operator | Bukti dan penanggung jawab |
|---|---|---|
| Entitas mana yang menjadi PSE/operator untuk domain dan layanan ini? | [BELUM DIPUTUSKAN] | [ISI] |
| Produk/layanan/fitur mana yang mungkin diakses anak dan siapa penggunanya? | [BELUM DIPUTUSKAN] | [ISI] |
| Apakah ada fitur yang secara khusus dirancang atau ditargetkan kepada anak? | [BELUM DIPUTUSKAN] | [ISI] |
| Batas minimum usia dan rentang usia yang ditetapkan untuk tiap fitur? | [BELUM DIPUTUSKAN] | [ISI] |
| Mekanisme verifikasi usia, persetujuan orang tua/wali, dan kontrol orang tua yang diperlukan? | [BELUM DIPUTUSKAN] | [ISI] |
| Apakah profil risiko tinggi atau rendah untuk tiap fitur, dan atas dasar apa? | [BELUM DIPUTUSKAN] | [ISI] |
| Apakah penilaian mandiri telah dilaporkan ke Komdigi? Jika belum, status/tindakan apa yang diwajibkan untuk operator ini? | [BELUM DIPUTUSKAN] | [ISI SEGERA; DOKUMENTASIKAN BUKTI] |

Permenkomdigi 9/2026 memuat kelompok usia 3–5, 6–9, 10–12, 13–15, serta 16 hingga belum 18 tahun, dan melarang penargetan layanan kepada anak di bawah 3 tahun. Peraturan juga meminta penilaian risiko per fitur atas tujuh aspek di bawah. Operator dan penasihat hukum harus menentukan penerapan ketentuan tersebut pada produk ini sebelum mengisi batas usia atau profil risiko.

## 2. Inventaris fitur yang perlu dinilai

Catatan berikut hanya menggambarkan perilaku aplikasi yang terlihat pada kode; ini bukan kesimpulan kepatuhan atau tingkat risiko.

| Produk/fitur | Perilaku aplikasi saat ini | Pertanyaan pelindungan anak | Bukti kode/konfigurasi yang perlu disimpan |
|---|---|---|---|
| Akun pelanggan dan editor | Pengguna mendaftar dan membuat undangan; tidak ada batas usia atau verifikasi usia yang teridentifikasi pada skema/alur akun yang diperiksa. | Siapa boleh memiliki akun? Bagaimana usia diverifikasi dengan pengumpulan data seminimal mungkin? Kapan izin wali diperlukan? | Alur register, skema `User`, naskah usia/izin wali, hasil tinjauan counsel. |
| Halaman undangan publik | Halaman terbit menggunakan slug publik, dapat memuat teks, jadwal, lokasi, foto, informasi hadiah, dan musik. | Apakah halaman dapat dibuka anak? Konten apa yang dapat dipilih pemilik? Bagaimana risiko paparan konten dan data pribadi ditangani? | Renderer publik, field editor, aturan publikasi, laporan/takedown, contoh konten uji. |
| RSVP | Tamu dapat mengirim nama, kehadiran, dan jumlah peserta; RSVP dapat dikirim tanpa akun. | Dapatkah anak mengirim data tanpa sepengetahuan wali? Data apa yang diperlukan? Siapa yang melihat dan kapan data dihapus? | Form/API RSVP, pemberitahuan privasi kepada tamu, kontrol akses pemilik, retensi. |
| Buku tamu dan laporan ucapan | Ucapan baru menunggu persetujuan pemilik; ucapan yang tampil dapat dilaporkan dengan alasan terstruktur dan ditinjau moderator. | Dapatkah anak berinteraksi dengan orang tak dikenal atau melihat/mengirim konten berisiko? Bagaimana laporan dari anak/wali dan banding ditangani? | Alur moderasi, kanal laporan, SLA, audit, eskalasi, bukti penghapusan/pemulihan. |
| Daftar tamu dan tautan pribadi | Pemilik undangan dapat mengelola daftar tamu, kontak, dan tautan RSVP bertoken. | Bagaimana data dan tautan anak dilindungi dari publikasi, penyalinan, penemuan, dan akses tanpa izin? | Model guest/link, izin anggota workspace, mekanisme revoke, retensi dan audit akses. |
| Media foto dan musik | Pengguna dapat mengunggah/crop media; sumber tertentu disimpan privat dan hasil yang dipilih dapat tampil publik. | Bagaimana menghindari publikasi identitas anak tanpa dasar/izin? Adakah metadata lokasi? Siapa menghapus media dan salinannya? | Alur EXIF, bucket visibility, consent, penghapusan objek/varian/backup. |
| Checkout dan kredit reseller | Produk menyediakan checkout Xendit untuk lisensi/aktivasi/renewal/top-up reseller. | Apakah anak dapat membeli atau menjadi target penawaran? Perlukah batas transaksi/izin wali dan prosedur refund khusus? | Checkout, copy harga, kontrol usia, refund, alur reseller dan iklan/promosi. |
| Berbagi ke layanan lain | Pengguna dapat membagikan tautan undangan secara manual/eksternal. | Apa yang terjadi ketika anak diarahkan ke layanan pihak ketiga? Apakah pengguna diberi informasi dan kontrol yang sesuai? | Tombol share, deep link, kebijakan/notice, inventaris layanan eksternal. |

Referensi pemeriksaan utama pada kode saat ini mencakup `src/app/[slug]/page.tsx`, `src/app/api/public/invitations/[slug]/rsvp/route.ts`, `src/app/api/public/invitations/[slug]/guestbook/route.ts`, `src/app/api/public/invitations/[slug]/guestbook/[entryId]/reports/route.ts`, `src/app/dashboard/invitations/[id]/guests/`, dan `prisma/schema.prisma`.

## 3. Penilaian mandiri tujuh aspek

Untuk setiap fitur pada inventaris, catat indikator yang relevan, kemungkinan dampak, kontrol yang sudah berjalan, kekurangan, bukti, pemilik tindakan, dan keputusan penasihat hukum. Jangan mengisi profil risiko sebelum penilaian disahkan operator.

| Aspek menurut aturan | Indikator yang harus diperiksa untuk TamuKita | Temuan/bukti | Risiko awal | Mitigasi, pemilik, tenggat |
|---|---|---|---|---|
| Kontak dengan orang tak dikenal | Halaman publik, kiriman ucapan, daftar undangan/tautan, kemampuan menemukan atau berinteraksi dengan pengguna yang tidak dikenal; kebutuhan kontrol orang tua jika fitur memungkinkan kontak anak. | [ISI] | [BELUM DINILAI] | [ISI] |
| Paparan konten | Konten undangan dan media yang ditulis/diunggah pemilik; ucapan tamu; jenis moderasi sebelum dan sesudah publikasi; penemuan dan takedown konten. | [ISI] | [BELUM DINILAI] | [ISI] |
| Eksploitasi anak sebagai konsumen | Promosi/penawaran produk, harga, lisensi, pembayaran satu kali, kredit reseller, siapa yang ditargetkan, kontrol pembelian dan refund. | [ISI] | [BELUM DINILAI] | [ISI] |
| Keamanan data pribadi anak | Nama, RSVP, kontak daftar tamu, foto/media, visibilitas publik, persetujuan wali, pembatasan akses, transfer/vendor, retensi dan penghapusan. | [ISI] | [BELUM DINILAI] | [ISI] |
| Adiksi/penggunaan berlebihan | Fitur, desain, notifikasi, rekomendasi, streak, feed, atau mekanisme lain yang mendorong frekuensi/durasi penggunaan. | [ISI] | [BELUM DINILAI] | [ISI] |
| Kesehatan psikologis | Perundungan/pelecehan dalam ucapan, paparan konten, interaksi dengan orang tak dikenal, penawaran komersial, dan dampak fitur lainnya. | [ISI] | [BELUM DINILAI] | [ISI] |
| Kesehatan fisiologis | Dampak penggunaan layar, audio, media, aksesibilitas, dan fitur lain pada kondisi fisik/fungsi biologis anak. | [ISI] | [BELUM DINILAI] | [ISI] |

Permenkomdigi 9/2026 menetapkan profil risiko tinggi jika terdapat satu atau lebih aspek dengan tingkat risiko tinggi; profil rendah hanya bila seluruh aspek dinilai rendah. Penetapan akhir dan bukti pelaporannya merupakan keputusan operator setelah review hukum dan penilaian lengkap.

## 4. Kontrol dan rencana tindak lanjut

| Temuan | Tindakan yang disetujui | Penanggung jawab | Tenggat | Status/bukti |
|---|---|---|---|---|
| Belum ada batas usia, verifikasi usia, atau kontrol wali yang terdokumentasi pada alur akun. | [PUTUSKAN SETELAH KLASIFIKASI FITUR] | [ISI] | [ISI] | [ISI] |
| Undangan publik dan RSVP dapat diakses tanpa akun. | [NILAI PAPARAN, NOTICE, DATA MINIMIZATION, DAN RETENSI] | [ISI] | [ISI] | [ISI] |
| Laporan konten saat ini berfokus pada ucapan buku tamu. | [TENTUKAN CAKUPAN KONTEN LAIN, LAPORAN ANAK/WALI, SLA, BANDING, TAKEDOWN] | [ISI] | [ISI] | [ISI] |
| Retensi penuh dan purge untuk akun, RSVP, media, log, dan backup belum ditetapkan. | [ISI MASA SIMPAN DAN BUKTI PURGE] | [ISI] | [ISI] | [ISI] |
| Status penilaian mandiri dan pelaporan kepada Komdigi belum diketahui. | [VERIFIKASI STATUS DENGAN OPERATOR/COUNSEL; TENTUKAN TINDAKAN DAN SIMPAN BUKTI] | [ISI] | [ISI] | [ISI] |

## 5. Persetujuan, pelaporan, dan review ulang

- **Ruang lingkup dan profil risiko yang disetujui:** [ISI PER PRODUK/LAYANAN/FITUR]
- **Tanggal pengesahan internal dan pejabat yang mengesahkan:** [ISI]
- **Tanggal dan bukti pelaporan kepada Komdigi bila diwajibkan:** [ISI]
- **Tanggal peninjauan berikutnya:** [ISI]
- **Pemicu penilaian ulang:** perubahan fitur/teknologi, perubahan data atau akses publik, temuan insiden/laporan, perubahan risiko, dan perubahan peraturan.
- **Dokumen bukti yang disimpan:** penilaian mandiri, lampiran teknis, notula review internal/eksternal, bukti laporan, tindak lanjut, versi aplikasi, dan riwayat perubahan.

## 6. Rujukan resmi

- [PP 17 Tahun 2025 — JDIH BPK](https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025)
- [Permenkomdigi 9 Tahun 2026 — JDIH BPK](https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026)
- [Teks Permenkomdigi 9 Tahun 2026 — JDIH Kemkomdigi](https://jdih.komdigi.go.id/produk_hukum/unduh/id/1007/t/peraturan%2Bmenteri%2Bkomunikasi%2Bdan%2Bdigital%2Bnomor%2B9%2Btahun%2B2026)

Lembar kerja ini tidak menyimpulkan bahwa TamuKita berada pada profil risiko tertentu, telah memenuhi kewajiban, atau perlu/tidak perlu melakukan tindakan tertentu. Operator wajib memperoleh penilaian hukum untuk model dan fitur yang benar-benar dijalankan.

