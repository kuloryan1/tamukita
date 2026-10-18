# Status implementasi blueprint TamuKita

Audit terhadap *Master Plan End-to-End — TamuKita*, versi 2.0. Status per 19 Oktober 2026. “Selesai di kode” berarti fungsi ada di repository dan memiliki cakupan automated test yang sesuai; status ini tidak menyatakan bahwa layanan telah dijalankan di VPS atau siap menerima pelanggan.

## Project Execution Checklist

| # | Tahap blueprint | Status | Bukti dan batas yang diketahui |
|---|---|---|---|
| 01 | PRD dan aturan bisnis | Sebagian | Alur customer, admin, reseller, pembayaran, dan lisensi tercermin di aplikasi. Identitas operator, retensi, refund final, pelindungan anak, vendor/lokasi pemrosesan, serta tinjauan hukum sengaja tetap terbuka; lihat [checklist legal](legal/LAUNCH-CHECKLIST.md). |
| 02 | UX customer, admin, reseller, developer | Sebagian | Halaman dan alur utama tersedia dan sebagian diuji Playwright pada desktop serta browser mobile. Persetujuan prototype/desain tersendiri belum tercatat. |
| 03 | Database multi-tenant dan RBAC | Selesai di kode | Schema Prisma memisahkan workspace, pemilik/pembuat undangan, anggota, pembayaran, reseller, dan ledger kredit. Pengujian E2E mencakup batas akses akun dan reseller. |
| 04 | Repository, CI/CD, Docker, staging | Sebagian | Docker Compose dan GitHub Actions tersedia; workflow validasi memeriksa lint, typecheck, unit, build, konfigurasi Tunnel, dan restore drill, sedangkan workflow E2E terpisah menjalankan Playwright. Branch `main` pada commit `7b7ad15` sudah dideploy manual ke staging; worker, web, PostgreSQL, dan Redis sehat. Domain staging menjawab HTTP 200 untuk halaman utama dan `/api/health`; Tunnel diarahkan langsung ke service web staging pada network bersama. QA alur undangan, provider, dan beban masih menunggu fixture serta kredensial non-production. Lihat [runbook Dokploy](deploy/dokploy.md). |
| 05 | Template SDK dan tiga template | Selesai di kode | `royal-gold`, `elegant-cream`, dan `modern-sage` tersedia. Schema dinamis, renderer, versioning, dan review kandidat diuji melalui validasi serta E2E. Lihat [kontrak Template SDK](template-sdk.md). |
| 06 | Smart Form dan live preview | Selesai di kode | Editor menyimpan draft, memulihkan perubahan, menyediakan preview, dan memvalidasi field template di server; tercakup pada E2E editor. |
| 07 | Photo Editor dan media pipeline | Selesai di kode; layanan nyata belum diverifikasi | Upload/crop, pemrosesan worker, hasil WebP, dan pemulihan edit diuji dengan R2 mock. Kredensial serta bucket R2 non-production belum diuji dari VPS. |
| 08 | Renderer undangan dan RSVP | Selesai di kode | Route slug publik, snapshot undangan, RSVP, daftar tamu, dan moderasi buku tamu tersedia dengan cakupan E2E. |
| 09 | Xendit checkout dan webhook | Selesai di kode; Test Mode belum dijalankan | Checkout, callback terverifikasi, idempotensi, expiry, dan refund diuji memakai mock. Kredensial Xendit Test Mode dan transaksi dari staging belum diverifikasi. |
| 10 | Lisensi template dan billing | Selesai di kode; keputusan refund terbuka | Lisensi, paket, entitlement, renewal hosting, rekonsiliasi, dan alur refund tersedia. Kebijakan bisnis final harus ditetapkan operator sebelum publikasi. |
| 11 | Kredit reseller dan admin-managed | Selesai di kode; pembayaran nyata belum diverifikasi | Pembuatan undangan admin, persetujuan akses pelanggan, staf reseller, ledger kredit, aktivasi, dan laporan memiliki cakupan E2E dengan provider mock. |
| 12 | QA otomatis, keamanan, dan load test | Sebagian | CI #77 lulus, termasuk 48 unit test dan restore drill; E2E smoke #77 lulus dengan 52 test lulus dan 2 dilewati. E2E masih mencatat peringatan deprecation `pg` yang tidak memblokir; stack trace berakhir di adapter Prisma dan belum menunjukkan call site aplikasi. Uji LCP/load 1.000 VU di staging, pengujian provider nyata, restore VPS, monitoring eksternal, dan pembuktian isolasi runtime belum dilakukan. |
| 13 | Pilot dan go-live production | Belum dimulai | Staging sudah online dan health check publik lulus. Apex `tamukita.io` masih menampilkan halaman parked Hostinger; respons HTTP 200 bukan health check aplikasi. QA alur penuh, kesiapan uji beban, restore VPS, monitoring eksternal, serta keputusan legal/operator masih terbuka; belum ada pilot atau deployment production. |

