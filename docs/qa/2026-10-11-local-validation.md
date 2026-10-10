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

## Gate yang belum dibuktikan

- Backup terenkripsi melalui `age`, upload ke Cloudflare R2, lalu pemulihan dari objek R2 ke database baru.
- Pemulihan volume dan konfigurasi yang benar-benar dipakai pada host deployment, serta pengiriman alert backup.
- Xendit Test Mode pada staging dengan kredensial yang disimpan di secret store.
- Smoke test health dari luar host, notifikasi on-call, uji LCP pada undangan staging, dan load test staging hingga 1.000 virtual user.
- Review kesiapan produksi serta keputusan operator/legal. Kebijakan tersebut sengaja tetap terbuka sesuai arahan operator.

Untuk menjalankan gate staging, workflow memerlukan HTTPS origin staging, path undangan publik yang sudah terbit, URL health produksi, dan konfirmasi bahwa target terisolasi serta siap menerima beban uji.
