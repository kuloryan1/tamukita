# TamuKita

Platform awal TamuKita untuk membuat dan membagikan undangan digital. Aplikasi memakai Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM, Auth.js, dan Xendit Payment Sessions.

Smart Editor menyesuaikan identitas utama untuk jenis acara yang dipilih dan menyediakan keterangan keluarga atau penyelenggara yang disimpan di draft serta ditampilkan oleh setiap renderer undangan.

## Menjalankan lokal

Gunakan Node.js 22.12 atau lebih baru.

Buat nilai rahasia lokal untuk `AUTH_SECRET`, lalu masukkan hasilnya ke `.env` sebelum menjalankan aplikasi:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres redis
npm install
npm run db:migrate
npm run dev
```

Buka `http://localhost:3000`. Jalankan `npm run worker` di terminal kedua untuk memproses email dan unggahan media melalui Redis. Worker media juga memerlukan konfigurasi R2 yang tercantum di bawah; email memerlukan `RESEND_API_KEY` dan `EMAIL_FROM`. Aplikasi menyimpan akun, workspace, draft, versi undangan, pesanan, lisensi template, pembayaran, RSVP, audit log, dan metrik kunjungan di PostgreSQL.

`docker-compose.local.yml` hanya memublikasikan PostgreSQL dan Redis ke loopback untuk server development lokal. Compose utama tetap menjadi stack deployment yang dipakai Dokploy.

## Deployment Docker

Dockerfile membangun Next.js standalone, proses worker, dan target migrasi. Untuk menjalankan seluruh stack Compose produksi, salin `.env.example` ke `.env`, ganti `POSTGRES_PASSWORD` dan `AUTH_SECRET`, isi `NEXT_PUBLIC_APP_URL` dengan origin HTTPS, lalu jalankan `docker compose up --build -d`. File `docker-compose.yml` menjalankan migrasi, web, worker, PostgreSQL, dan Redis tanpa memerlukan aktivasi profil tambahan; hanya port web 3000 yang diekspos ke jaringan Compose, sedangkan database dan Redis tetap internal. Untuk Dokploy, gunakan `./docker-compose.yml`, lalu atur domain melalui tab Domains dan arahkan ke service `web` pada port 3000. Masukkan kredensial produksi melalui pengaturan environment/secret Dokploy, bukan ke repository. Skrip backup dan restore PostgreSQL tersedia di `scripts/`, beserta unit systemd harian yang dapat dipasang pada host deployment.

Status project, environment staging, dan langkah konfigurasi Dokploy dicatat di [panduan Dokploy](docs/deploy/dokploy.md). Staging dan production disiapkan dari branch `main`; keduanya belum dijalankan atau diberi domain.

Pull request dan perubahan ke branch utama menjalankan GitHub Actions untuk validasi Prisma, lint Biome, typecheck, unit test Vitest, QA renderer template, production build, serta E2E Playwright dengan Chromium desktop, Chromium viewport ponsel, dan WebKit profil iPhone. E2E mencakup beranda, pendaftaran pelanggan, verifikasi email melalui mock loopback tanpa pengiriman eksternal, login sampai dashboard, draft pelanggan yang tersimpan dan pulih setelah reload, undo/redo serta personalisasi editor, autosave berurutan saat PATCH sebelumnya tertunda agar draft lama tidak menimpa perubahan terbaru, pemeriksaan isolasi draft antar akun, upload/crop foto, hasil WebP dari worker, pemulihan metadata crop setelah reload, edit ulang foto dari sumber privat tanpa upload ulang, RSVP publik, moderasi ucapan, callback pembayaran lisensi dan top-up reseller yang diulang untuk memeriksa idempotensi, status expired, retry sebelum sesi tersimpan, refund sukses/gagal beserta pemulihan kredit, request checkout melalui mock lokal, pembatalan order ketika provider menolak sesi, serta perilaku URL kembali checkout yang tidak menerbitkan undangan sebelum webhook tervalidasi. E2E juga memeriksa token webhook Xendit, pembuatan workspace dan draft admin, antrean pemberitahuan draft untuk akun pelanggan yang sudah ada serta akses draft oleh pemiliknya, permintaan akses reseller yang disetujui pelanggan sebelum aktivasi draft dengan kredit Premium, laporan reseller dan batas akses staf, serta pengajuan template developer yang direview dan diterbitkan admin. Versi aktif lama tetap dipakai sampai kandidat baru disetujui, dan reseller lain tidak dapat melihat atau mengaktifkan draft pelanggan tersebut. Workflow E2E menyiapkan PostgreSQL dan Redis sementara, mock lokal Xendit dan R2, serta worker media; workflow memasang Chromium dan WebKit di runner CI. Untuk E2E lokal, siapkan `DATABASE_URL`, `REDIS_URL`, dan seluruh kredensial fixture E2E yang diwajibkan skrip seed (contohnya ada pada `.github/workflows/e2e.yml`), jalankan migrasi dan `npm run db:seed:e2e`, lalu build sebelum menjalankan `npm run test:e2e`; Playwright otomatis menyalakan mock dan server. Port aplikasi lokal dapat diubah lewat `PLAYWRIGHT_TEST_PORT` jika port 3000 sedang dipakai. Browser tidak diperlukan untuk unit test. `.github/workflows/production-smoke.yml` memeriksa endpoint health tiap jam setelah repository variable `PRODUCTION_HEALTH_URL` diisi dengan URL HTTPS publik yang berakhiran `/api/health`; workflow juga dapat dijalankan manual. Jika repository secret `PRODUCTION_ALERT_WEBHOOK_URL` diisi dengan endpoint HTTPS yang menerima payload JSON `{"text": ...}`, workflow mengirim alert saat pemeriksaan gagal; tanpa secret itu kegagalan tetap tercatat di GitHub Actions.

