# Deployment Dokploy

## Status saat ini — 18 Oktober 2026

- Project Dokploy: `tamukita`.
- Environment `production` memakai layanan Compose `tamukita`.
- Environment `staging` memakai layanan Compose `tamukita-staging` dan `tamukita-staging-tunnel`.
- Layanan aplikasi staging mengambil repository `kuloryan1/tamukita`, branch `main`, dan `./docker-compose.yml`. Connector mengambil repository yang sama dan branch `main`, dengan Compose path `./docker-compose.staging-tunnel.yml`.
- Auto-deploy mati pada kedua layanan staging. Aplikasi `tamukita-staging` belum pernah dideploy; connector `tamukita-staging-tunnel` sudah dideploy dan berjalan.
- Domain Dokploy `staging.tamukita.io` sudah diarahkan ke service `web`, port `3000`, path `/`; panel menampilkan HTTP dan `Cert: none`. Perubahan domain perlu diterapkan melalui deploy Compose.
- Environment connector memiliki `TUNNEL_TOKEN` yang tersimpan sebagai secret layanan Dokploy; token tidak dicatat di repository. Cloudflare melaporkan Tunnel `tamukita-staging` sehat dengan satu replica. Rute `staging.tamukita.io` → `http://dokploy-traefik:80` aktif pada Tunnel baru. Route lama pada `tigakaki1` sudah dihapus; Cloudflare ikut menghapus CNAME lama, lalu CNAME proxied dibuat ulang agar menunjuk ke Tunnel baru.
- Request HTTPS ke `https://staging.tamukita.io/api/health` masih mengembalikan 502. Log connector menunjukkan `dokploy-traefik` gagal di-resolve (`lookup dokploy-traefik on 127.0.0.11:53: no such host`), meskipun connector dikonfigurasi pada network `dokploy-network`. Koneksi ke origin melalui Tunnel belum berfungsi.
- Environment aplikasi menampilkan nilai tersamarkan. Keberadaan/kecocokan `NEXT_PUBLIC_APP_URL`, `POSTGRES_PASSWORD`, dan `AUTH_SECRET` belum dapat dikonfirmasi; verifikasi nama variabel dan nilainya di Dokploy sebelum deploy tanpa menyalin atau membagikan secret.
- Layanan Compose mengekspos web secara internal pada port `3000`. PostgreSQL dan Redis tidak memublikasikan port ke host.

Rate limit memakai alamat dari elemen terakhir `X-Forwarded-For`, yang ditambahkan Traefik dari alamat peer yang terhubung langsung. Aplikasi mengabaikan `X-Real-IP` dan mengembalikan `unknown` jika nilai terakhir bukan alamat IP yang valid. Pertahankan lalu lintas aplikasi melalui Traefik Dokploy dan jangan aktifkan `forwardedHeaders.notAppendXForwardedFor`; bila ada proxy lain di depan Traefik, konfigurasikan proxy itu sebagai sumber forwarded header tepercaya pada Traefik.

Pemisahan environment Dokploy belum berarti staging siap menerima trafik. Sebelum deploy, pastikan konfigurasi aplikasi, penyimpanan, database, dan kredensial staging terpisah dari production.

## Persiapan staging

1. Connector khusus `tamukita-staging` sudah berjalan dari image `cloudflare/cloudflared:2026.10.1` pada network `dokploy-network`; `TUNNEL_TOKEN` tersimpan hanya di environment rahasia layanan Dokploy. Jangan commit token ke repository atau memasukkannya ke environment tingkat project. Lihat [panduan Tunnel resmi Dokploy](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels) dan [rilis resmi cloudflared](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.1).
2. Rute `staging.tamukita.io` aktif pada Tunnel baru dengan origin `http://dokploy-traefik:80`; CNAME proxied mengarah ke Tunnel baru. Route lama pada `tigakaki1` sudah dihapus. HTTPS masih menghasilkan 502 karena log menunjukkan nama `dokploy-traefik` tidak bisa di-resolve dari connector. Selesaikan konektivitas network/origin sebelum menyatakan hostname sehat.
3. Simpan dan verifikasi nilai environment aplikasi di pengaturan layanan Compose staging Dokploy. Jangan simpan secret di variabel tingkat project karena variabel project tersedia untuk semua layanan di project tersebut.
4. Isi variabel wajib dengan nilai khusus staging:
   - `NEXT_PUBLIC_APP_URL` — origin HTTPS staging.
   - `POSTGRES_PASSWORD` — password database staging yang acak dan tidak dipakai production.
   - `AUTH_SECRET` — secret autentikasi acak khusus staging.
