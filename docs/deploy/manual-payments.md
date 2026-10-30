# Rilis pembayaran QR manual

Keputusan pemilik produk, 30 Oktober 2026: rilis awal memakai QR pembayaran asli milik operator dan konfirmasi melalui WhatsApp. Gateway tidak diperlukan untuk order baru pada mode manual.

## Konfigurasi

- `PAYMENT_MODE=manual` merupakan default. Konfigurasi database pada Admin → Pengaturan dapat memilih metode pembayaran.
- Super Admin mengunggah QRIS pembayaran asli dan mengisi WhatsApp konfirmasi. Gambar disimpan sebagai PNG pada bucket media publik di prefix `platform/payment-qr/`; kontak dan URL disimpan pada pengaturan platform, bukan repository.
- Checkout berbayar hanya tersedia bila QR dan WhatsApp lengkap. QR belum dikonfigurasi menghasilkan pesan pembayaran belum tersedia; aplikasi tidak berpindah otomatis ke gateway.
- Setiap order menyimpan snapshot QR, kontak, nominal, dan item. Perubahan pengaturan berlaku untuk order baru.
- Uji QR asli dengan aplikasi pembayaran dan pastikan merchant tujuan benar sebelum membuka checkout kepada pelanggan. Screenshot QA sintetis tidak boleh dipakai sebagai QR pembayaran.

## Alur pelanggan dan admin

1. Pelanggan memilih paket atau kredit. Server membuat order `PENDING`, lalu membuka halaman QR pada akun pelanggan.
2. Pelanggan memindai QR, memasukkan nominal yang ditampilkan, dan mengirim bukti melalui tautan WhatsApp. TamuKita tidak mengirim pesan WhatsApp secara otomatis.
3. Super Admin atau Finance memeriksa dana masuk pada mutasi, membuka Order & refund, mengisi nominal dan referensi transaksi, lalu mengonfirmasi dana masuk.
4. Satu transaksi database mencatat pembayaran, audit verifier, dan entitlement. Lisensi/hosting, perpanjangan, atau top-up kredit menggunakan pemenuhan order yang sama dengan pembayaran gateway. Konfirmasi ulang yang sama tidak menambah grant atau saldo.
5. Draft yang belum valid tetap tersimpan untuk dilengkapi setelah pembayaran. Order yang belum dibayar dapat dibatalkan dengan alasan oleh admin.
6. Pengembalian dana dilakukan operator melalui bank/e-wallet. Admin mencatat nominal, alasan, referensi transfer pengembalian, dan pernyataan dana telah dikirim. Kredit reseller yang sudah terpakai tetap tidak dapat direfund; refund penuh menonaktifkan hak dari order sesuai aturan yang ada.

## Gate rilis

Mode manual menggantikan kebutuhan gateway pada checkout baru. Gate email akun, penyimpanan media production, isolasi database, Tunnel/hostname production, backup/restore, alert, identitas operator, dan dokumen operasional tetap diperiksa tersendiri.

Migrasi `20261030000000_manual_payment_provider` menambahkan provider `MANUAL` tanpa mengubah order atau sesi gateway yang sudah ada. Webhook gateway tetap dapat merekonsiliasi transaksi historis.

QA perlu membuktikan pembatasan akses, penolakan nominal salah, verifikasi admin, duplikasi referensi, aktivasi satu kali, renewal satu kali, top-up/refund kredit, pembatalan order, serta tampilan mobile. CI memakai QR sintetis yang bukan sarana pembayaran dan database disposable.

## Bukti lokal 30 Oktober 2026

Migrasi 19 tahap berhasil pada PostgreSQL disposable khusus pengujian. Unit test 117 lulus; lint, typecheck, dan production build lulus. Tiga skenario E2E keuangan lulus: konfigurasi QR melalui UI, checkout dan verifikasi manual, konflik konfirmasi bersamaan, lisensi/renewal/top-up/refund serta rekonsiliasi, dan regresi callback/refund gateway. Screenshot desktop dan ponsel 390×844 memakai QR sintetis berlabel QA. Hasil ini tidak membuktikan transfer uang, QR merchant asli, atau deployment production.
