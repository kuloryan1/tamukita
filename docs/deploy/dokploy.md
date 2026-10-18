# Deployment Dokploy

## Status saat ini — 19 Oktober 2026

- Project Dokploy: `tamukita`.
- Environment `production` memakai layanan Compose `tamukita`.
- Environment `staging` memakai layanan Compose `tamukita-staging` dan `tamukita-staging-tunnel`.
- Layanan aplikasi staging mengambil repository `kuloryan1/tamukita`, branch `main`, dan `./docker-compose.yml`. Connector mengambil repository yang sama dan branch `main`, dengan Compose path `./docker-compose.staging-tunnel.yml`.
- Auto-deploy mati pada kedua layanan staging. Aplikasi `tamukita-staging` sudah dideploy manual dari `main`; connector `tamukita-staging-tunnel` juga berjalan.
- Domain `staging.tamukita.io` diarahkan oleh Tunnel Cloudflare langsung ke container web staging pada `dokploy-network` (`http://tamukita-staging-xwcuty-web-1:3000`). Route melewati proxy global Dokploy karena container `dokploy-traefik` tidak tersedia/resolvable pada host ini. Panel Dokploy juga masih menyimpan domain service `web:3000` dengan HTTP dan `Cert: none`; trafik publik staging memakai Tunnel.
- Environment connector memiliki `TUNNEL_TOKEN` yang tersimpan sebagai secret layanan Dokploy; token tidak dicatat di repository. Cloudflare melaporkan Tunnel `tamukita-staging` sehat dengan satu replica. Route lama pada `tigakaki1` sudah dihapus; CNAME proxied `staging.tamukita.io` menunjuk ke Tunnel baru.
- Pemeriksaan publik terakhir: `https://staging.tamukita.io/` menjawab HTTP 200 dengan judul TamuKita, dan `/api/health` menjawab HTTP 200 dengan database, Redis, dan worker berstatus `ok`.
- Apex `https://tamukita.io/` belum diarahkan ke aplikasi production. Pemeriksaan GET `https://tamukita.io/api/health` saat ini menjawab HTTP 200 dengan judul `Parked Domain name on Hostinger DNS system`; ini halaman parkir Hostinger, bukan health check TamuKita. Jangan gunakan URL itu sebagai `PRODUCTION_HEALTH_URL` sampai domain production benar-benar menunjuk ke aplikasi.
- Record Cloudflare yang terlihat: A `tamukita.io` → `2.57.91.91` (Proxied), CNAME `www` → `tamukita.io` (Proxied), dan CNAME `staging` → Tunnel `tamukita-staging` (Proxied). Dokploy environment `production` memiliki Compose service `tamukita` dari `main`, tetapi panel menampilkan “No containers found”; belum ada origin aplikasi production untuk domain apex.
- Environment service aplikasi sudah memiliki `NEXT_PUBLIC_APP_URL=https://staging.tamukita.io`, `POSTGRES_PASSWORD`, dan `AUTH_SECRET` khusus staging. Nilai rahasia hanya tersimpan pada service Dokploy; jangan menyalin atau membagikannya.
- Deployment manual terbaru dari branch `main` memakai commit `7b7ad15` dan berstatus `Done` di Dokploy. Health check publik setelah deploy (`https://staging.tamukita.io/api/health`) menjawab `{"status":"ok","dependencies":{"database":"ok","redis":"ok","worker":"ok"}}`; halaman utama menjawab HTTP 200. PostgreSQL dan Redis sehat, migrasi keluar dengan kode 0, worker berjalan dan mencatat `[background-worker] ready`, serta web berstatus `healthy`. Docker Compose menetapkan `HOSTNAME: 0.0.0.0`, sehingga probe healthcheck ke `127.0.0.1` bekerja. File `src/lib/email-transport.ts` sudah disertakan pada worker image.
- Layanan Compose mengekspos web secara internal pada port `3000`. PostgreSQL dan Redis tidak memublikasikan port ke host.

