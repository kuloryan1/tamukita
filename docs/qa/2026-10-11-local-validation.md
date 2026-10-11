# Validasi lokal TamuKita — 11 Oktober 2026

Catatan ini merekam hasil validasi lokal pada workspace. Hasil lokal bukan bukti kesiapan staging atau produksi.

## Pemeriksaan aplikasi

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | Lulus; Biome memeriksa 165 file. |
| `npm run typecheck` | Lulus. |
| `npm audit --json` | Lulus; npm melaporkan 0 kerentanan pada dependency yang terkunci saat pemeriksaan. CI kini mengulang audit dan gagal untuk severity moderate atau lebih tinggi. |
| `npm test` | Lulus; 6 file dan 18 tes. |
| `npm run build` | Lulus; Next.js membuat 37 halaman statis. |
| `npm run test:e2e` | Lulus; 37 tes lulus, 2 dilewati, 0 gagal dari 39 tes lintas desktop Chromium, mobile Chromium, dan WebKit. Durasi 9,4 menit. |
| Assertion menu Custom Domain | Lulus; 3 tes editor lulus di desktop Chromium, mobile Chromium, dan WebKit. Item menampilkan “Custom Domain — Coming Soon” tanpa tautan. |
| Production dan local Compose config | `docker compose --env-file .env.example config --quiet` dan Compose dengan `docker-compose.local.yml` lulus. Stack utama mencakup web, worker, migrasi, PostgreSQL, dan Redis; override lokal hanya menambahkan port loopback untuk PostgreSQL/Redis. Ini belum menjalankan atau memverifikasi deployment. |
| `bash -n scripts/backup-postgres.sh scripts/restore-postgres.sh` | Kedua skrip lolos pemeriksaan sintaks Bash di container Alpine sementara. Ini belum menjalankan transfer ke R2. |
| `npm ci --omit=dev --ignore-scripts --offline --dry-run` | Lulus; simulasi instalasi produksi tidak menghapus `tsx` dari pohon dependency. Mode `dry-run` tidak mengubah `node_modules`. |
| Build dan runtime Docker web/worker | Kedua target Docker berhasil dibangun. Worker berjalan dengan `tsx v4.23.15`; heartbeat Redis bernilai `1` dengan TTL 45 detik. Web `/api/health` mengembalikan database, Redis, dan worker `ok`. |

Worker menjalankan `tsx src/worker.ts`, jadi `tsx` dipindahkan ke `dependencies` agar tetap tersedia pada target Docker yang memasang dependency produksi saja. Lint, typecheck, unit test, dan production build lulus setelah perubahan. Percobaan build worker pertama menerima `ECONNRESET` dari npm registry; pengulangan build berhasil. Web dan worker kemudian dijalankan bersama pada network lokal dengan PostgreSQL yang sudah dimigrasi serta Redis sementara. Image, container, network, dan port uji dibersihkan setelah pemeriksaan.

Dua tes yang dilewati adalah skenario lifecycle pembayaran pada mobile Chromium dan WebKit. Tes itu dibatasi ke desktop Chromium karena fixture callback pembayaran hanya boleh berjalan sekali per database sementara (`e2e/payment-lifecycle.spec.ts`).

E2E memakai PostgreSQL dan Redis sementara, server aplikasi lokal, serta mock Xendit dan R2. Layanan sementara dihentikan setelah tes selesai.

## E2E terfokus Admin Managed — 11 Oktober 2026

Setelah menambahkan pemberitahuan draft admin untuk akun pelanggan yang sudah ada, pemeriksaan berikut lulus:

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus. |
| `npm run lint -- src/app/api/admin/invitations/route.ts src/components/admin-managed-invitation.tsx src/worker.ts e2e/admin-managed.spec.ts` | Lulus; empat file diperiksa. |
| `npm run build` | Lulus. |
| `npx playwright test e2e/admin-managed.spec.ts` | Lulus; 3 dari 3 profil browser, Chromium desktop, Chromium ponsel, dan WebKit profil iPhone. |

Skenario membuat akun baru dan draft untuk akun pelanggan lama. Untuk akun lama, draft dan pekerjaan email dibuat dalam transaksi yang sama; pemilik kemudian berhasil masuk dan melihat draft pada dashboard. Pengiriman ke penyedia email eksternal tidak dilakukan oleh tes lokal; pengiriman memerlukan `RESEND_API_KEY` dan `EMAIL_FROM` pada deployment.

