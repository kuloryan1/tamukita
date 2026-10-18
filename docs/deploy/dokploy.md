# Deployment Dokploy

## Status saat ini — 18 Oktober 2026

- Project Dokploy: `tamukita`.
- Environment `production` memakai layanan Compose `tamukita`.
- Environment `staging` memakai layanan Compose `tamukita-staging`.
- Kedua layanan mengambil repository `kuloryan1/tamukita`, branch `main`, dan `./docker-compose.yml`.
- Auto-deploy mati pada layanan staging. Tab Deployments Dokploy menunjukkan `No deployments found`.
- Domain Dokploy `staging.tamukita.io` sudah diarahkan ke service `web`, port `3000`, path `/`; panel menampilkan HTTP dan `Cert: none`. Perubahan domain perlu diterapkan melalui deploy Compose.
- Tab Environment menampilkan nilai tersamarkan. Keberadaan `NEXT_PUBLIC_APP_URL`, `POSTGRES_PASSWORD`, dan `AUTH_SECRET` belum dapat dikonfirmasi dari panel ini; periksa nama variabel dan kecocokan nilainya di Dokploy sebelum deploy tanpa menyalin atau membagikan nilai secret.
- Published application Cloudflare Tunnel `tigakaki1` sudah diarahkan ke `http://dokploy-traefik:80`. Cloudflare mengonfirmasi record DNS CNAME dibuat ke tunnel; query DNS lokal mengembalikan alamat edge Cloudflare. Connector `cloudflared` saat ini memakai network mode `host`, sehingga nama `dokploy-traefik` tidak dapat di-resolve dari connector. Request HTTPS ke hostname mengembalikan 502. Mencoba origin `127.0.0.1:80` juga ditolak karena Traefik tidak memiliki host port mapping; route sudah dikembalikan ke target internal `dokploy-traefik:80`.
- Layanan Compose mengekspos web secara internal pada port `3000`. PostgreSQL dan Redis tidak memublikasikan port ke host.

Rate limit memakai alamat dari elemen terakhir `X-Forwarded-For`, yang ditambahkan Traefik dari alamat peer yang terhubung langsung. Aplikasi mengabaikan `X-Real-IP` dan mengembalikan `unknown` jika nilai terakhir bukan alamat IP yang valid. Pertahankan lalu lintas aplikasi melalui Traefik Dokploy dan jangan aktifkan `forwardedHeaders.notAppendXForwardedFor`; bila ada proxy lain di depan Traefik, konfigurasikan proxy itu sebagai sumber forwarded header tepercaya pada Traefik.

Pemisahan environment Dokploy belum berarti staging siap menerima trafik. Sebelum deploy, pastikan konfigurasi aplikasi, penyimpanan, database, dan kredensial staging terpisah dari production.

## Persiapan staging

1. Domain `staging.tamukita.io` dan rute publik saat ini sudah disimpan pada Tunnel `tigakaki1`. Rute itu masih menghasilkan 502 karena konektornya memakai `network_mode: host` dan tidak dapat menemukan `dokploy-traefik`. Jangan menambahkan host port mapping pada Traefik.
2. Siapkan Tunnel khusus staging agar konektor yang sudah dipakai layanan lain tidak perlu diubah. Buat aplikasi Docker Provider baru di Dokploy dengan image `cloudflare/cloudflared`, argumen `tunnel` dan `run`, lalu simpan token tunnel staging sebagai environment rahasia `TUNNEL_TOKEN` pada layanan itu saja. Pastikan kontainernya berada di network Docker yang sama dengan `dokploy-traefik` (biasanya `dokploy-network`) dan log konektor menunjukkan koneksi sehat. Jangan commit token ke repository atau memasukkannya ke environment tingkat project. Lihat [panduan Tunnel resmi Dokploy](https://docs.dokploy.com/docs/core/guides/cloudflare-tunnels).
3. Pindahkan rute publik `staging.tamukita.io` ke Tunnel staging tersebut, tetap dengan origin `http://dokploy-traefik:80`. Ubah rute yang ada agar DNS hostname diarahkan ke tunnel staging; jangan membuat dua record DNS yang bersaing untuk hostname yang sama. Pastikan HTTPS di edge Cloudflare aktif. Sesudah itu, redeploy Compose staging untuk menerapkan domain ke Traefik.
4. Simpan nilai environment aplikasi di pengaturan layanan Compose staging Dokploy. Jangan simpan secret di variabel tingkat project karena variabel project tersedia untuk semua layanan di project tersebut.
5. Isi variabel wajib dengan nilai khusus staging:
   - `NEXT_PUBLIC_APP_URL` — origin HTTPS staging.
   - `POSTGRES_PASSWORD` — password database staging yang acak dan tidak dipakai production.
   - `AUTH_SECRET` — secret autentikasi acak khusus staging.
6. Siapkan kredensial Xendit **Test Mode**, bucket R2 non-production, dan konfigurasi email uji bila alur tersebut akan diuji. Jangan memakai kredensial atau bucket production.
7. Periksa lagi nama Compose project, domain, URL publik, dan semua kredensial agar staging tidak tersambung ke data production.
8. Jalankan deploy secara manual. Setelah migrasi dan container sehat, periksa `https://<origin-staging>/api/health` dan selesaikan smoke test alur yang akan diuji.
9. Jalankan pengujian LCP atau load hanya setelah staging benar-benar terisolasi. Workflow `staging-quality` juga meminta origin HTTPS, path undangan uji yang sudah diterbitkan, serta konfirmasi operator bahwa target siap menerima hingga 1.000 virtual user.

Jangan menganggap pembuatan environment atau service sebagai deployment yang berhasil. Keduanya saat ini hanya konfigurasi sumber di Dokploy; tidak ada container staging yang dibuat atau dinyalakan.

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

- Origin staging `https://staging.tamukita.io` sudah ditetapkan dan DNS mengarah ke Cloudflare, tetapi request sekarang mengembalikan 502. Connector `tigakaki1` berjalan dengan network mode `host`, sedangkan `dokploy-traefik` tidak memiliki host port mapping. Tunnel staging terpisah dan tokennya belum dibuat/disimpan di Dokploy; setelah disiapkan, verifikasi HTTPS dan `/api/health`.
- Operator belum memberikan path undangan publik QA atau konfirmasi tertulis bahwa target terisolasi siap menerima hingga 1.000 virtual user.
- Isolasi staging dari production belum dibuktikan melalui deployment dan pemeriksaan konfigurasi runtime.
- Uji Xendit Test Mode, R2 nyata, restore di VPS, LCP, load 1.000 VU, dan monitoring eksternal belum dijalankan.
- Keputusan operator untuk identitas/kontak, retensi data, refund, pelindungan anak, vendor/lokasi pemrosesan, serta tinjauan legal masih terbuka.
