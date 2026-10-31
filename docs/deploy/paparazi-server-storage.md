# Paparazi: penyimpanan server untuk uji acara

Keputusan 31 Oktober 2026: uji acara memakai disk server, dengan perkiraan 300 tamu
dan sekitar 60 pengunggah. Jumlah foto per acara tidak diberi kuota. Foto langsung
masuk galeri publik acara setelah validasi dan pemrosesan, tanpa persetujuan pemilik.
Galeri tamu dan pemilik diperbarui otomatis setiap 5 detik saat tab terlihat.

## Konfigurasi saat ini

```dotenv
PAPARAZZI_STORAGE_DRIVER=server
PAPARAZZI_MIN_FREE_BYTES=536870912
```

Compose memasang named volume `tamukita-paparazzi` pada `/data/paparazzi` untuk web
dan worker. Direktori dimiliki UID/GID 1001 dan tidak dipublikasikan sebagai file
statis. Nama volume mengikuti project Compose, sehingga staging dan production
memakai volume berbeda. Web dan worker harus berada di host yang sama dan memakai
volume yang sama. Jalur storage dalam Compose ditetapkan `/data/paparazzi`.

Development lokal memakai `.local-storage/paparazzi` kecuali
`PAPARAZZI_STORAGE_DIR` diisi dengan jalur absolut. Folder tersebut dikecualikan
dari Git dan Docker build context.

Unggahan memakai API origin sendiri dengan receipt per foto. File sumber ditulis
secara atomik dan hanya boleh diulang dengan isi sama. Worker mengubah gambar
menjadi JPEG maksimal 2400 px, membuang EXIF, lalu menghapus sumber. Hanya foto
READY yang memenuhi status undangan, consent, retensi, dan visibilitas yang bisa
dibaca lewat galeri. Pemilik tetap dapat menyembunyikan atau menghapus foto.
Pembersihan foto kadaluarsa dan file sementara tetap berjalan tanpa kredensial R2.

Tidak ada kuota jumlah foto pada album baru maupun album lama setelah migrasi.
Batas per file tetap 10 MB dan 40 juta piksel untuk proses gambar. Cadangan ruang
512 MiB menolak penulisan baru sebelum disk habis. Pembatasan permintaan jaringan
tetap melindungi API; batas reservasi mengakomodasi tamu yang memakai Wi-Fi bersama.
Retensi tetap maksimal 90 hari, sesuai informasi pada halaman pemilik.

## Verifikasi sebelum acara

1. Pastikan target adalah service production yang benar, `NEXT_PUBLIC_APP_URL`
   adalah `https://tamukita.io`, dan domain mengarah ke aplikasi melalui Tunnel.
2. Deploy migrasi dan build web/worker dari commit yang sama. Periksa kedua
   container memasang volume `tamukita-paparazzi` yang sama; worker sehat.
3. Periksa ruang kosong host dan volume. Kapasitas server 200 GB adalah informasi
   operator; ruang kosong efektif perlu diperiksa langsung pada server.
4. Dari undangan yang aktif, buka Paparazi, siapkan QR, lalu uji scan menggunakan
   ponsel sungguhan. Unggah foto, periksa galeri publik dan unduh dari akun pemilik.
5. Buat ulang container web/worker tanpa menghapus volume, lalu pastikan foto uji
   masih terbaca. Sertakan volume foto dan database dalam backup acara; lakukan
   restore ke volume terpisah untuk memeriksa salinannya.

Pada 31 Oktober pukul 20:32 WIB, production sudah aktif melalui Tunnel khusus
dan `/api/health` menjawab JSON dengan database, Redis, serta worker `ok`.
Inspeksi mount web dan worker membuktikan keduanya memakai volume production
`tamukita-tamukita-hadbj0_tamukita-paparazzi` pada `/data/paparazzi`, RW.
Unggah pada acara production, kamera ponsel sungguhan, ruang kosong filesystem,
dan backup/restore VPS masih belum dites. Lihat
[catatan aktivasi production](production-event-test-2026-10-31.md) untuk bukti
publik dan ruang lingkup pemeriksaan.

## Saat beralih ke R2

Set `PAPARAZZI_STORAGE_DRIVER=r2` setelah bucket privat dan kredensial R2 siap.
Setiap foto menyimpan `storageProvider` sendiri. Migrasi database memberi foto
lama provider R2; foto yang dibuat selama uji server memakai SERVER. Pergantian
driver hanya mengubah lokasi unggahan baru. Foto lama tetap dibaca dari provider
asal, sehingga volume server dan kredensial R2 lama harus tetap tersedia selama
masih dipakai. Untuk memindahkan foto uji lama, lakukan migrasi salinan dan verifikasi
objek R2 sebelum mengubah provider atau menghapus salinan server.

Konfigurasi ini khusus foto Paparazi. Penyimpanan media undangan dan QR pembayaran
mengikuti konfigurasi media yang sudah ada.