5. Siapkan kredensial Xendit **Test Mode**, bucket R2 non-production, dan konfigurasi email uji bila alur tersebut akan diuji. Jangan memakai kredensial atau bucket production.
6. Periksa lagi nama Compose project, domain, URL publik, dan semua kredensial agar staging tidak tersambung ke data production.
7. Setelah origin dapat dijangkau, jalankan deploy aplikasi secara manual. Setelah migrasi dan container sehat, periksa `https://staging.tamukita.io/api/health` dan selesaikan smoke test alur yang akan diuji.
8. Jalankan pengujian LCP atau load hanya setelah staging benar-benar terisolasi. Workflow `staging-quality` juga meminta origin HTTPS, path undangan uji yang sudah diterbitkan, serta konfirmasi operator bahwa target siap menerima hingga 1.000 virtual user.

Jangan menganggap pembuatan environment atau service sebagai deployment aplikasi yang berhasil. Connector Tunnel sudah berjalan, tetapi service aplikasi belum dideploy dan hostname publik belum lolos health check.

## Persiapan production

1. Pasang domain HTTPS production dan arahkan ke service `web` pada port `3000`.
2. Buat nilai rahasia production tersendiri melalui secret store Dokploy. Jangan gunakan nilai staging atau contoh di `.env.example`.
3. Konfigurasikan kredensial production Xendit, R2, Resend, backup, dan webhook alert hanya setelah keputusan operasional/legal yang masih terbuka disetujui.
4. Jalankan deploy manual pertama, periksa migrasi dan `/api/health`, kemudian lakukan smoke test transaksi dan pemulihan yang disepakati.
5. Aktifkan smoke check eksternal dan alert setelah URL health serta endpoint webhook tersedia.
6. Nyalakan auto-deploy hanya setelah prosedur rilis dan rollback production ditetapkan.

Skrip backup memakai endpoint Cloudflare R2 dari `R2_ACCOUNT_ID` secara default. Biarkan `BACKUP_S3_ENDPOINT` kosong dan `BACKUP_S3_ALLOW_HTTP=false` pada VPS. Override endpoint tersedia untuk integration drill S3-compatible; HTTP hanya diizinkan untuk host lokal yang dibatasi oleh skrip dan harus memakai flag eksplisit.

Sesudah container production pertama berjalan, temukan nama Compose project yang dipakai Dokploy dengan `docker ps --filter 'label=com.docker.compose.service=postgres' --format '{{.Names}} {{.Label "com.docker.compose.project"}}'`. Isi nama itu ke `BACKUP_COMPOSE_PROJECT_NAME` pada `/etc/tamukita/backup.env`; helper backup/restore mencari satu container PostgreSQL berdasarkan label project tersebut dan service `postgres`, tanpa bergantung pada nama direktori Compose di host.

## Gate yang belum selesai

- Tunnel `tamukita-staging` sehat, token tersimpan sebagai secret layanan Dokploy, route baru aktif, dan DNS publik `staging.tamukita.io` mengarah ke Tunnel baru. Route lama `staging.tamukita.io` pada `tigakaki1` sudah dihapus. Request masih 502 karena connector tidak dapat me-resolve `dokploy-traefik` pada DNS Docker (`127.0.0.11`); selesaikan akses origin dan verifikasi HTTPS serta `/api/health`.
- Service aplikasi `tamukita-staging` belum dideploy. Nama dan nilai environment wajib aplikasi belum diverifikasi.
- Operator belum memberikan path undangan publik QA atau konfirmasi tertulis bahwa target terisolasi siap menerima hingga 1.000 virtual user.
- Isolasi staging dari production belum dibuktikan melalui deployment dan pemeriksaan konfigurasi runtime.
- Uji Xendit Test Mode, R2 nyata, restore di VPS, LCP, load 1.000 VU, dan monitoring eksternal belum dijalankan.
- Keputusan operator untuk identitas/kontak, retensi data, refund, pelindungan anak, vendor/lokasi pemrosesan, serta tinjauan legal masih terbuka.