`GET /api/health` memeriksa PostgreSQL, Redis, dan heartbeat worker BullMQ (TTL 45 detik) tanpa mengembalikan detail internal. Container web memakai endpoint tersebut sebagai Docker healthcheck, sehingga worker yang berhenti membuat stack berstatus tidak sehat. Pastikan service worker berjalan agar healthcheck lulus. Smoke check GitHub Actions memberi sinyal dari luar host aplikasi, tetapi notifikasi on-call tetap perlu disambungkan di pengaturan repository.

Respons aplikasi menonaktifkan header identifikasi Next.js dan mengirim perlindungan MIME sniffing, clickjacking, referrer, serta akses kamera/mikrofon/lokasi. HSTS dikirim pada build production dan hanya mengaktifkan host saat ini; terminasi TLS HTTPS tetap harus disediakan oleh reverse proxy/deployment.

Untuk mengukur kapasitas undangan publik dan API baca di staging, pasang `k6`, lalu isi target secara eksplisit. Contoh PowerShell: `$env:BASE_URL = "https://staging.example.com"`, `$env:LOAD_TEST_TARGET = "staging"`, `$env:PRODUCTION_HEALTH_URL = "https://tamukita.io/api/health"`, lalu untuk undangan publik set `$env:INVITATION_PATH = "/slug-undangan-uji"` dan jalankan `npm run test:load:public`; untuk API set `$env:API_PATH = "/api/health"` dan jalankan `npm run test:load:api`. Kedua skrip menaikkan beban sampai 1.000 virtual user, menahan beban, dan melaporkan durasi serta tingkat request gagal. Keduanya menolak URL non-localhost tanpa `LOAD_TEST_TARGET=staging`, memastikan host staging berbeda dari `PRODUCTION_HEALTH_URL`, dan tidak mengikuti pengalihan HTTP agar request tidak berpindah ke origin lain. Jalankan hanya dengan izin dan batas beban yang disepakati bersama pengelola staging; hasil pengukuran belum tersedia sampai skrip benar-benar dijalankan.

Target LCP ponsel diukur terpisah dari load test HTTP dengan 20 pemuatan undangan terbit pada viewport emulasi Chromium 390×844 @2x; p75 sampel harus ≤2.500 ms. Setiap sampel memakai konteks browser baru dan profil lab yang dapat diulang: latensi 150 ms, unduh 1,6 Mbps, unggah 750 Kbps, serta perlambatan CPU 4×. Versi browser, profil, dan seluruh hasil dicetak. Contoh PowerShell: `$env:PERF_BASE_URL = "https://staging.example.com"`, `$env:PERF_TEST_TARGET = "staging"`, `$env:PRODUCTION_HEALTH_URL = "https://tamukita.io/api/health"`, `$env:PERF_INVITATION_PATH = "/slug-undangan-uji"`, lalu jalankan `npm run test:performance:lcp`. Skrip hanya melakukan GET, memastikan host uji berbeda dari `PRODUCTION_HEALTH_URL`, menolak target yang mengalihkan request sebelum pengukuran, memblokir request ke host production yang dikenal, dan memastikan browser tetap di origin staging. Catat lokasi runner dan commit saat membandingkan hasil; emulasi perangkat adalah pengukuran lab, bukan pengukuran lapangan pada ponsel nyata. Hasil LCP staging belum tersedia sampai skrip dijalankan.

