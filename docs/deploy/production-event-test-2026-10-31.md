# Production untuk uji acara — 31 Oktober 2026

Production diaktifkan setelah operator menyetujui pembuatan Tunnel khusus,
secret production yang belum tersedia, dan cutover apex `tamukita.io`.
Ini adalah aktivasi infrastruktur untuk uji acara; pengujian unggah Paparazi
pada acara production dan kamera ponsel sungguhan masih belum dilakukan.

## Source dan deployment

- Aplikasi: `0e7737c8c782972461f1828b75274d30df335808`, branch `main`,
  `./docker-compose.yml`, service production `tamukita`.
- Deployment aplikasi selesai `Done` dalam 34 detik. Web, worker, PostgreSQL,
  dan Redis sehat; migrasi selesai dengan exit code 0.
- Connector: service production `tamukita-production-tunnel`, repository dan
  branch yang sama, `./docker-compose.production-tunnel.yml`.
- Auto-deploy aplikasi dan connector tetap mati. Dokumentasi setelah source
  di atas tidak memerlukan deployment ulang aplikasi.
- Preflight pertama berhenti sebelum pembuatan container karena
  `POSTGRES_PASSWORD` belum tersedia. Environment production kemudian diisi
  dengan password database dan auth secret baru yang unik; nilainya hanya
  disimpan di pengaturan secret service Dokploy, bukan repository atau chat.

## Domain dan isolasi

- HTTPS `tamukita.io` → Tunnel `tamukita-production` → `http://web:3000`.
- Cloudflare melaporkan Tunnel sehat dengan satu replica, cloudflared
  `2026.10.1`. Token disimpan hanya pada service connector production.
- Inspeksi runtime: connector hanya pada `tamukita-production-origin`.
  Web berada pada origin tersebut dan `tamukita-tamukita-hadbj0_default`;
  tidak ada `dokploy-network` pada kedua container tersebut.
- Apex sebelumnya adalah A `2.57.91.91`, proxied, TTL Auto. Record tersebut
  diganti dengan CNAME proxied menuju Tunnel production. Cloudflare berhasil
  menyimpan route; pembuatan DNS otomatis berbenturan dengan A lama sehingga
  perubahan tipe dan target dilakukan pada record apex yang sama.
- Record `staging`, `media-staging`, dan `www` dipertahankan. Route `www`
  belum dikonfigurasi; hostname uji yang dipilih adalah apex.

## Penyimpanan foto

- `PAPARAZZI_STORAGE_DRIVER=server`; R2 tidak diaktifkan untuk unggahan baru.
- Web dan worker memasang volume production yang sama:
  `tamukita-tamukita-hadbj0_tamukita-paparazzi` → `/data/paparazzi`, RW.
- Volume ini berbeda dari staging. Tidak ada kuota jumlah foto; batas per file
  10 MB, batas decoding 40 MP, reserve disk 512 MiB, dan retensi 90 hari tetap
  berlaku. Galeri diperbarui setiap 5 detik selama tab terlihat.
- Kapasitas nominal server bukan alokasi ruang kosong khusus foto. Ruang
  efektif setelah deployment belum diperiksa melalui filesystem production.

## Bukti publik setelah cutover

Pemeriksaan 31 Oktober 2026 pukul 20:32 WIB, dengan validasi TLS aktif:

| Pemeriksaan | Hasil |
|---|---|
| Homepage, login, pendaftaran, demo Taman Abadi | HTTP 200 |
| `/api/health` production | HTTP 200 JSON; database, Redis, worker `ok` |
| Dashboard anonim | HTTP 307 menuju `/login` |
| API pemilik Paparazi anonim | HTTP 401 |
| Token album publik yang tidak ada | HTTP 404 |
| `/api/health` staging setelah cutover | HTTP 200; ketiga dependensi `ok` |

Homepage juga dibuka melalui browser dengan HTTPS dan menampilkan TamuKita,
bukan halaman parkir. Navigasi memakai origin production; HTML tidak memuat
origin staging atau localhost.

Repository variable `PRODUCTION_HEALTH_URL=https://tamukita.io/api/health`
sudah diisi. [Production smoke #41205836504](https://github.com/kuloryan1/tamukita/actions/runs/41205836504)
lulus pada source `0e7737c`; workflow yang sudah ada memeriksa health tiap jam.
Webhook alert production belum tersedia, sehingga kegagalan terlihat di GitHub
Actions dan belum dikirim ke inbox/on-call eksternal.

## Pemeriksaan yang masih terbuka

- Tentukan undangan production, pemilik akun, dan waktu acara untuk membuat QR
  sebenarnya. Fixture dan seeder staging tidak dijalankan pada production.
- Uji scan QR, kamera ponsel sungguhan, unggah, galeri publik, dan unduh pemilik
  pada acara production. Alur server ini sudah lulus dengan foto sintetis di
  staging, tetapi bukti itu tidak menggantikan uji production.
- Pergantian container pada VPS dengan volume foto tetap terpasang serta
  backup/restore database dan volume foto VPS belum dites. Persistensi lintas
  container sudah lulus pada Docker lokal.
- Pembayaran tetap manual. QR pembayaran asli dan provider email production
  belum disiapkan dalam aktivasi infrastruktur ini; Xendit live tidak diaktifkan.

Untuk rollback routing, kembalikan hanya apex ke A `2.57.91.91`, proxied, TTL
Auto. Jangan hapus volume database/foto, mengganti secret, atau mengubah record
staging saat melakukan rollback aplikasi. Jangan menjalankan `down -v`.