Tes menggunakan PostgreSQL 17 dan Redis 7 sementara pada port lokal terpisah. Kedua container dihentikan dan dihapus setelah tes selesai; container Docker lain tetap berjalan.

## Drill dump dan restore PostgreSQL lokal

1. Membuat database PostgreSQL sementara dengan PostgreSQL 17 Alpine.
2. Menerapkan 11 migrasi dan mengisi fixture E2E.
3. Membuat dump custom-format dengan `pg_dump`.
4. Memulihkan dump ke database baru dengan `pg_restore --exit-on-error`.
5. Membandingkan jumlah record sumber dan hasil restore.

| Tabel / pemeriksaan | Sumber | Hasil restore |
| --- | ---: | ---: |
| `users` | 8 | 8 |
| `organizations` | 11 | 11 |
| `invitations` | 5 | 5 |
| `orders` | 8 | 8 |
| `template_licenses` | 1 | 1 |
| `reseller_profiles` | 3 | 3 |
| `rsvps` | 0 | 0 |
| `guestbook` | 0 | 0 |
| Slug fixture `e2e-public-invite` | 1 | 1 |

Dump dan restore lokal berhasil. Container sementara dihapus setelah pemeriksaan, dan port lokal yang dipakai sudah bebas.

## Follow-up QA — jenis acara dan keterangan keluarga — 11 Oktober 2026

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus. |
| Lint file yang berubah | Lulus; 13 file diperiksa. |
| Unit test renderer template dan validasi draft | Lulus; 2 file dan 7 tes. |
| `npm run build` | Lulus; Next.js membuat build production dan memproses 38 route. |
| `npm run test:e2e -- e2e/editor-experience.spec.ts` | Lulus; 6 tes di Chromium desktop, Chromium ponsel, dan WebKit profil iPhone. Memeriksa field yang berubah saat memilih Khitan, keterangan keluarga di pratinjau, autosave ke API, dan urutan penyimpanan saat PATCH bertumpuk. |
| `npm run test:e2e -- e2e/admin-managed.spec.ts` | Lulus; 3 tes di tiga profil browser. Admin membuat draft Khitan dan pernikahan, lalu pemilik membuka ulang draft pernikahan dan melihat keterangan keluarga yang tersimpan. |

E2E memakai PostgreSQL 17 dan Redis 7 sementara pada port lokal khusus, lalu menjalankan migrasi serta fixture. Container dan volume sementara dibersihkan setelah tes. Jalur keluarga/penyelenggara tetap kompatibel dengan draft lama karena data undangan disimpan sebagai JSON dan field baru memiliki nilai default kosong. Pemeriksaan ini lokal; tidak mencakup deployment atau layanan staging.

## E2E penuh — 11 Oktober 2026

`npm run test:e2e` menyelesaikan seluruh 45 skenario di Chromium desktop, Chromium mobile, dan WebKit profil iPhone: **43 lulus, 2 dilewati, 0 gagal**. Dua skenario yang dilewati adalah lifecycle pembayaran pada Chromium mobile dan WebKit; fixture callback pembayaran hanya boleh berjalan sekali per database sementara dan skenario tersebut sudah dijalankan pada Chromium desktop.

Suite menggunakan PostgreSQL 17 dan Redis 7 sementara, fixture lokal, serta mock untuk layanan pembayaran dan penyimpanan objek. E2E ini tidak mengakses staging atau layanan eksternal. Pengujian domain, pemulihan dari backup R2, pembayaran Xendit Test Mode, smoke test publik, dan load test tetap menunggu konfigurasi staging.

## Pencatatan tampilan publik setelah respons — 11 Oktober 2026