Rate limit memakai alamat dari elemen terakhir `X-Forwarded-For`; Cloudflare menyetel header ini ke `CF-Connecting-IP` saat tidak ada proxy sebelumnya, dan menambahkan alamat proxy terakhir bila ada proxy berantai. Aplikasi mengabaikan `X-Real-IP` dan mengembalikan `unknown` jika nilai terakhir bukan alamat IP yang valid. Pertahankan DNS Cloudflare sebagai **Proxied** untuk domain staging; jika menambah proxy lain, verifikasi bahwa ia menambahkan hop terpercaya sebelum mengubah pemrosesan alamat. [Dokumentasi header Cloudflare](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

Health check yang lulus belum berarti QA blueprint selesai. Sebelum menjalankan transaksi atau load test, pastikan database, penyimpanan, dan semua kredensial staging terpisah dari production serta fixture uji tersedia.

## Persiapan staging

1. Connector khusus `tamukita-staging` berjalan dari image `cloudflare/cloudflared:2026.10.1` pada network `dokploy-network`; `TUNNEL_TOKEN` tersimpan hanya di environment rahasia layanan Dokploy. Jangan commit token ke repository atau memasukkannya ke environment tingkat project. Lihat [panduan Tunnel resmi Dokploy](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels) dan [rilis resmi cloudflared](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.1).
2. Rute `staging.tamukita.io` pada Tunnel baru mengarah langsung ke container web staging pada `dokploy-network`; CNAME proxied mengarah ke Tunnel baru dan pemeriksaan HTTPS lulus. Route lama pada `tigakaki1` sudah dihapus. Jalur langsung ini dipakai karena nama `dokploy-traefik` tidak bisa di-resolve di host.
3. Environment aplikasi sudah menyimpan `NEXT_PUBLIC_APP_URL`, `POSTGRES_PASSWORD`, dan `AUTH_SECRET` khusus staging pada service Compose Dokploy. Jangan menyalin atau membagikan nilai rahasia.
4. Siapkan nilai khusus staging di **service environment Dokploy** untuk alur yang hendak diuji. Jangan menaruh nilai ini di repo, project environment bersama, atau chat:
   - Xendit Test Mode: `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, `XENDIT_REFUND_WEBHOOK_TOKEN`.
   - Email uji: `RESEND_API_KEY`, `EMAIL_FROM` dengan sender yang sudah diverifikasi.
   - R2 non-production: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PRIVATE_BUCKET_NAME`, `R2_PUBLIC_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`.
5. Siapkan konfigurasi backup/restore host pada `/etc/tamukita/backup.env` dari `scripts/backup.env.example`: `BACKUP_COMPOSE_PROJECT_NAME`, `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY`, `BACKUP_BUCKET`, dan `BACKUP_AGE_RECIPIENT`. Simpan private age identity di luar repository dan image deployment; restore memakai `BACKUP_AGE_IDENTITY_FILE`.
6. Isi GitHub repository/environment variables untuk workflow kualitas:
   - `STAGING_BASE_URL=https://staging.tamukita.io`
   - `STAGING_INVITATION_PATH` — path slug undangan QA staging yang sudah dipublikasikan.
   - `PRODUCTION_HOSTNAMES` — opsional, hostname production tambahan dipisahkan koma untuk perlindungan target QA. Default `tamukita.io` dan `www.tamukita.io` selalu diblokir. `PRODUCTION_HEALTH_URL` hanya diperlukan untuk smoke check setelah health endpoint production benar-benar live.
7. Periksa nama Compose project, volume database, bucket, akun Xendit, sender email, domain, dan URL agar staging tidak tersambung ke data production. Siapkan undangan QA dengan foto dan konten representatif sebelum uji LCP.
8. Tinjau pemisahan runtime staging dari production dan pastikan semua provider mengarah ke data non-production.
9. Stack terakhir dideploy manual dari `main` pada commit `7b7ad15`. Dockerfile worker menyertakan `src/lib/email-transport.ts`, service web memakai `HOSTNAME: 0.0.0.0`, semua container health check lulus, dan halaman serta endpoint publik `/api/health` mengembalikan 200.
10. Jalankan pengukuran LCP atau load hanya setelah staging terisolasi, fixture siap, dan operator mengonfirmasi kesiapan hingga 1.000 virtual user. Workflow `staging-quality` menguji LCP p75, lalu load API health dan undangan publik masing-masing sampai 1.000 VU.

Deployment Compose staging sehat. Origin Cloudflare Tunnel diarahkan langsung ke container web pada `dokploy-network` karena `dokploy-traefik` tidak tersedia di host. Halaman utama dan `/api/health` lulus pemeriksaan publik.

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

- Tunnel `tamukita-staging` sehat dengan satu replica; token tersimpan sebagai secret layanan Dokploy. DNS `staging.tamukita.io` menunjuk ke Tunnel baru; route lama pada `tigakaki1` sudah dihapus. Tunnel mengarah langsung ke container web staging dan pemeriksaan halaman serta `/api/health` publik lulus.
- Domain apex `tamukita.io` masih menampilkan halaman parked Hostinger. HTTPS production dan URL health aplikasi production belum tersedia; HTTP 200 pada halaman parkir tidak memenuhi gate production.
- Service aplikasi staging sehat: worker, PostgreSQL, Redis, migrasi, dan health check web lulus. Jalankan QA blueprint pada staging setelah fixture undangan uji dan kredensial non-production siap.
- Path undangan publik QA dan variabel GitHub `STAGING_INVITATION_PATH` masih belum diberikan. GET ke slug CI `/e2e-supported-publication` pada staging menjawab 404, sehingga seed E2E lokal tidak tersedia sebagai fixture publik di VPS. Konfirmasi operator bahwa target staging terisolasi dan siap menerima hingga 1.000 virtual user juga masih diperlukan sebelum workflow load dijalankan.
- Isolasi staging dari production belum dibuktikan melalui deployment dan pemeriksaan konfigurasi runtime.
- Uji Xendit Test Mode, R2 nyata, restore di VPS, LCP, load 1.000 VU, dan monitoring eksternal belum dijalankan.
- Keputusan operator untuk identitas/kontak, retensi data, refund, pelindungan anak, vendor/lokasi pemrosesan, serta tinjauan legal masih terbuka.