`.github/workflows/staging-quality.yml` menyediakan pengukuran manual melalui GitHub Actions environment `staging`. Isi environment variables `STAGING_BASE_URL` (origin HTTPS staging) dan `STAGING_INVITATION_PATH` (undangan uji yang sudah terbit), serta repository variable `PRODUCTION_HEALTH_URL` dengan endpoint HTTPS production `/api/health`. Jalankan workflow secara manual dan centang konfirmasi bahwa staging terisolasi serta siap menerima beban hingga 1.000 virtual user. Workflow memeriksa LCP terlebih dahulu, kemudian menguji API dan undangan publik secara berurutan agar load test tidak saling mengganggu. Workflow menolak domain production utama `tamukita.io` dan `www.tamukita.io` serta host pada `PRODUCTION_HEALTH_URL`; gunakan aturan persetujuan pada environment GitHub staging sebelum menjalankan beban tersebut. Workflow ini belum dijalankan karena URL staging belum dikonfigurasi.

## Backup dan restore database

Skrip memerlukan Bash, Docker CLI, AWS CLI, dan `age`. Buat bucket R2 khusus backup dan age key pair. Simpan recipient publik di `BACKUP_AGE_RECIPIENT`; simpan file private identity di luar repository dan image deployment, lalu atur `BACKUP_AGE_IDENTITY_FILE` hanya pada mesin pemulihan. Atur `BACKUP_COMPOSE_PROJECT_NAME` ke nama project Compose yang benar-benar dipakai Dokploy; project produksi dan staging memiliki nama berbeda. Untuk melihat label project container PostgreSQL, jalankan `docker ps --filter 'label=com.docker.compose.service=postgres' --format '{{.Names}} {{.Label "com.docker.compose.project"}}'`. Atur juga `R2_ACCOUNT_ID`, `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY`, `BACKUP_BUCKET`, dan opsional `BACKUP_PREFIX` di secret store. `BACKUP_POSTGRES_SERVICE` default ke `postgres`. `BACKUP_ALERT_WEBHOOK_URL` opsional mengirim pemberitahuan JSON bergaya Slack jika backup gagal; endpoint harus memakai HTTPS. Host backup memerlukan `curl` untuk mengirim alert.

Jalankan backup dari host yang dapat mengakses Docker socket. Helper mencari tepat satu container berjalan dengan label `com.docker.compose.project=$BACKUP_COMPOSE_PROJECT_NAME` dan service `postgres`, sehingga tidak bergantung pada nama direktori checkout atau file Compose lokal. Contoh berikut memuat nilai konfigurasi backup ke shell Bash:

```bash
set -a
. ./.env
set +a
bash scripts/backup-postgres.sh
```

Skrip membuat dump PostgreSQL, mengenkripsinya dengan `age`, menghitung checksum, lalu mengunggah file terenkripsi dan checksum ke R2. Catat object key yang dicetak pada akhir proses. Untuk restore, atur `BACKUP_OBJECT` ke key tersebut, `BACKUP_AGE_IDENTITY_FILE` ke lokasi private identity yang cocok, dan `RESTORE_DATABASE` ke nama database baru yang masih kosong:

```bash
BACKUP_OBJECT='tamukita/postgres/20261010T120000Z.dump.age' \
RESTORE_DATABASE='tamukita_restore' \
bash scripts/restore-postgres.sh
```

Restore memverifikasi checksum, mendekripsi backup, lalu membuat database baru tanpa menimpa database aktif. Tinjau hasil pemulihan sebelum mengalihkan trafik aplikasi. Untuk jadwal harian di host Linux, pasang unit systemd dan siapkan file env khusus backup:

```bash
sudo install -m 0644 scripts/tamukita-backup@.service /etc/systemd/system/
sudo install -m 0644 scripts/tamukita-backup@.timer /etc/systemd/system/
sudo install -d -m 0750 /etc/tamukita
sudo install -m 0600 scripts/backup.env.example /etc/tamukita/backup.env
sudoedit /etc/tamukita/backup.env
sudo systemctl daemon-reload
sudo systemctl enable --now tamukita-backup@deploy.timer
```