Halaman undangan kini menjadwalkan kenaikan agregat `invitation_views` setelah respons HTML selesai. Halaman tetap menampilkan undangan jika penulisan metrik gagal; kegagalan hanya mencatat pesan operasional tanpa data tamu. Query guestbook yang diperlukan untuk render tetap berjalan sebelum respons.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run build` | Lulus; Next.js menghasilkan build production dengan 38 route. |
| `npm run typecheck` | Lulus. |
| Lint halaman publik dan E2E publik | Lulus; dua file. |
| `npm test` | Lulus; 8 file dan 25 tes. |
| `npm run test:e2e -- e2e/public-guest.spec.ts` | Lulus; 3 profil browser. Tes memeriksa undangan merespons HTTP 200 dan metrik bertambah sesudah respons. |

Ini memastikan pembaruan metrik tidak lagi ditunggu oleh halaman, tetapi belum mengukur LCP. Pengukuran LCP tetap menunggu undangan staging di domain HTTPS.

## Drill backup PostgreSQL terenkripsi lokal — 11 Oktober 2026

Skrip backup/restore kini menerima `BACKUP_S3_ENDPOINT` untuk S3-compatible endpoint. HTTPS tetap wajib untuk target jarak jauh; HTTP dibatasi ke host lokal yang diizinkan dan memerlukan `BACKUP_S3_ALLOW_HTTP=true`. Jika endpoint override kosong, skrip tetap memakai endpoint Cloudflare R2 dari `R2_ACCOUNT_ID`.

Integration drill memakai PostgreSQL 17 dan MinIO sementara pada network Docker terisolasi. Tes membuat database fixture, menghasilkan kunci `age` sementara, menjalankan skrip backup, memastikan objek yang diunggah terenkripsi, lalu menguji checksum dan pemulihan ke database baru. Tes juga mengganti checksum sidecar dengan nilai salah dan memastikan restore berhenti sebelum membuat database.

| Pemeriksaan | Hasil |
| --- | --- |
| Kebijakan endpoint S3 | Lulus; endpoint R2 default, HTTPS override, HTTP MinIO lokal, dan penolakan HTTP remote/URL berbahaya diperiksa. |
| `bash -n` pada skrip backup, restore, endpoint, dan tes | Lulus. |
| Backup terenkripsi + unggah MinIO lokal | Lulus; objek `.dump.age` dan `.sha256` berhasil dibuat. |
| Restore dari objek MinIO ke database baru | Lulus; nilai fixture cocok dengan sumber. |
| Restore dengan checksum yang dirusak | Ditolak sebelum database restore dibuat. |
| Cleanup drill | Lulus; database, bucket, container, dan network sementara dihapus. |

Drill diulang setelah perubahan terbaru memakai PostgreSQL 17 dan image MinIO yang sudah tersedia secara lokal. Objek terenkripsi berhasil dipulihkan dan checksum yang dirusak tetap ditolak. PostgreSQL menyimpan data pada `tmpfs`; database dan bucket uji dibersihkan oleh skrip, lalu container serta network terisolasi dihapus setelah pemeriksaan. Tidak ada image baru yang diunduh.

Job `backup-restore` ditambahkan ke CI agar drill lokal ini berjalan pada push dan pull request. Ini belum membuktikan kredensial, endpoint, lifecycle, atau pemulihan dari bucket Cloudflare R2 yang dipakai deployment.

## Pembacaan undangan publik bersama metadata — 11 Oktober 2026

Lookup undangan terbit kini memakai `React.cache` per render request. `generateMetadata` dan halaman publik menggunakan hasil lookup yang sama, sehingga metadata tidak perlu mengulang query Prisma yang sama saat merender halaman. Ini mengikuti mekanisme memoization yang didokumentasikan Next.js untuk data yang dibaca oleh metadata dan halaman. Penggunaan cache ini hanya untuk satu render request; status publikasi dan masa hosting tetap diperiksa ulang pada request berikutnya.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus. |
| Lint route undangan publik | Lulus; 1 file. |
| `npm run build` | Lulus; 38 route. |
| `npm run test:e2e -- e2e/public-guest.spec.ts` | Lulus; 3 dari 3 profil browser: Chromium desktop, Chromium mobile, dan WebKit iPhone. Mencakup HTTP 200 halaman publik, metrik kunjungan setelah respons, RSVP, dan moderasi ucapan. |

Pengujian berjalan lokal dengan PostgreSQL 17 dan Redis 7 sementara; kedua container dibersihkan setelahnya. E2E ini memeriksa perilaku, bukan jumlah query atau LCP. Pengukuran performa dan beban staging tetap menunggu origin staging serta undangan publik yang disiapkan operator.

## Batas workspace untuk draft self-service — 11 Oktober 2026

Lookup workspace yang dipakai untuk membuat draft self-service kini hanya memilih membership aktif di organisasi bertipe `PERSONAL`. Akun yang hanya memiliki workspace reseller tidak dapat menaruh draft pelanggan di workspace tersebut; alur reseller tetap membuat draft di workspace pelanggan yang telah memberi akses.

| Pemeriksaan | Hasil |
| --- | --- |
| Unit test `src/lib/invitation-server.test.ts` | Lulus; 2 tes memastikan filter workspace pelanggan dan hasil kosong untuk akun reseller saja. |
| `npm test` | Lulus; 9 file dan 27 tes. |
| `npm run typecheck` | Lulus. |
| Lint file yang berubah | Lulus; 2 file. |
| `npm run build` | Lulus; 38 route. |
| `npm run test:e2e -- e2e/customer-journey.spec.ts` | Lulus; 3 dari 3 profil browser. Tes membuat membership reseller bertanggal lebih lama, memastikan draft baru tetap tersimpan pada organisasi `PERSONAL`, dan memeriksa isolasi baca/tulis dari akun lain. |

E2E berjalan dengan PostgreSQL 17 dan Redis 7 sementara. Fixture organisasi reseller tambahan dihapus setelah tes; kedua container sementara juga dibersihkan.

## Otorisasi sebelum sinkronisasi template — 11 Oktober 2026

PATCH editor kini memverifikasi sesi, kepemilikan undangan, dan membership workspace aktif sebelum memanggil sinkronisasi versi template. Permintaan tanpa sesi berhenti sebelum query database; sesi tanpa akses berhenti setelah lookup terikat kepemilikan dan sebelum sinkronisasi template.

| Pemeriksaan | Hasil |
| --- | --- |
| Unit test `src/app/api/invitations/[id]/route.test.ts` | Lulus; 2 tes memastikan permintaan tanpa sesi tidak membaca undangan, dan sesi tanpa kepemilikan tidak menyinkronkan template. |
| `npm test` | Lulus; 10 file dan 29 tes. |
| `npm run typecheck` | Lulus. |
| Lint route PATCH dan tesnya | Lulus; 2 file. |
| `npm run build` | Lulus; 38 route. |

## Analitik bisnis admin — 11 Oktober 2026

Halaman `/admin/analytics` menampilkan metrik agregat 30 hari: akun dan workspace baru, kohor draft-ke-publikasi, konversi order final, page view undangan, RSVP, laporan konten, pembayaran/refund, penjualan reseller yang mereka laporkan, dan template yang dipublikasikan. Super Admin dan Finance dapat membuka halaman ini; Finance tetap tidak mendapat akses ke konsol Super Admin. Nilai pembayaran Rp0 tidak dihitung sebagai checkout sukses. Kanal akuisisi belum dicatat dan penjualan reseller tetap ditandai sebagai laporan reseller, bukan penerimaan platform.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | Lulus; 175 file. |
| `npm run typecheck` | Lulus. |
| `npm test` | Lulus; 10 file dan 29 tes. |
| `npm run build` | Lulus; 39 route, termasuk `/admin/analytics`. |
| GitHub E2E smoke pada commit `c57cc82` | Lulus; mengunjungi halaman analitik sebagai Super Admin dan Finance, lalu memastikan Finance diarahkan keluar dari `/admin`. [Workflow](https://github.com/kuloryan1/tamukita/actions/runs/38091181120). |

## Audit log admin — 11 Oktober 2026

Halaman `/admin/audit` menyediakan pencarian audit dengan filter aktor, tipe target, workspace, dan rentang tanggal Jakarta. Hanya Super Admin yang dapat membuka halaman; Finance diarahkan keluar. Pagination memakai cursor stabil pada `createdAt` dan `id`, dan query hanya mengambil kolom yang ditampilkan sehingga metadata audit mentah tidak ikut dimuat.

| Pemeriksaan | Hasil |
| --- | --- |
| `npx prisma validate` | Lulus. |
| `npm run lint` | Lulus; 176 file. |
| `npm run typecheck` | Lulus. |
| `npm test` | Lulus; 10 file dan 29 tes. |
| `npm run build` | Lulus; 39 route, termasuk `/admin/audit`. |
| GitHub CI pada commit `27b28f5` | Lulus. [Workflow](https://github.com/kuloryan1/tamukita/actions/runs/38091872520). |
| GitHub E2E smoke pada commit `27b28f5` | Lulus; membuka Audit Log sebagai Super Admin dan memastikan Finance diarahkan keluar. [Workflow](https://github.com/kuloryan1/tamukita/actions/runs/38091872443). |

## Gate yang belum dibuktikan

- Backup terenkripsi, upload, dan restore dari Cloudflare R2 nyata; yang sudah diverifikasi hanya MinIO lokal.
- Pemulihan volume dan konfigurasi yang benar-benar dipakai pada host deployment, serta pengiriman alert backup.
- Xendit Test Mode pada staging dengan kredensial yang disimpan di secret store.
- Smoke test health dari luar host, notifikasi on-call, uji LCP pada undangan staging, dan load test staging hingga 1.000 virtual user.
- Review kesiapan produksi serta keputusan operator/legal. Kebijakan tersebut sengaja tetap terbuka sesuai arahan operator.

Untuk menjalankan gate staging, workflow memerlukan HTTPS origin staging, path undangan publik yang sudah terbit, URL health produksi, dan konfirmasi bahwa target terisolasi serta siap menerima beban uji.

## Profil pengukuran LCP ponsel — 11 Oktober 2026

Pengujian undangan publik sekarang memakai 20 pemuatan dingin pada viewport Chromium 390×844 @2x dengan profil lab tetap: RTT 150 ms, unduh 1,6 Mbps, unggah 750 Kbps, dan perlambatan CPU 4×. P75 tetap harus ≤2.500 ms. Nilai ini adalah pengukuran sintetis, bukan data lapangan dari ponsel pengguna.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | Lulus; cakupan Biome diperluas ke 179 file termasuk tes performa. |
| `npm run typecheck` | Lulus. |
| `npm test` | Lulus; 10 file dan 29 tes. |
| Chromium CDP throttling probe | Lulus; network condition, status navigator, dan CPU slowdown diterapkan pada Chromium lokal 156.0.8078.4. |
| Sampel LCP staging | Belum dijalankan; origin HTTPS dan path undangan staging belum dikonfigurasi. |

## Pemakaian template per kategori di analitik — 11 Oktober 2026

Halaman `/admin/analytics` kini merangkum publikasi undangan per kategori template selama 30 hari. Kategori diambil dari template yang ditautkan ke versi undangan terbit; agregat tidak memuat identitas pelanggan atau slug undangan.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | Lulus; 179 file. |
| `npm run typecheck` | Lulus. |
| `npm test` | Lulus; 10 file dan 29 tes. |
| `npm run build` | Lulus; 39 route, termasuk `/admin/analytics`. |
| `npm run test:e2e -- e2e/admin-managed.spec.ts` | Lulus; 3 dari 3 profil browser. Super Admin dan Finance melihat bagian kategori template. |

## Pengunjung dan page view marketplace — 11 Oktober 2026

Halaman katalog template dan detail template mencatat page view harian pada tabel agregat platform. Kunjungan katalog juga dihitung satu kali per browser per hari UTC saat JavaScript aktif dan cookie tersedia. Cookie first-party berisi tanggal dan kedaluwarsa pada tengah malam UTC; cookie dikirim hanya ke endpoint metrik. Tabel metrik hanya menyimpan tanggal, nama metrik, dan jumlah; pencatatan tidak menyimpan ID browser, akun, alamat IP, referrer, token undangan, atau data pengunjung. Ringkasan 30 hari menjumlahkan pengunjung harian, sehingga browser yang sama dapat muncul lagi pada hari berikutnya.

| Pemeriksaan | Hasil |
| --- | --- |
| `npx prisma validate` | Lulus. |
| Migrasi database E2E | Lulus; seluruh 14 migrasi, termasuk `platform_analytics_daily`, diterapkan pada PostgreSQL 17 sementara. |
| `npm run lint` | Lulus; 182 file diperiksa tanpa peringatan. |
| `npm run typecheck` | Lulus. |
| `npm test` | Lulus; 10 file dan 29 tes. |
| `npm run build` | Lulus; build production memproses 40 route. |
| E2E `public-guest.spec.ts` dan `admin-managed.spec.ts` | Lulus; 6 tes pada Chromium desktop, Chromium mobile, dan WebKit iPhone. Tes memeriksa kenaikan pengunjung marketplace satu kali, penolakan origin luar, tidak menghitung ulang saat browser yang sama memuat ulang katalog, kenaikan page view undangan/katalog/detail setelah respons, atribut cookie harian, dan tampilan metrik untuk Super Admin serta Finance. |

E2E memakai PostgreSQL 17 dan Redis 7 sementara pada port terpisah; container dihentikan dan dihapus setelah tes. Hitungan unik berlaku per browser per hari; belum ada deduplikasi identitas lintas perangkat atau hari. Ini validasi lokal dan belum mengukur LCP staging atau beban produksi.

## E2E lengkap setelah KPI form, antrean bantuan, dan direktori akun — 11 Oktober 2026

Suite Playwright lengkap mencakup alur customer, editor, pemrosesan foto, checkout dan webhook, guest, reseller/admin, review template, keamanan webhook, health worker, KPI penyelesaian form, antrean masukan Support, dan pengelolaan peran platform dari direktori akun Super Admin. E2E admin memverifikasi pembatasan Finance, larangan mengubah peran akun sendiri, dan dua perubahan peran yang tercatat di audit.

| Pemeriksaan | Hasil |
| --- | --- |
| Migrasi dan seed E2E | Lulus; seluruh 15 migrasi dan fixture customer, Finance, Support, reseller, serta template diterapkan pada PostgreSQL 17 sementara. |
| `npm run typecheck` | Lulus. |
| `npm run lint` | Lulus; 197 file. |
| `npm test` | Lulus; 10 file dan 29 tes. |
| `npm run build` | Lulus setelah direktori akun dan pengelolaan peran ditambahkan; perubahan setelah build hanya penyesuaian assertions E2E dan catatan QA. |
| `npm run test:e2e` | Lulus pada mode retry CI; 49 tes lulus dan 2 dilewati dari 51 kasus lintas desktop Chromium, mobile Chromium, dan WebKit iPhone. Dua tes lifecycle pembayaran mobile memang dibatasi ke desktop karena fixture callback hanya boleh dipakai sekali. |

Suite memakai mock Xendit, R2, dan email dengan PostgreSQL 17 dan Redis 7 sementara. Container uji dibersihkan sesudahnya. Tes foto WebKit menunggu sampai URL hasil proses benar-benar tersimpan melalui API sebelum melanjutkan. Hasil ini membuktikan perilaku lokal; bukan deployment Dokploy, uji Xendit/R2 nyata, pemulihan backup pada VPS, smoke test eksternal, pengukuran LCP staging, atau kapasitas 1.000 virtual user. Gate tersebut masih menunggu konfigurasi dan konfirmasi operator.

## Admin paket dan entitlement — 11 Oktober 2026

Super Admin dapat membuat paket nonaktif, mengubah nama/deskripsi/harga/masa berlaku, mengatur entitlement JSON, lalu mengaktifkan atau mengarsipkan paket di `/admin/plans`. Kode paket tidak berubah setelah dibuat; entitlement harus unik dan dibatasi ukurannya; edit memakai timestamp untuk menolak perubahan yang kedaluwarsa. Perubahan dicatat di audit log dan halaman dibatasi untuk Super Admin. Paket aktif kini ditawarkan sebagai pilihan sekali bayar pada langkah review editor. Server memeriksa ulang versi harga, mengunci konfigurasi paket saat membuat order, dan menyimpan harga, masa berlaku, serta entitlement sebagai snapshot order. Callback Xendit yang terverifikasi membuat lisensi serta grant hosting/fitur; callback duplikat tidak membuat grant kedua. Paket gratis bersama template gratis dapat langsung menerbitkan undangan. Jika tidak ada paket aktif, pengaturan aktivasi dan hosting lama menjadi fallback. Paket ini bukan langganan otomatis. Gate runtime untuk galeri, musik, RSVP, dan pengelolaan tamu kini membaca grant paket aktif; undangan lama tanpa grant paket tetap memakai akses sebelumnya.

| Pemeriksaan | Hasil |
| --- | --- |
| `npx prisma validate` | Lulus; model `Plan` dan `PlanEntitlement` yang sudah ada dipakai tanpa migrasi baru. |
| `npm run typecheck` | Lulus. |
| `npm run lint` | Lulus; 206 file. |
| `npm test` | Lulus; 12 file dan 40 tes. |
| `npm run build` | Lulus; production build mencakup `/api/customer/plans` bersama halaman dan API paket admin. |
| E2E paket pelanggan dan pembayaran | Lulus pada Chromium desktop. Katalog pelanggan menampilkan paket aktif; publish membuat checkout dengan harga aktivasi paket, snapshot paket tersimpan pada order, callback Xendit membuat grant sesuai snapshot, dan callback duplikat tidak menggandakan grant. E2E juga memeriksa validasi manifest dan hitungan penyelesaian form. |

E2E memakai PostgreSQL 17 dan Redis 7 sementara dengan mock layanan; container uji dihentikan setelah tes. Pengujian lokal ini belum menguji penerapan grant fitur di seluruh UI/API, Xendit nyata, atau perilaku pada VPS staging.

## Pembayaran saat draft perlu dilengkapi — 11 Oktober 2026

Callback pembayaran tidak menerbitkan undangan jika data wajib atau field template berubah menjadi tidak valid setelah checkout dimulai. Transaksi tetap dianggap dibayar; lisensi template dan grant hosting/paket dicatat, status undangan tetap `DRAFT`, dan email pembayaran menautkan pelanggan langsung ke editor. Setelah pelanggan melengkapi draft, endpoint publish memakai lisensi yang sudah dibeli sehingga checkout tidak diminta ulang.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus. |
| `npm run lint` | Lulus; 206 file. |
| `npm test` | Lulus; 12 file dan 40 tes. |
| `npm run build` | Lulus; production build mencakup worker dan handler webhook yang diperbarui. |
| `e2e/payment-webhooks.spec.ts` | Lulus pada Chromium desktop dengan mock Xendit, email, PostgreSQL 17, dan Redis 7. Assertion mencakup status tetap draft saat host wajib kosong, grant hosting tetap aktif, undangan publik belum tersedia, email mengarah ke editor, lalu pelanggan bisa menerbitkan tanpa checkout kedua. |

Uji ini membuktikan alur lokal dengan callback tiruan. Pengujian Xendit Test Mode dan deployment VPS masih menunggu akses staging, origin HTTPS, serta konfigurasi kredensial operator.

## Field tambahan Template SDK — 11 Oktober 2026

Schema template kini dapat menambahkan section dan field teks, paragraf, tanggal, waktu, serta URL HTTPS. Smart Editor membangun input dari manifest, menyimpan nilai tambahan pada `customFields`, menerapkan `defaultValue` untuk field baru, dan menampilkan section tambahan pada langkah detail. Template manifest terkurasi menampilkan field tambahan yang terisi; renderer React menerima nilai tersebut melalui prop draft. Validasi server mengulang batas nilai, field wajib, format tanggal/waktu, dan HTTPS saat publikasi maupun aktivasi reseller. Slot foto tambahan tetap ditolak; foto memakai pipeline `coverPhoto` yang sudah memeriksa kepemilikan dan memproses crop.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus setelah perubahan schema, draft, editor, dan kedua jalur aktivasi. |
| `npm run lint` | Lulus; 204 file diperiksa tanpa peringatan. |
| `npm run build` | Lulus; production build menghasilkan 45 halaman statis/dinamis. |
| `git diff --check` | Lulus. |
| `npm test` | Lulus; 36 tes dalam 12 file. Mencakup kompatibilitas schema ekstensi, default, kunci aman, validasi wajib/panjang/format, dan render field manifest. |
| E2E field manifest tambahan | Lulus; 3 dari 3 browser project (Chromium desktop, Chromium mobile, WebKit mobile). Memeriksa default, penyimpanan dan preview, validasi field wajib, serta penolakan publikasi saat data tersimpan diubah secara tidak valid. |
| Suite E2E penuh | 52 lulus, 2 skip, 0 gagal/flaky (54 total). Dua skip memang membatasi lifecycle pembayaran ke desktop; tes lainnya lulus pada Chromium desktop, Chromium mobile, dan WebKit mobile. Run memakai fixture Support dan token webhook lokal. |
| GitHub Actions untuk commit `1faf9d4` | CI `validate` dan `backup-restore` sukses ([run CI](https://github.com/kuloryan1/tamukita/actions/runs/38105083978)); E2E smoke sukses di Linux, termasuk build dan suite Playwright ([run E2E](https://github.com/kuloryan1/tamukita/actions/runs/38105084015)). |

Run penuh juga memverifikasi pengelolaan peran admin setelah filter UI disamakan dengan pencarian fixture, serta alur reseller dengan akun reseller alternatif terpisah. Race antara autosave sukses dan pesan validasi editor diperbaiki: autosave hanya menghapus pesan gagal-simpan yang dibuatnya sendiri. CI menjalankan restore drill terisolasi dengan MinIO; ini belum membuktikan R2 atau VPS production. Kontrak field dan batas SDK tetap didokumentasikan di [`docs/template-sdk.md`](../template-sdk.md). Deployment Dokploy, staging HTTPS, beban 1.000 virtual user, restore di VPS, LCP, dan monitoring eksternal masih belum diuji.

## Penegakan entitlement paket saat runtime — 11 Oktober 2026

Draft dicocokkan dengan paket sebelum pembayaran. Sesudah pembayaran, grant aktif mengatur batas galeri dan akses musik di editor/API, serta tombol dan pengiriman RSVP maupun pengelolaan tamu. Paket dapat menonaktifkan fitur dengan menghilangkan key atau memberi nilai `false`; batas galeri valid dari 0 sampai 6. Renewal hosting memperpanjang masa grant paket yang masih aktif. Undangan lama tanpa grant paket mempertahankan perilaku sebelumnya.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus. |
| `npm run lint` | Lulus; 209 file. |
| `npm test` | Lulus; 13 file dan 45 tes. |
| `npm run build` | Lulus; production build menghasilkan 46 halaman statis/dinamis. |
| `git diff --check` | Lulus. |
| E2E pembayaran | Assertion ditambahkan untuk paket tanpa RSVP; hasil CI menunggu push commit ini. |

Uji lokal belum memverifikasi pengaturan environment di Dokploy atau deployment VPS. Akses panel belum tersedia dan domain staging masih akan disiapkan operator.

## Ekspor rekonsiliasi pembayaran Xendit — 11 Oktober 2026

Finance dan Super Admin dapat mengunduh CSV dari halaman Order & Refund. Setiap baris membedakan order tanpa sesi, sesi pembayaran, event webhook, dan refund, sehingga ID lokal dan referensi Xendit dapat dicocokkan tanpa membuka payload webhook. Ekspor memakai rentang UTC maksimal 31 hari, menolak hasil di atas 10.000 baris, melindungi nilai teks dari formula spreadsheet, dan mencatat aktor, rentang, serta jumlah baris pada Audit Log. Role selain Finance dan Super Admin menerima `403`.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus. |
| `npm run lint` | Lulus; 210 file. |
| `npm test` | Lulus; 13 file dan 45 tes. |
| `npm run build` | Lulus; route `/api/admin/orders/reconciliation` terdaftar pada build production. |
| E2E rekonsiliasi | Lulus di GitHub Actions run 52: ekspor memuat order/event refund dan reseller menerima `403`. Run pertama menangkap benturan label aksesibilitas dengan field tanggal acara pada alur admin-managed; label ekspor diperjelas sebelum run ulang. Suite penuh: 52 lulus, 2 skip yang memang dibatasi ke Chromium desktop, 0 gagal. ([E2E smoke](https://github.com/kuloryan1/tamukita/actions/runs/38109370049)) |

Fitur ini menyediakan berkas pencocokan finansial. Pembaruan status provider tetap berasal dari webhook. Pengaturan environment Dokploy, Xendit Test Mode, dan pencocokan transaksi nyata belum diuji karena staging HTTPS belum disiapkan.

## KPI analytics blueprint — 11 Oktober 2026

Halaman Analitik platform kini menampilkan pelanggan unik yang mulai draft dan menyelesaikan form, rasio penyelesaian per pelanggan unik, undangan aktif, reseller yang melakukan transaksi kredit atau mencatat penjualan dalam 30 hari, serta jumlah pelanggan yang tercatat menerbitkan sendiri. Metrik self-publish mengikuti identitas aktor yang tersimpan pada versi publikasi dan tidak menyimpulkan ada atau tidaknya bantuan informal.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus. |
| `npm run lint` | Lulus; 210 file. |
| `npm test` | Lulus; 13 file dan 45 tes. |
| `npm run build` | Lulus; production build mencakup halaman Analitik dengan 47 halaman statis/dinamis. |
| Suite Playwright penuh | Lulus lokal lintas Chromium desktop, Chromium mobile, dan WebKit mobile: 52 lulus, 2 skip, 0 gagal dari 54. Dua skip membatasi callback lifecycle pembayaran satu kali ke Chromium desktop; alur pembayaran itu lulus di desktop. |
| `git diff --check` | Lulus. |

E2E lokal memakai 15 migrasi pada PostgreSQL 17 dan Redis 7 sementara, token webhook lokal, serta mock Xendit, R2, dan email. Container sementara dihentikan setelah tes. Tes admin menunggu respons pencarian direktori sebelum mengubah role agar hasil pencarian yang masih dimuat tidak menimpa pilihan. Deployment Dokploy, environment runtime, domain staging, serta QA beban eksternal tetap menunggu konfigurasi operator.
