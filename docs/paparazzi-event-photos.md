# Paparazi acara

Pemilik membuka **Dashboard → Paparazi** pada undangannya, lalu memilih
**Siapkan QR & buka unggahan**. QR dapat diunduh sebagai PNG/SVG atau dicetak.
Tamu memindai QR, memilih **Buka kamera** atau **Pilih dari galeri**, memeriksa
pratinjau, menyetujui pembagian publik, lalu membagikan foto.

Foto langsung tampil di galeri acara setelah pemeriksaan file dan pemrosesan
selesai. Tidak ada tahap persetujuan pemilik. Pemilik dapat menyembunyikan,
menampilkan kembali, mengunduh, atau menghapus foto; menutup unggahan;
menentukan waktu tutup; dan mengganti QR. Menutup unggahan tetap memungkinkan
tamu melihat galeri selama undangan dan masa hosting aktif. Mengganti QR
menonaktifkan tautan lama untuk unggahan dan akses foto.

## Batas dan akses

- Unggahan dibuka hanya untuk undangan terbit, hosting aktif, dan organisasi aktif.
- QR dapat disiapkan untuk draft; unggahan tetap tertutup sampai undangan aktif.
- Maksimal 200 foto aktif per acara, 10 MB per unggahan, JPG/PNG/WebP.
- Pengunggah menyatakan berusia minimal 18 tahun dan memiliki izin membagikan foto.
  Foto anak memerlukan pernyataan persetujuan orang tua/wali untuk publikasi.
- Galeri dapat dilihat tanpa login melalui QR atau tautan acara dan diberi `noindex`.
- Kontrol pemilik memeriksa pemilik undangan dan keanggotaan organisasi aktif.
- Laporan konten masuk ke moderasi undangan; peninjau dapat membuka galeri acara.
  Penangguhan undangan juga menutup akses publik ke foto.
- Kamera menggunakan izin browser hanya pada `/paparazi/*`, dengan pilihan kamera
  bawaan HP dan pemilihan file sebagai jalur cadangan.

## Penyimpanan dan pemrosesan

`PaparazziAlbum` dan `PaparazziPhoto` menyimpan metadata di PostgreSQL.
Foto tidak dimasukkan ke `MediaAsset` milik undangan. Input tersimpan pada bucket
R2 privat di `private/pending/paparazzi/`; output di `private/paparazzi/`.
API memeriksa status undangan, masa simpan, status foto, visibilitas, dan versi
persetujuan sebelum mengirim foto publik. Bucket publik tidak digunakan.

Outbox `NotificationJob` mengantrekan `PAPARAZZI_PROCESSING` dan
`PAPARAZZI_DELETE` ke worker. Worker memeriksa ukuran, MIME, isi gambar,
batas piksel, dan halaman; merotasi orientasi; mengubah gambar menjadi JPEG
maksimal 2400 piksel; serta menghapus metadata EXIF/lokasi dan file input.
Receipt unggahan disimpan sebagai hash dan tidak menjadi bagian URL.

Foto disimpan maksimal 90 hari sejak unggah dan paling lama 30 hari setelah
hosting berakhir. Pemeliharaan setiap 15 menit membersihkan file kedaluwarsa,
dihapus, reservasi terbengkalai, dan pemrosesan yang macet. Penghapusan pemilik
juga memiliki pekerjaan outbox tersendiri. Terapkan lifecycle R2 yang sudah ada
untuk `private/pending/` sebagai cadangan pembersihan input terlambat.

## Validasi dan rilis

Migrasi `20261030010000_paparazzi_event_photos` menambahkan dua tabel.
Rilis aplikasi dan worker bersama; image worker menyalin seluruh helper baru.
Jika melakukan rollback, tutup unggahan lebih dahulu dan periksa pekerjaan
Paparazi yang belum selesai sebelum mengembalikan worker versi lama.

Unit test memeriksa URL QR, batas file, persetujuan, status akses, dan retensi.
E2E memakai akun khusus `E2E_PAPARAZZI_CUSTOMER_EMAIL/PASSWORD`, database
disposable yang dijaga, R2 mock, dan kamera Chromium simulasi. Skenarionya
membaca QR sebenarnya, mengambil foto, memeriksa publikasi otomatis,
pemisahan pemilik, file palsu, EXIF, kapasitas serentak, kontrol visibilitas,
penutupan, penghapusan, moderasi, dan pencabutan QR. Kamera HP fisik dan
pemindaian kamera HP harus dicatat terpisah dari hasil kamera simulasi.

Acara demo staging dapat dibuat lewat `db:seed:staging-paparazzi-fixture`
dengan `--confirm-staging-paparazzi-fixture` dan
`STAGING_PAPARAZZI_OWNER_EMAIL` milik Super Admin yang sudah ada. Skrip
hanya menerima origin staging, memberi penanda lisensi/hosting khusus QA
selama 14 hari, mencatat audit, dan tidak membuat transaksi pembayaran.
Menjalankannya ulang mengembalikan tautan fixture tanpa mengubah isinya.
