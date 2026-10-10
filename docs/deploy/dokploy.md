# Deployment Dokploy

## Status saat ini — 11 Oktober 2026

- Project Dokploy: `tamukita`.
- Environment `production` memakai layanan Compose `tamukita`.
- Environment `staging` memakai layanan Compose `tamukita-staging`.
- Kedua layanan mengambil repository `kuloryan1/tamukita`, branch `main`, dan `./docker-compose.yml`.
- Auto-deploy mati pada layanan yang disiapkan. Setup ini belum menjalankan deployment, menambahkan domain, atau memasukkan kredensial aplikasi staging.
- Layanan Compose mengekspos web secara internal pada port `3000`. PostgreSQL dan Redis tidak memublikasikan port ke host.

Rate limit memakai alamat dari elemen terakhir `X-Forwarded-For`, yang ditambahkan Traefik dari alamat peer yang terhubung langsung. Aplikasi mengabaikan `X-Real-IP` dan mengembalikan `unknown` jika nilai terakhir bukan alamat IP yang valid. Pertahankan lalu lintas aplikasi melalui Traefik Dokploy dan jangan aktifkan `forwardedHeaders.notAppendXForwardedFor`; bila ada proxy lain di depan Traefik, konfigurasikan proxy itu sebagai sumber forwarded header tepercaya pada Traefik.

Pemisahan environment Dokploy belum berarti staging siap menerima trafik. Sebelum deploy, pastikan konfigurasi aplikasi, penyimpanan, database, dan kredensial staging terpisah dari production.

## Persiapan staging

1. Pasang domain HTTPS staging milik operator melalui tab **Domains** pada layanan `tamukita-staging`; arahkan ke service `web` pada port `3000`.
2. Simpan nilai environment di pengaturan layanan staging Dokploy. Jangan simpan secret di variabel tingkat project karena variabel project tersedia untuk semua layanan di project tersebut.
3. Isi variabel wajib dengan nilai khusus staging:
   - `NEXT_PUBLIC_APP_URL` — origin HTTPS staging.
   - `POSTGRES_PASSWORD` — password database staging yang acak dan tidak dipakai production.
   - `AUTH_SECRET` — secret autentikasi acak khusus staging.
4. Siapkan kredensial Xendit **Test Mode**, bucket R2 non-production, dan konfigurasi email uji bila alur tersebut akan diuji. Jangan memakai kredensial atau bucket production.
5. Periksa lagi nama Compose project, domain, URL publik, dan semua kredensial agar staging tidak tersambung ke data production.
6. Jalankan deploy secara manual. Setelah migrasi dan container sehat, periksa `https://<origin-staging>/api/health` dan selesaikan smoke test alur yang akan diuji.
7. Jalankan pengujian LCP atau load hanya setelah staging benar-benar terisolasi. Workflow `staging-quality` juga meminta origin HTTPS, path undangan uji yang sudah diterbitkan, serta konfirmasi operator bahwa target siap menerima hingga 1.000 virtual user.

Jangan menganggap pembuatan environment atau service sebagai deployment yang berhasil. Keduanya saat ini hanya konfigurasi sumber di Dokploy; tidak ada container staging yang dibuat atau dinyalakan.

## Persiapan production

1. Pasang domain HTTPS production dan arahkan ke service `web` pada port `3000`.
2. Buat nilai rahasia production tersendiri melalui secret store Dokploy. Jangan gunakan nilai staging atau contoh di `.env.example`.
3. Konfigurasikan kredensial production Xendit, R2, Resend, backup, dan webhook alert hanya setelah keputusan operasional/legal yang masih terbuka disetujui.
4. Jalankan deploy manual pertama, periksa migrasi dan `/api/health`, kemudian lakukan smoke test transaksi dan pemulihan yang disepakati.
5. Aktifkan smoke check eksternal dan alert setelah URL health serta endpoint webhook tersedia.
6. Nyalakan auto-deploy hanya setelah prosedur rilis dan rollback production ditetapkan.

Sesudah container production pertama berjalan, temukan nama Compose project yang dipakai Dokploy dengan `docker ps --filter 'label=com.docker.compose.service=postgres' --format '{{.Names}} {{.Label "com.docker.compose.project"}}'`. Isi nama itu ke `BACKUP_COMPOSE_PROJECT_NAME` pada `/etc/tamukita/backup.env`; helper backup/restore mencari satu container PostgreSQL berdasarkan label project tersebut dan service `postgres`, tanpa bergantung pada nama direktori Compose di host.

## Gate yang belum selesai

- Operator belum memberikan origin HTTPS staging maupun path undangan publik untuk QA.
- Isolasi staging dari production belum dibuktikan melalui deployment dan pemeriksaan konfigurasi runtime.
- Uji Xendit Test Mode, R2 nyata, restore di VPS, LCP, load 1.000 VU, dan monitoring eksternal belum dijalankan.
- Keputusan operator untuk identitas/kontak, retensi data, refund, pelindungan anak, vendor/lokasi pemrosesan, serta tinjauan legal masih terbuka.
