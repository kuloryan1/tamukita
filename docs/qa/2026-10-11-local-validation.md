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

## Gate yang belum dibuktikan

- Backup terenkripsi, upload, dan restore dari Cloudflare R2 nyata; yang sudah diverifikasi hanya MinIO lokal.
- Pemulihan volume dan konfigurasi yang benar-benar dipakai pada host deployment, serta pengiriman alert backup.
- Xendit Test Mode pada staging dengan kredensial yang disimpan di secret store.
- Smoke test health dari luar host, notifikasi on-call, uji LCP pada undangan staging, dan load test staging hingga 1.000 virtual user.
- Review kesiapan produksi serta keputusan operator/legal. Kebijakan tersebut sengaja tetap terbuka sesuai arahan operator.

Untuk menjalankan gate staging, workflow memerlukan HTTPS origin staging, path undangan publik yang sudah terbit, URL health produksi, dan konfirmasi bahwa target terisolasi serta siap menerima beban uji.
