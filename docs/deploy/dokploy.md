# Deployment Dokploy

## Status saat ini — 19 Oktober 2026

- Project Dokploy: `tamukita`.
- Environment `production` memakai layanan Compose `tamukita`.
- Environment `staging` memakai layanan Compose `tamukita-staging` dan `tamukita-staging-tunnel`.
- Layanan aplikasi staging mengambil repository `kuloryan1/tamukita`, branch `main`, dan `./docker-compose.yml`. Connector mengambil repository yang sama dan branch `main`, dengan Compose path `./docker-compose.staging-tunnel.yml`.
- Auto-deploy mati pada kedua layanan staging. Aplikasi `tamukita-staging` sudah dideploy manual dari `main`; connector `tamukita-staging-tunnel` juga berjalan.
- Domain `staging.tamukita.io` diarahkan oleh Tunnel Cloudflare `tamukita-staging` ke web staging pada port `3000` melalui network khusus `tamukita-staging-xwcuty_staging-origin`. Container Tunnel hanya berada di network origin ini. Web berada di network origin, network privat Dokploy `tamukita-staging-xwcuty`, dan network Compose `tamukita-staging-xwcuty_default`; web tidak terhubung ke `dokploy-network`. Worker, PostgreSQL, dan Redis hanya berada di network privat Dokploy. Panel Dokploy masih menyimpan domain service `web:3000` dengan HTTP dan `Cert: none`; HTTPS publik disediakan oleh Cloudflare Tunnel.
- Environment connector memiliki `TUNNEL_TOKEN` yang tersimpan sebagai secret layanan Dokploy; token tidak dicatat di repository. Cloudflare melaporkan Tunnel `tamukita-staging` sehat dengan satu replica. Route lama pada `tigakaki1` sudah dihapus; CNAME proxied `staging.tamukita.io` menunjuk ke Tunnel baru.
- Pemeriksaan publik terakhir: `https://staging.tamukita.io/` menjawab HTTP 200 dengan judul TamuKita, dan `/api/health` menjawab HTTP 200 dengan database, Redis, dan worker berstatus `ok`.
- Apex `https://tamukita.io/` belum diarahkan ke aplikasi production. Pemeriksaan GET `https://tamukita.io/api/health` saat ini menjawab HTTP 200 dengan judul `Parked Domain name on Hostinger DNS system`; ini halaman parkir Hostinger, bukan health check TamuKita. Jangan gunakan URL itu sebagai `PRODUCTION_HEALTH_URL` sampai domain production benar-benar menunjuk ke aplikasi.
- Record Cloudflare yang terlihat: A `tamukita.io` → `2.57.91.91` (Proxied), CNAME `www` → `tamukita.io` (Proxied), dan CNAME `staging` → Tunnel `tamukita-staging` (Proxied). Dokploy environment `production` memiliki Compose service `tamukita` dari `main`, tetapi panel menampilkan “No containers found”; belum ada origin aplikasi production untuk domain apex.
- Environment service aplikasi sudah memiliki `NEXT_PUBLIC_APP_URL=https://staging.tamukita.io`, `POSTGRES_PASSWORD`, dan `AUTH_SECRET` khusus staging. Nilai rahasia hanya tersimpan pada service Dokploy; jangan menyalin atau membagikannya.
- GitHub environment `staging` sudah dibuat dan memuat variable non-rahasia `STAGING_BASE_URL=https://staging.tamukita.io`. Environment ini belum memiliki secret atau variable lain.
- Deployment manual terbaru dari branch `main` memakai commit `d4ee944` dan berstatus `Done` di Dokploy. Health check publik `https://staging.tamukita.io/api/health` menjawab HTTP 200 dengan database, Redis, dan worker berstatus `ok`. PostgreSQL, Redis, dan web berstatus sehat, migrasi keluar dengan kode 0, dan worker berjalan. Docker Compose menetapkan `HOSTNAME: 0.0.0.0`, sehingga probe healthcheck ke `127.0.0.1` bekerja. File `src/lib/email-transport.ts` sudah disertakan pada worker image.
- Layanan Compose mengekspos web secara internal pada port `3000`. PostgreSQL dan Redis tidak memublikasikan port ke host.
- Pemeriksaan Dokploy pada 19 Oktober 2026 setelah deployment mengonfirmasi Tunnel hanya berada di `tamukita-staging-xwcuty_staging-origin`; web berada di network origin ini serta dua network privat staging. Worker, PostgreSQL, dan Redis hanya berada di `tamukita-staging-xwcuty`. Tidak satu pun container staging tersebut memakai `dokploy-network`. PostgreSQL memakai volume bernama khusus staging yang dipasang ke `/var/lib/postgresql/data`. Container migrasi selesai dengan kode 0. Pencarian semua container dengan nama `tamukita` sebelumnya menemukan web, worker, migrasi, PostgreSQL, Redis, dan Tunnel staging, tanpa container production TamuKita yang berjalan.