Akun `deploy` pada contoh tersebut perlu membaca checkout skrip di `/opt/tamukita.io` dan memiliki akses ke Docker socket; ganti `deploy` dengan nama akun yang dipakai host. Nilai `BACKUP_COMPOSE_PROJECT_NAME` pada `/etc/tamukita/backup.env` harus sama persis dengan label project container database production yang ditampilkan perintah di atas. Periksa jadwal dengan `systemctl list-timers` dan hasil backup dengan `journalctl -u tamukita-backup@deploy.service`. Gunakan [perintah retensi R2](#retensi-unggahan-sementara-di-r2) untuk objek sementara, atur `BACKUP_ALERT_WEBHOOK_URL` untuk kegagalan backup dan secret `PRODUCTION_ALERT_WEBHOOK_URL` untuk health check, lalu lakukan uji restore berkala.

## Retensi unggahan sementara di R2

Aturan lifecycle menghapus objek dan membatalkan multipart upload yang belum selesai pada prefix `private/pending/` setelah 24 jam. Penghapusan R2 berjalan asinkron; objek biasanya dihapus dalam 24 jam setelah waktu kedaluwarsanya. Perintah ini memakai Cloudflare API token dengan izin `Workers R2 Storage Write`, membaca konfigurasi bucket sebelum mengubahnya, dan mempertahankan aturan lifecycle lain.

Isi `R2_ACCOUNT_ID` dan `R2_PRIVATE_BUCKET_NAME` (atau `R2_BUCKET_NAME`) dari konfigurasi deployment, lalu sediakan `CLOUDFLARE_API_TOKEN` sementara dari secret store. Jalankan tanpa flag untuk melihat rencana:

```bash
npm run r2:lifecycle
```

Setelah meninjau bucket dan prefix yang tercetak, terapkan secara eksplisit:

```bash
npm run r2:lifecycle -- --apply
```

Simpan token Cloudflare terpisah dari environment runtime aplikasi. Lihat [dokumentasi lifecycle Cloudflare R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) untuk detail retensi dan keterlambatan penghapusan.

## Pembayaran Xendit

Isi `XENDIT_SECRET_KEY` dengan API key Xendit mode test untuk pengembangan. Daftarkan URL webhook `https://<domain>/api/webhooks/xendit` untuk event **Payment Session Completed** dan **Payment Session Expired**, lalu salin token callback ke `XENDIT_WEBHOOK_TOKEN`. Daftarkan juga event **Refund Succeeded** dan **Refund Failed** ke endpoint yang sama, dengan token callback di `XENDIT_REFUND_WEBHOOK_TOKEN`. Pembayaran hanya dianggap berhasil setelah webhook tervalidasi; URL kembali dari halaman checkout tidak menerbitkan undangan. Status order refund berubah setelah webhook akhir Xendit, bukan setelah form admin dikirim.

`NEXT_PUBLIC_APP_URL` harus menggunakan HTTPS agar URL kembali dikirim saat membuat Payment Session. Untuk localhost, Xendit tetap bisa mengirim webhook melalui tunnel HTTPS; tanpa HTTPS, pengguna tidak diarahkan kembali otomatis ke halaman hasil.

Verifikasi email dan pemulihan kata sandi mengirim tautan sekali pakai melalui Resend. Atur `RESEND_API_KEY` dan `EMAIL_FROM` pada secret store setelah alamat pengirim diverifikasi di Resend. Token disimpan sebagai hash, kedaluwarsa setelah 24 jam, dan reset kata sandi mencabut sesi lama. Migrasi akun menandai akun yang sudah ada sebagai terverifikasi; akun baru wajib menyelesaikan verifikasi sebelum login.

Biaya aktivasi undangan pelanggan, harga kredit top up reseller, harga renewal hosting, dan masa hosting publikasi baru dapat diatur melalui halaman Pengaturan admin dan disimpan ke tabel `platform_settings`. Biaya aktivasi pelanggan default ke Rp0 (`CUSTOMER_ACTIVATION_PRICE_IDR`); jika biayanya lebih dari Rp0, satu checkout mencatat baris `ACTIVATION` dan, untuk template berbayar, baris `TEMPLATE_LICENSE` secara terpisah. Template gratis hanya menagih baris aktivasi. Harga dan masa hosting disalin ke snapshot order agar perubahan pengaturan tidak mengubah transaksi yang sudah dibuat. `RESELLER_BASIC_ACTIVATION_PRICE_IDR`, `RESELLER_PREMIUM_ACTIVATION_PRICE_IDR`, `CUSTOMER_ACTIVATION_PRICE_IDR`, `INVITATION_HOSTING_RENEWAL_PRICE_IDR`, dan `INVITATION_HOSTING_TERM_DAYS` menjadi fallback konfigurasi deployment; masa hosting default 365 hari dan checkout renewal nonaktif jika harganya Rp0 atau belum diatur. Undangan dapat diperpanjang dalam 30 hari sebelum masa aktif berakhir melalui Payment Session Xendit. Webhook sukses memperpanjang masa dari tanggal kedaluwarsa terakhir, memperbarui entitlement, dan dicatat di audit; halaman publik, RSVP, dan buku tamu ditutup ketika hosting berakhir. Portal reseller ada di `/reseller`; persetujuan pengajuan dilakukan melalui `/admin` oleh akun dengan `platformRole=SUPER_ADMIN`. Tetapkan role tersebut secara manual untuk akun administrator pertama melalui akses database yang dikendalikan.

Reseller menautkan akun pelanggan memakai email. Pelanggan harus menyetujui permintaan akses di dashboard sebelum reseller dapat melihat draft. Setelah disetujui, reseller dapat menerbitkan draft dan menggunakan satu kredit aktivasi; Royal Gold memakai kredit Premium, sedangkan Elegant Cream dan Modern Sage memakai kredit Basic. Publikasi, lisensi, pencatatan kredit, dan audit disimpan dalam satu transaksi. Migrasi persetujuan pelanggan harus diterapkan sebelum memakai fitur ini pada deployment yang sudah berjalan.

## Penyimpanan foto di Cloudflare R2

Buat bucket terpisah untuk sumber privat dan hasil publik, lalu isi `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PRIVATE_BUCKET_NAME`, `R2_PUBLIC_BUCKET_NAME`, dan `R2_PUBLIC_BASE_URL` pada secret store. Hubungkan domain HTTPS ke bucket publik dan gunakan alamat domain itu sebagai `R2_PUBLIC_BASE_URL`. Bucket publik hanya menerima objek dari server; jangan aktifkan kredensial unggah publik.

Atur CORS bucket privat agar menerima `GET` dan `PUT` dari origin aplikasi (`NEXT_PUBLIC_APP_URL`), dengan header `Content-Type` dan `Content-Length`. Aplikasi memberi URL singkat bertanda tangan untuk unggah file asli dan hasil crop, serta untuk mengambil sumber privat saat pelanggan membuka kembali editor. Setelah unggah selesai, aplikasi menulis pekerjaan ke outbox PostgreSQL; worker BullMQ memvalidasi, menghapus orientasi EXIF dari hasil, lalu membuat WebP publik dan thumbnail. Editor memeriksa status hingga worker menyelesaikan pekerjaan. Pelanggan dapat mengubah crop foto yang sudah dipilih tanpa mengunggah ulang file asli; worker menyimpan setiap revisi baru dan memperbarui foto sampul draft. Posisi horizontal dan vertikal dapat diatur agar subjek tetap terlihat saat rasio tampilan undangan berbeda. File sumber tetap privat. Konfigurasikan penghapusan prefix `private/pending/` setelah satu hari menggunakan [perintah retensi R2](#retensi-unggahan-sementara-di-r2).

Foto versi WebP dapat diakses melalui URL publik setelah diproses agar pratinjau dapat memuatnya; URL itu baru dimasukkan ke undangan saat undangan diterbitkan. Musik latar menerima MP3 hingga 10 MB; sumber tetap privat dan salinan yang divalidasi disimpan di bucket publik agar pemutar pada halaman undangan dapat memutarnya. Pengunggah harus memiliki hak atau izin untuk memakai audio tersebut. Untuk pengembangan lokal, R2 tidak wajib untuk menjalankan halaman lain, tetapi unggah foto dan musik memerlukan konfigurasi bucket tersebut.

## Perintah database

Untuk menjalankan seed E2E, set environment akun pengujian yang diminta oleh `scripts/seed-e2e-admin.ts`, termasuk `E2E_CONTENT_REVIEWER_EMAIL` dan `E2E_CONTENT_REVIEWER_PASSWORD`.

```powershell
npm run db:generate  # buat ulang Prisma Client
npm run db:migrate   # migrasi pengembangan
npm run db:deploy    # terapkan migrasi pada deployment
npm run db:studio    # buka Prisma Studio
npm run typecheck    # pemeriksaan TypeScript
```

## Alur yang sudah diimplementasikan

- Pendaftaran email dan kata sandi, login Auth.js, hash scrypt, pembatasan percobaan login, dan proteksi halaman dashboard.
- Verifikasi email dan pemulihan kata sandi memakai token satu kali berumur 24 jam; perubahan kata sandi mencabut sesi sebelumnya.
- Email konfirmasi pembayaran dan RSVP baru masuk ke outbox PostgreSQL dalam transaksi, lalu dikirim worker BullMQ melalui Redis dengan percobaan ulang dan status gagal yang terlihat di admin.
- Worker email juga memberi tahu staf saat ditambahkan ke workspace reseller dan memberi tahu pemilik/staf reseller saat pelanggan menyetujui, menolak, atau mencabut akses.
- Workspace personal serta draft undangan yang tersimpan di PostgreSQL dan otomatis dimuat kembali.
- Smart Editor memakai wizard dengan autosave, undo/redo untuk perubahan draft yang didukung, pratinjau ponsel/desktop, serta pengaturan warna aksen, font, dan urutan cerita dibanding informasi acara.
- Riwayat versi draft dan publikasi, lisensi template berbayar, serta alur Xendit Payment Session.
- Webhook memeriksa token callback, jumlah, mata uang, referensi order, dan status sebelum memberi lisensi dan menerbitkan undangan.
- Checkout pelanggan menyimpan lisensi template berbayar dan biaya aktivasi sebagai item order terpisah, lalu membayar jumlah total dalam satu sesi Xendit. Template gratis hanya mencatat item aktivasi jika biayanya diaktifkan. Harga aktivasi dapat diatur di admin dan default Rp0.
- Halaman publik hanya membaca snapshot terbit. Judul, deskripsi, dan gambar Open Graph/Twitter dibuat dari konten publik undangan tanpa menyertakan nama penerima bertoken. RSVP disimpan di database dan dibatasi per alamat jaringan.
- Masa hosting terpisah dari lisensi template. Pengaturan admin menentukan durasi untuk publikasi baru dan tarif perpanjangan; webhook renewal yang tervalidasi menambah masa aktif, sementara halaman undangan, RSVP, dan buku tamu berhenti menerima akses setelah kedaluwarsa.
- Foto sampul dapat dicrop, diperbesar, diputar, dan digeser; pelanggan dapat membuka ulang editor tanpa mengunggah sumber lagi. Posisi dan revisi crop tersimpan, galeri menerima hingga enam foto, dan worker BullMQ menghasilkan WebP untuk undangan.
- Worker BullMQ memproses foto sampul, galeri, musik, dan revisi crop di luar request web dengan status unggahan yang dapat diperiksa editor.
- Musik latar menerima file MP3 hingga 10 MB, menyimpan sumber secara privat, dan menampilkan kontrol putar/jeda pada undangan publik.
- Informasi hadiah opsional memuat nama bank, pemilik, nomor rekening, pesan, serta tombol salin pada halaman publik. Editor memberi tahu bahwa detail rekening akan terlihat oleh siapa pun yang membuka tautan undangan.
- Buku tamu memakai moderasi: ucapan baru menunggu persetujuan, dan halaman publik hanya menampilkan ucapan yang disetujui.
- Tamu dapat melaporkan ucapan yang sudah tampil dengan alasan terstruktur. Admin Content Reviewer dan Super Admin memiliki antrean untuk mengabaikan laporan, menyembunyikan ucapan dari halaman publik, atau memulihkannya; setiap tindakan masuk audit. Sidik pelapor berupa HMAC untuk deduplikasi dan tidak menyimpan alamat IP.
- Modul media admin menampilkan perkiraan penggunaan storage dari ukuran original dan varian di PostgreSQL serta daftar unggahan yang menunggu, sedang diproses, atau gagal. Akses dibatasi ke Support dan Super Admin; perhitungan tidak mencakup objek R2 yatim yang tidak memiliki record.
- Daftar tamu mendukung impor CSV nama, tautan undangan dengan token acak yang disimpan sebagai hash, RSVP per tamu, penyalinan tautan manual, serta daftar 500 RSVP terbaru termasuk jawaban tanpa tautan pribadi.
- Pengajuan reseller dapat ditinjau Super Admin. Reseller yang disetujui dapat membeli kredit Basic/Premium melalui Xendit; saldo hanya bertambah dari webhook pembayaran yang tervalidasi.
- Pelanggan dapat menyetujui, menolak, atau mencabut akses reseller. Reseller hanya dapat melihat draft setelah persetujuan dan dapat menerbitkannya dengan kredit aktivasi sesuai tier template.
- Pemilik reseller dapat memberi atau mencabut akses staf dari akun TamuKita yang sudah terdaftar. Staf dapat mengelola pelanggan dan aktivasi, sementara pembelian kredit dibatasi ke pemilik dan admin reseller.
- Admin memiliki ringkasan akun baru 30 hari, tampilan undangan, undangan aktif, jumlah pembayaran sukses, penerimaan IDR setelah refund berhasil, workspace, order, reseller, template review, media gagal, email gagal, dan audit; admin dapat membuat draft untuk akun yang ada atau membuat akun pelanggan baru dengan tautan atur kata sandi, serta menangguhkan atau memulihkan undangan terbit.
- Halaman `/admin/analytics` merangkum jumlah draft, penyelesaian form sebelum checkout, publikasi, checkout final, keluhan editor, pengunjung browser marketplace per hari UTC, page view undangan/katalog/detail template, RSVP, laporan konten, pembayaran/refund, publikasi template per kategori, dan penjualan reseller 30 hari. Browser dapat dihitung kembali pada hari berbeda; sumber kanal akuisisi belum dikumpulkan, dan penjualan reseller dibedakan sebagai catatan mereka sendiri.
- Editor dan dashboard menyediakan formulir laporan kendala. Antrean `/admin/editor-feedback` hanya dapat dibaca Support dan Super Admin; perubahan status masuk audit, dan Finance hanya melihat jumlah agregat pada analitik.
- Halaman `/admin/audit` menyediakan riwayat audit terfilter dan berpaginasi untuk Super Admin; metadata log tidak ditampilkan di browser.
- Super Admin dapat mencari workspace menurut nama, slug, dan identitas pemilik; halaman detail menampilkan anggota, undangan, reseller, dan audit.
- Super Admin dapat mengaktifkan, menangguhkan, dan mengarsipkan workspace serta mengubah atau mencabut akses anggota; peran Owner dilindungi dan semua perubahan masuk audit. Workspace yang ditangguhkan tidak dapat mengedit undangan atau menampilkan halaman publik, RSVP, dan ucapan.
- Super Admin dapat mencari akun menurut nama atau email dan mengubah peran platform pelanggan/staf/developer melalui `/admin/users`. Perubahan masuk audit; akun sendiri dan Super Admin terakhir dilindungi. Peran reseller tetap diatur melalui keanggotaan workspace.
- Akses bantuan admin memerlukan alasan, hanya-baca untuk data undangan, kedaluwarsa setelah 15 menit, dapat dicabut, dan mencatat pemberian maupun setiap pembukaan ke audit. Alur ini tidak menyamar sebagai akun pelanggan.
- Antrean review template mendukung pengajuan manifest, permintaan perubahan, publikasi, arsip/pemulihan, pengaturan lisensi/harga oleh peran yang berwenang, dan pengajuan semver baru oleh developer. Versi kandidat ditinjau terpisah; katalog tetap memakai versi aktif sampai admin menerbitkan versi baru, dan undangan lama tetap tertaut ke versi yang disimpan. Harga katalog dan editor berasal dari database; template gratis dapat langsung diterbitkan tanpa checkout atau kredit reseller selama biaya aktivasi pelanggan Rp0; jika biaya aktivasi diatur, pelanggan membayar aktivasi terlebih dahulu.
- Admin dapat mencari semua order secara berpaginasi dan mengajukan refund penuh atau sebagian untuk lisensi template maupun top-up kredit reseller. Permintaan diserialisasi per order, dicatat di audit, dikirim ke metode pembayaran asal melalui Xendit, lalu direkonsiliasi lewat webhook. Refund lisensi hanya menonaktifkan undangan saat jumlah refund sukses mencapai nilai penuh order. Top-up hanya dapat direfund dalam jumlah kredit utuh yang belum dipakai; kredit dicadangkan saat permintaan dibuat dan dipulihkan bila Xendit menolak refund.
- Template awal, pratinjau, tautan publik, hitungan RSVP, dan analitik kunjungan.

## Bagian blueprint yang masih perlu dilanjutkan

Catatan QA lokal pada [11 Oktober 2026](docs/qa/2026-10-11-local-validation.md) memisahkan hasil berdasarkan commit dan cakupan: suite penuh Playwright mencatat 43 lulus, 2 dilewati, dan 0 gagal; E2E publik dan customer journey terbaru lulus pada Chromium desktop, Chromium mobile, dan WebKit iPhone; unit test terbaru mencakup 10 file dan 29 tes. Customer journey memastikan draft tetap berada pada workspace `PERSONAL` saat akun memiliki membership reseller yang lebih lama, dan tes API memastikan permintaan tanpa akses tidak menyinkronkan versi template. Catatan yang sama memuat assertion menu Custom Domain, drill backup/restore lokal, serta smoke test web/worker Docker. Hasil lokal tidak menggantikan gate R2 dan staging yang belum dijalankan.

Admin sudah memiliki direktori, perubahan status workspace, pengelolaan anggota, akses bantuan sementara yang diaudit, review template, pengaturan harga lisensi, aktivasi pelanggan, kredit, dan hosting, serta status konfigurasi integrasi. Admin dapat membuat draft untuk pelanggan terdaftar atau membuat akun baru dengan token satu kali untuk mengatur kata sandi; draft tetap disunting, dibayar, dan diterbitkan pelanggan dari dashboard. Untuk akun yang sudah ada, pembuatan draft memasukkan pemberitahuan email ke outbox BullMQ/PostgreSQL dengan tautan editor yang tetap dilindungi login; E2E memastikan pemilik dapat melihat draft tersebut. Pengiriman email eksternal tetap memerlukan Resend di deployment. Template berkode React berada di source repository; renderer dibangun secara statis ke aplikasi, versi kode dapat disimpan terpisah, dan versi baru masuk review admin sebelum diaktifkan. Pengajuan manifest in-app tetap memakai renderer deklaratif terkurasi. CI memeriksa validasi draft, kecocokan schema dengan Smart Editor, render React untuk setiap pasangan slug/versi, lint, typecheck, validasi Prisma, dan production build. Playwright menguji beranda, pembuatan draft yang URL-nya berubah ke ID agar dapat dipulihkan setelah reload, undo/redo dan personalisasi editor, upload/crop serta pemrosesan WebP oleh worker, pemulihan metadata crop dan edit ulang foto dari sumber privat tanpa upload ulang, isolasi draft antar akun, RSVP publik, moderasi ucapan, callback sukses, expired, retry, dan refund Xendit untuk lisensi serta kredit reseller, request checkout mock dan penanganan order yang dibatalkan, URL kembali checkout sebelum webhook, pembuatan workspace dan draft admin beserta pemberitahuan untuk pelanggan lama, review serta publikasi template, penahanan versi lama sampai kandidat baru disetujui, dan alur persetujuan akses reseller, isolasi antar-reseller, serta aktivasi draft dengan kredit pada Chromium desktop, Chromium mobile, dan WebKit profil ponsel. Checkout Xendit Hosted Checkout sudah diimplementasikan, tetapi belum dijalankan dengan kredensial Test Mode atau staging; uji keamanan/load yang dijalankan serta notifikasi on-call belum terverifikasi. Refund sebagian untuk lisensi dan refund top-up reseller tersedia dengan batas keamanan: jumlah top-up harus berupa kredit utuh, dan saldo yang dikembalikan harus berasal dari lot pembelian yang sama serta belum digunakan. Aktivasi kredit dan refund menyimpan referensi ke top-up asal; penggunaan dari lot lain tidak menghalangi refund saldo yang masih utuh. Aktivasi historis yang belum memiliki atribusi asal tetap ditolak sampai dapat direkonsiliasi. Worker BullMQ menangani email pembayaran, notifikasi RSVP baru kepada pemilik undangan, notifikasi draft admin, beberapa perubahan akses reseller, dan pengingat pemilik 24 jam sebelum setiap acara terbit. Pengingat hanya dijadwalkan jika acara masih akan berlangsung dan hosting undangan masih aktif; outbox persisten dan kunci unik menjaga agar satu waktu acara tidak dikirim dua kali oleh worker. Halaman daftar tamu menampilkan hingga 500 jawaban RSVP terbaru, termasuk RSVP tanpa tautan pribadi. Blueprint MVP tidak menetapkan paket berlangganan otomatis. Draf internal kebijakan privasi, syarat layanan, refund, lisensi template/media, dan checklist legal tersedia di [`docs/legal/`](docs/legal/README.md), tetapi belum siap dipublikasikan karena identitas operator, kontak, jadwal retensi, keputusan refund, inventaris vendor, penilaian cakupan pelindungan anak, dan tinjauan hukum masih diperlukan. Kewajiban terkait PP 17/2025 dan Permenkomdigi 9/2026 perlu dinilai segera sebelum peluncuran. Aplikasi belum menyediakan penghapusan akun mandiri atau purge lengkap seluruh data; perilaku hosting kedaluwarsa menutup akses publik tetapi tidak otomatis menghapus data lain. Skrip backup terenkripsi, restore ke database baru, timer backup harian, healthcheck PostgreSQL, Redis, dan worker BullMQ, dan smoke check eksternal sudah tersedia. Perintah `npm run r2:lifecycle` mengelola aturan retensi 24 jam di `private/pending/` dan memerlukan Cloudflare API token berizin `Workers R2 Storage Write` saat diterapkan. Alert kegagalan backup melalui `BACKUP_ALERT_WEBHOOK_URL` tersedia dan memerlukan endpoint HTTPS untuk diaktifkan. Uji restore berkala, konfigurasi deployment, dan kredensial produksi masih perlu diselesaikan di lingkungan deployment. Kunci Xendit, kredensial R2, Resend, dan `AUTH_SECRET` produksi harus berasal dari secret manager deployment.