## Definition of Done

| Kriteria blueprint | Bukti aplikasi | Gate sebelum dianggap selesai |
|---|---|---|
| Customer membuat, mengedit, membayar, dan menerbitkan undangan | Alur editor dan pembayaran diuji dengan fixture serta webhook mock. | Jalankan transaksi Xendit Test Mode di staging yang terisolasi. |
| Admin membuatkan undangan untuk pelanggan | Tersedia halaman admin-managed dan E2E pembuatan draft serta pemberitahuan pemilik. | Verifikasi perilaku email pada konfigurasi staging. |
| Reseller top-up dan mengaktifkan undangan | Alur kredit, persetujuan akses, ledger, dan callback idempoten tercakup E2E. | Verifikasi top-up Test Mode dan aktivasi pada VPS staging. |
| Template baru dapat memakai editor yang sama dan versi lama tetap aktif | Schema/manifest template, review, dan versioning tersedia; E2E memeriksa versi lama tetap aktif saat review. | Tidak ada gate kode yang diketahui; tetap jalankan QA rilis. |
| Foto, galeri, RSVP, dan tamu berfungsi | Editor media dan interaksi tamu tercakup E2E dengan service mock. | Verifikasi R2 non-production dan alur publik setelah deploy. |
| Transaksi Xendit dapat direkonsiliasi | Webhook, pencatatan event, refund, serta ekspor rekonsiliasi tersedia. | Cocokkan transaksi nyata Test Mode dari awal sampai laporan. |
| Data tenant terisolasi | Otorisasi workspace dan skenario akses lintas akun/reseller diuji otomatis. | Periksa konfigurasi runtime staging dan lakukan review keamanan sebelum pilot. |
| Deployment, backup, restore, monitoring, dan pemulihan telah diuji | Compose health check, smoke check, skrip backup/restore, timer, alert, dan CI restore drill tersedia. | Deploy serta lakukan restore drill di VPS dan sambungkan alert eksternal. |
| Custom Domain tetap Coming Soon | Dashboard menampilkan item nonaktif tanpa integrasi DNS pelanggan. | Sudah sesuai blueprint MVP. |

## Urutan penyelesaian yang tersisa

1. Selesaikan QA alur customer, admin, developer, billing, reseller, dan guest/security pada staging; siapkan undangan uji publik serta kredensial Xendit Test Mode, bucket R2 non-production, dan email uji.
2. Isi GitHub environment `staging` dengan `STAGING_BASE_URL` dan `STAGING_INVITATION_PATH`. `PRODUCTION_HOSTNAMES` opsional untuk memblokir host production tambahan; root `tamukita.io` dan `www.tamukita.io` selalu ditolak oleh workflow. Jalankan `staging-quality` hanya setelah isolasi target diverifikasi dan operator mengonfirmasi kesiapan beban sampai 1.000 virtual user.
3. Lakukan restore drill dan pemeriksaan monitoring di VPS, selesaikan keputusan operator/legal yang terbuka, lalu jalankan pilot sebelum production.

Catatan QA lokal dan CI terdahulu dirangkum di [validasi lokal](qa/2026-10-11-local-validation.md). Status live Dokploy, konektor Cloudflare, domain, dan gate runtime dicatat di [runbook deployment](deploy/dokploy.md). Aplikasi staging saat ini menjalankan commit `7b7ad15`; [CI #77](https://github.com/kuloryan1/tamukita/actions/runs/39147015018) dan [E2E smoke #77](https://github.com/kuloryan1/tamukita/actions/runs/39147015089) lulus. Hasil CI dan mock tidak menggantikan verifikasi provider nyata pada VPS atau keputusan operator.
