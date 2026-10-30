# Syarat Layanan TamuKita

> **DRAF INTERNAL — keputusan operasional awal ditetapkan 26 Oktober 2026.** Identitas operator, kontak aktif, dan tinjauan penasihat hukum masih diperlukan sebelum dipublikasikan.

**Operator:** [ISI NAMA BADAN USAHA/OPERATOR DAN ALAMAT]

**Kontak dukungan/pengaduan (pilihan internal):** `bantuan@tamukita.io` — belum diverifikasi; satu inbox yang dipantau untuk support, refund, dan pengaduan.

**Tanggal versi draf:** 30 Oktober 2026

**Berlaku sejak:** [ISI SETELAH DISETUJUI OPERATOR]

## 1. Ruang lingkup layanan

TamuKita menyediakan editor undangan digital, template, hosting halaman undangan, pengumpulan RSVP dan ucapan, pengelolaan media, serta fitur akun/workspace dan reseller. Fitur yang tersedia dapat berubah; informasi harga, masa layanan, dan isi paket yang ditampilkan sebelum checkout menjadi rujukan transaksi terkait.

Pada implementasi saat ini tidak ada paket berlangganan otomatis. Pembelian lisensi, aktivasi, top-up kredit, dan perpanjangan hosting adalah transaksi terpisah sesuai yang ditampilkan di checkout/admin. Operator harus memperbarui ketentuan ini bila model harga berubah.

## 2. Akun dan akses

Pemilik akun, pembeli, reseller, dan pengembang harus berusia paling sedikit 18 tahun. Saat pendaftaran atau onboarding/atur ulang kata sandi, TamuKita meminta pernyataan bahwa pengguna sudah berusia 18 tahun atau lebih, tanpa mengumpulkan tanggal lahir. Waktu dan versi pernyataan dicatat. Pengguna wajib memberi informasi akun yang benar, menjaga rahasia kredensial, dan segera melaporkan dugaan penggunaan tanpa izin ke `keamanan@tamukita.io` setelah alias itu aktif dan terpantau. Pemilik workspace mengatur anggota dan izin. Pengguna hanya boleh mengakses data yang diizinkan untuk perannya.

Anak dapat membuka halaman undangan publik. Anak di bawah 18 tahun tidak boleh membuat akun, membeli layanan, atau mengelola akun reseller. Orang tua/wali mengisi RSVP dan ucapan atas nama anak. Bila RSVP mencantumkan data anak, form meminta pernyataan wali dan menyampaikan bahwa datanya dipakai untuk mencatat kehadiran serta disampaikan kepada pengundang. Bila ucapan mencantumkan data anak, form menjelaskan bahwa setelah disetujui pengundang ucapan dapat tampil pada halaman undangan publik. Aplikasi mencatat waktu dan versi persetujuan yang berbeda untuk RSVP dan buku tamu. Wali memastikan mereka berhak memberikan data/foto anak. TamuKita tidak menargetkan promosi kepada anak. Pemberitahuan ini tidak menggantikan penilaian mandiri atau kewajiban desain pelindungan anak yang berlaku.

Operator dapat membatasi akses segera untuk menangani risiko keamanan/anak yang sedang berlangsung, penipuan, perintah hukum, atau pelanggaran berat. Jika hukum tidak melarang, operator memberi tahu pelanggan dalam 1 hari kerja dengan alasan dan langkah pemulihan. Pelanggan dapat meminta peninjauan dalam 14 hari melalui `bantuan@tamukita.io`; petugas menargetkan jawaban dalam 5 hari kerja. Tindakan darurat dapat tetap berlaku selama risiko diperiksa.

## 3. Isi undangan dan tanggung jawab pengguna

Pengguna mempertahankan hak atas konten yang mereka unggah sejauh mereka memang memilikinya. Pengguna menyatakan memiliki hak dan izin yang diperlukan atas foto, nama, teks, musik, font, merek, lokasi, dan data orang lain yang dimasukkan; termasuk izin yang diwajibkan untuk menampilkan informasi kepada publik atau memproses RSVP.

Pengguna memberi operator izin terbatas, non-eksklusif, dan selama diperlukan untuk meng-host, mengubah ukuran/memproses, menyimpan, membuat backup, dan menampilkan konten hanya untuk menyediakan, mengamankan, serta memperbaiki layanan sesuai pengaturan pengguna. Hak cipta konten pengguna tidak berpindah kepada operator. Ketentuan lebih rinci ada di [Lisensi Template dan Unggahan](./TEMPLATE-AND-MEDIA-LICENSE.md).

Jangan mengunggah konten yang melanggar hukum, hak pihak lain, privasi, atau kebijakan konten. Dilarang mengunggah konten yang mengeksploitasi, menampilkan secara seksual, mengancam, mempermalukan, atau membocorkan data pribadi anak. Jangan memublikasikan foto atau informasi anak tanpa izin orang tua/wali yang sah. Ucapan publik harus dimoderasi sebelum tampil; laporan dugaan bahaya terhadap anak dapat dikirim ke `keamanan@tamukita.io` setelah alias itu aktif dan dipantau. Petugas dan SLA penanganannya harus tersedia sebelum publikasi.

