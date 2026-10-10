# Kebijakan Refund TamuKita

> **DRAF INTERNAL — kebijakan komersial belum diputuskan. Jangan dipublikasikan sebelum semua penanda `[ISI]` diisi dan aturan ditinjau penasihat hukum.** Hak konsumen menurut peraturan yang berlaku tetap dihormati.

**Operator:** [ISI NAMA BADAN USAHA]  
**Kontak pengajuan/pengaduan:** [ISI EMAIL/FORMULIR]  
**Berlaku sejak:** [ISI TANGGAL]

## 1. Cara mengajukan

Kirim permintaan melalui **[ISI KANAL]** dengan nomor order, email akun pembeli, komponen yang diminta untuk direfund, jumlah, dan alasan. Jangan meminta data pembayaran sensitif yang tidak diperlukan. Operator akan mengonfirmasi penerimaan dalam **[ISI SLA]**, menilai kelayakan dalam **[ISI SLA]**, dan memberikan nomor kasus.

Refund yang disetujui dikirim melalui metode pembayaran asal jika penyedia mendukungnya. Pengajuan di dashboard admin belum berarti refund berhasil; status menjadi final setelah penyedia pembayaran mengonfirmasi melalui webhook. Waktu dana masuk dapat bergantung pada penyedia dan bank/metode pembayaran.

## 2. Lisensi template, aktivasi, dan hosting

Operator harus memilih dan mengisi aturan untuk setiap komponen berikut, termasuk keadaan layanan belum digunakan, sudah dipublikasikan, terjadi kegagalan layanan, pembayaran ganda, atau kesalahan harga:

| Komponen | Aturan yang harus diputuskan sebelum peluncuran |
|---|---|
| Lisensi template per undangan | [ISI syarat, periode pengajuan, dan metode perhitungan refund] |
| Biaya aktivasi | [ISI syarat dan perlakuan bila publikasi gagal/layanan belum digunakan] |
| Hosting awal/perpanjangan | [ISI kebijakan prabayar, pembatalan, dan sisa masa layanan] |
| Pembayaran ganda/salah jumlah | [ISI prosedur koreksi/refund] |
| Gangguan atau kegagalan layanan | [ISI kompensasi, refund, atau perpanjangan layanan] |

Aturan produk tidak boleh mengecualikan hak konsumen yang diwajibkan oleh hukum. Cantumkan apakah biaya/komponen tertentu memang tidak dapat dikembalikan hanya setelah penasihat hukum menilai dasar dan cara penyampaiannya.

## 3. Top-up kredit reseller

Sistem saat ini hanya dapat mengajukan refund top-up reseller dalam jumlah yang setara dengan kredit utuh dan belum dipakai dari lot top-up asal. Saldo kredit yang diminta untuk refund dicadangkan saat permintaan dibuat, lalu dipulihkan jika Xendit menolak refund. Kredit lama tanpa atribusi sumber yang cukup dapat membutuhkan rekonsiliasi sebelum dinilai.

Kebijakan komersial yang belum ditetapkan: masa pengajuan **[ISI]**, perlakuan kredit bonus/promosi **[ISI]**, dan apakah kredit memiliki masa kedaluwarsa **[ISI — saat ini jangan menjanjikan kedaluwarsa atau tidak kedaluwarsa tanpa keputusan operator]**. Kredit aktivasi digunakan sebagai unit layanan reseller dan bukan saldo tunai; pembatasan ini tetap tunduk pada hak konsumen dan hukum yang berlaku.

## 4. Perhitungan dan akibat refund

Refund dapat penuh atau sebagian sepanjang transaksi dan penyedia mendukungnya. Nilai yang dapat diajukan tidak melebihi nilai yang belum direfund. Sistem hanya menganggap status akhir berdasarkan webhook penyedia.

Untuk order lisensi, aplikasi menonaktifkan undangan hanya setelah jumlah refund sukses mencapai seluruh nilai order terkait. Karena satu order dapat berisi lebih dari satu komponen, operator harus menjelaskan kepada pembeli konsekuensi refund sebagian dan penuh sebelum transaksi: **[ISI PENJELASAN FINAL DAN SAMAKAN DENGAN PERILAKU PRODUK]**.

Biaya pihak ketiga, pajak, dan biaya administrasi: **[ISI PERLAKUAN SETELAH TINJAUAN HUKUM DAN KONFIRMASI PENYEDIA]**. Jangan menjanjikan potongan atau pengembalian komponen tersebut sebelum diverifikasi.

## 5. Pengaduan dan eskalasi

Jika permintaan ditolak atau hasilnya belum sesuai, pembeli dapat meminta peninjauan ulang melalui **[ISI KANAL]** dalam **[ISI JANGKA WAKTU]**. Pengaduan dicatat, diperiksa oleh **[ISI PERAN/PETUGAS]**, dan diberi jawaban dalam **[ISI SLA]**. Kanal penyelesaian sengketa konsumen eksternal yang relevan: **[ISI SETELAH VALIDASI HUKUM]**.