Rate limit memakai alamat dari elemen terakhir `X-Forwarded-For`; Cloudflare menyetel header ini ke `CF-Connecting-IP` saat tidak ada proxy sebelumnya, dan menambahkan alamat proxy terakhir bila ada proxy berantai. Aplikasi mengabaikan `X-Real-IP` dan mengembalikan `unknown` jika nilai terakhir bukan alamat IP yang valid. Pertahankan DNS Cloudflare sebagai **Proxied** untuk domain staging; jika menambah proxy lain, verifikasi bahwa ia menambahkan hop terpercaya sebelum mengubah pemrosesan alamat. [Dokumentasi header Cloudflare](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

Health check yang lulus belum berarti QA blueprint selesai. Sebelum menjalankan transaksi atau load test, pastikan database, penyimpanan, dan semua kredensial staging terpisah dari production serta fixture uji tersedia.

## Persiapan staging

1. Connector khusus `tamukita-staging` berjalan dari image `cloudflare/cloudflared:2026.10.1` dan hanya bergabung ke external network `tamukita-staging-xwcuty_staging-origin`; `TUNNEL_TOKEN` tersimpan hanya di environment rahasia layanan Dokploy. Jangan commit token ke repository atau memasukkannya ke environment tingkat project. Lihat [panduan Tunnel resmi Dokploy](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels) dan [rilis resmi cloudflared](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.1).
2. Rute `staging.tamukita.io` pada Tunnel baru mengarah ke web staging port `3000` lewat network origin khusus; CNAME proxied mengarah ke Tunnel baru dan pemeriksaan HTTPS lulus. Route lama pada `tigakaki1` sudah dihapus. Tunnel tidak berbagi network dengan service Dokploy lain.
3. Environment aplikasi sudah menyimpan `NEXT_PUBLIC_APP_URL`, `POSTGRES_PASSWORD`, dan `AUTH_SECRET` khusus staging pada service Compose Dokploy. Jangan menyalin atau membagikan nilai rahasia.
4. Siapkan nilai khusus staging di **service environment Dokploy** untuk alur yang hendak diuji. Jangan menaruh nilai ini di repo, project environment bersama, atau chat:
   - Xendit Test Mode: `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, `XENDIT_REFUND_WEBHOOK_TOKEN`.
   - Email uji: `RESEND_API_KEY`, `EMAIL_FROM` dengan sender yang sudah diverifikasi.
   - R2 non-production: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PRIVATE_BUCKET_NAME`, `R2_PUBLIC_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`.
5. Siapkan konfigurasi backup/restore host pada `/etc/tamukita/backup.env` dari `scripts/backup.env.example`: `BACKUP_COMPOSE_PROJECT_NAME`, `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY`, `BACKUP_BUCKET`, dan `BACKUP_AGE_RECIPIENT`. Simpan private age identity di luar repository dan image deployment; restore memakai `BACKUP_AGE_IDENTITY_FILE`.
6. GitHub environment `staging` sudah memiliki `STAGING_BASE_URL=https://staging.tamukita.io`. Setelah undangan QA dipublikasikan, isi `STAGING_INVITATION_PATH` dengan path slug publik tersebut. `PRODUCTION_HOSTNAMES` opsional, untuk hostname production tambahan yang dipisahkan koma; default `tamukita.io` dan `www.tamukita.io` selalu diblokir. `PRODUCTION_HEALTH_URL` hanya diperlukan untuk smoke check setelah health endpoint production benar-benar live.
7. Periksa nama Compose project, volume database, bucket, akun Xendit, sender email, domain, dan URL agar staging tidak tersambung ke data production. Siapkan undangan QA dengan foto dan konten representatif sebelum uji LCP.
8. Isolasi runtime telah diverifikasi pada container aktif: Tunnel hanya pada network origin khusus; web bergabung dengan network origin serta network privat staging; worker, PostgreSQL, dan Redis hanya pada network privat staging. Tidak ada container tersebut di `dokploy-network`. Volume PostgreSQL bernama khusus staging dan pencarian sebelumnya tidak menemukan service production TamuKita yang berjalan. Pastikan semua provider staging tetap memakai akun dan data non-production sebelum uji beban atau pilot.
9. Stack terakhir dideploy manual dari `main` pada commit `d4ee944`. Dockerfile worker menyertakan `src/lib/email-transport.ts`, service web memakai `HOSTNAME: 0.0.0.0`, semua container health check lulus, dan endpoint publik `/api/health` mengembalikan HTTP 200.
10. Jalankan pengukuran LCP atau load hanya setelah staging terisolasi, fixture siap, dan operator mengonfirmasi kesiapan hingga 1.000 virtual user. Workflow `staging-quality` menguji LCP p75, lalu load API health dan undangan publik masing-masing sampai 1.000 VU.

Deployment Compose staging sehat. Cloudflare Tunnel menjangkau web melalui network origin khusus; stack staging tidak lagi memakai `dokploy-network`. Halaman utama dan `/api/health` lulus pemeriksaan publik.

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

- Tunnel `tamukita-staging` sehat dengan satu replica; token tersimpan sebagai secret layanan Dokploy. DNS `staging.tamukita.io` menunjuk ke Tunnel baru; route lama pada `tigakaki1` sudah dihapus. Tunnel hanya bergabung dengan network origin khusus yang juga dipakai web staging; pemeriksaan halaman dan `/api/health` publik lulus.
- Domain apex `tamukita.io` masih menampilkan halaman parked Hostinger. HTTPS production dan URL health aplikasi production belum tersedia; HTTP 200 pada halaman parkir tidak memenuhi gate production.
- Service aplikasi staging sehat: worker, PostgreSQL, Redis, migrasi, dan health check web lulus. Isolasi network runtime dari `dokploy-network` telah diverifikasi pada container aktif. Jalankan QA blueprint setelah fixture undangan uji dan kredensial non-production siap.
- GitHub environment `staging` dan variable `STAGING_BASE_URL` sudah tersedia. Path undangan publik QA dan variable `STAGING_INVITATION_PATH` masih belum diberikan. GET ke slug CI `/e2e-supported-publication` pada staging menjawab 404, sehingga seed E2E lokal tidak tersedia sebagai fixture publik di VPS. Konfirmasi operator bahwa target staging terisolasi dan siap menerima hingga 1.000 virtual user juga masih diperlukan sebelum workflow load dijalankan.
- Isolasi runtime staging sudah diverifikasi: Tunnel hanya berada di network origin; web berada di network origin dan network privat staging; worker, PostgreSQL, serta Redis hanya berada di network privat. Tidak ada container staging yang bergabung ke `dokploy-network`. PostgreSQL memakai volume khusus staging; container production TamuKita tidak berjalan pada pemeriksaan sebelumnya. Pastikan konfigurasi provider non-production sebelum menjalankan load test atau pilot.
- Uji Xendit Test Mode, R2 nyata, restore di VPS, LCP, load 1.000 VU, dan monitoring eksternal belum dijalankan.
- Keputusan operator untuk identitas/kontak, retensi data, refund, pelindungan anak, vendor/lokasi pemrosesan, serta tinjauan legal masih terbuka.