## 4. Template, lisensi, dan publikasi

Harga dan jenis lisensi template ditampilkan sebelum transaksi. Pembelian lisensi dicatat untuk satu undangan sesuai versi template yang dipilih; perubahan atau penerbitan versi template baru tidak otomatis mengganti versi yang telah tertaut pada undangan. Lisensi template memberikan hak menggunakan desain dalam layanan sesuai batasan yang diterbitkan, bukan kepemilikan atas kode, desain, font, musik, atau aset pihak ketiga.

Jika biaya aktivasi berlaku, biaya itu ditampilkan sebagai komponen terpisah. Undangan baru dipublikasikan setelah pembayaran QR diverifikasi admin, webhook penyedia pembayaran tervalidasi jika gateway digunakan, atau kredit reseller yang sah dicatat oleh sistem. Halaman publik, RSVP, dan buku tamu dapat berhenti berfungsi ketika masa hosting berakhir. Perpanjangan tersedia mulai 30 hari sebelum tanggal akhir hingga sebelum lewat 30 hari sesudah tanggal itu; setelah batas tersebut, perpanjangan ditutup sesuai jadwal penghapusan media. Harga/durasi yang ditampilkan saat transaksi berlaku untuk pesanan tersebut sesuai snapshot transaksi. Ketentuan ini masih draf internal dan harus diselaraskan dengan checkout serta ditinjau penasihat hukum.

## 5. Pembayaran dan refund

Peluncuran awal menggunakan QR pembayaran manual yang ditampilkan saat checkout. Pembeli mengirim bukti melalui tautan WhatsApp pada halaman pembayaran. Bukti saja belum mengaktifkan layanan; admin harus mencocokkan nominal dan referensi dengan dana yang benar-benar masuk. Jika gateway diaktifkan kemudian, status transaksi gateway mengikuti konfirmasi penyedia. Pengajuan refund ditinjau dan diproses sesuai hukum yang berlaku, Kebijakan Refund, metode pembayaran asal, dan status penyedia.

Lihat [Kebijakan Refund](./REFUNDS.md). Batasan teknis sistem tidak mengurangi hak konsumen yang tidak dapat dikesampingkan oleh perjanjian.

## 6. Fitur reseller

Reseller harus berusia minimal 18 tahun, mendapat persetujuan operator, dan menandatangani ketentuan reseller tertulis sebelum menjual. Untuk peluncuran awal, akses reseller bersifat undangan; tidak ada komisi/margin atau hak jual ulang otomatis tanpa perjanjian tertulis yang menyebut harga, pajak, dukungan, dan tanggung jawab sebelum transaksi. Pelanggan harus menyetujui permintaan akses sebelum reseller dapat melihat draf pelanggan. Kredit aktivasi digunakan sesuai tipe template dan saldo dicatat berdasarkan lot top-up. Kredit berbayar tidak kedaluwarsa; refund kredit berbayar yang utuh dan belum digunakan mengikuti [Kebijakan Refund](./REFUNDS.md).

## 7. Privasi dan data tamu

Penggunaan data dijelaskan pada [Pemberitahuan Privasi](./PRIVACY.md). Pelanggan yang mengumpulkan data tamu harus menyampaikan informasi yang sesuai kepada tamu, hanya meminta data yang diperlukan, menjaga akses, dan merespons permintaan tamu yang diteruskan kepadanya. Pembagian peran pengendali/pemroses harus dikonfirmasi operator dan penasihat hukum.

## 8. Ketersediaan, penghentian, dan penyelesaian sengketa

TamuKita tidak menjanjikan persentase ketersediaan sebelum pemantauan layanan dan jalur kompensasi dibuktikan. Operator akan mengumumkan pemeliharaan terencana jika memungkinkan. Dukungan menargetkan konfirmasi dalam 2 hari kerja dan jawaban dalam 5 hari kerja; tenggat hukum yang lebih singkat tetap didahulukan. Penghentian hosting menutup akses publik sesuai perilaku produk, tetapi data hanya dihapus mengikuti jadwal retensi setelah mekanisme purge dan ekspor siap.

Keluhan konsumen dapat diajukan ke `bantuan@tamukita.io` setelah inbox itu aktif dan diuji. Petugas menargetkan konfirmasi dalam 2 hari kerja dan jawaban dalam 5 hari kerja. Jalur penyelesaian sengketa eksternal, hukum yang berlaku, serta forum sengketa harus disahkan penasihat hukum: **[ISI SETELAH TINJAUAN HUKUM]**.

## 9. Ketentuan finalisasi

Sebelum persetujuan elektronik diterapkan, tampilkan versi dan tanggal syarat, berikan tautan yang dapat disimpan pengguna, rekam bukti persetujuan secara proporsional, dan pastikan alur checkout menjelaskan komponen harga, pajak/biaya bila berlaku, masa hosting, dan mekanisme komplain.

