/**
 * Copy shown only in the local visual reference demo. These examples are not
 * invitation data, menu orders, accommodation listings, or payment details.
 */
export const referenceDemoContent = {
  schedule: [
    { time: "17.30", label: "PENYAMBUTAN", title: "Kami menantikan kehadiran Anda.", description: "Datang sedikit lebih awal untuk menyapa keluarga.", image: "blush-timeline-start.png" },
    { time: "event-time", label: "RESEPSI", title: "Mari merayakan hari istimewa ini bersama.", description: "Kebersamaan dimulai pada pukul 18.00.", image: "blush-timeline-lunch.png" },
    { time: "20.00", label: "RAMAH TAMAH", title: "Berbagi doa dan kebahagiaan.", description: "Contoh susunan acara untuk demo lokal.", image: "blush-timeline-party.png" },
    { time: "21.30", label: "PENUTUP", title: "Sampai jumpa di kesempatan berikutnya.", description: "Terima kasih telah menjadi bagian dari hari ini.", image: "blush-timeline-end.png" },
  ],
  attire: "Busana kasual",
  attireSubtitle: "Busana santai bernuansa kolam renang",
  paletteCaption: "Palet warna yang disarankan:",
  palette: [
    { name: "Cokelat kelabu", color: "#c9b8a5" },
    { name: "Putih", color: "#fffdfb" },
    { name: "Ungu lavender", color: "#b6a2cb" },
    { name: "Emas mawar", color: "#e7c6b4" },
    { name: "Ungu lembut", color: "#8270e9" },
  ],
  story: "Kami ingin perayaan ini terasa dekat dan istimewa. Di dalamnya tersimpan kenangan berharga, kejutan penuh perhatian, dan momen kecil yang ingin kami bagikan kepada Anda.",
  giftNote: "Kehadiran Anda adalah hadiah terindah bagi kami. Terima kasih telah merayakan hari ini bersama.",
  menu: [
    { label: "Hidangan pembuka", title: "Burrata dengan Paduan Tomat Warisan", description: "Burrata lembut dengan tomat warisan yang matang sempurna di bawah matahari." },
    { label: "Hidangan utama", title: "Tenderloin Sapi Berlapis Miso", description: "Tenderloin panggang dengan puree parsnip yang lembut." },
    { label: "Hidangan penutup", title: "Mousse Cokelat Putih dan Raspberry", description: "Mousse cokelat putih dengan raspberry segar." },
  ],
  faq: [
    { question: "Bolehkah saya membawa seorang pendamping?", answer: "Silakan ikuti informasi penerima undangan yang diberikan oleh pengundang." },
    { question: "Bolehkah saya membawa orang tua?", answer: "Jumlah tamu mengikuti detail undangan yang diterima." },
    { question: "Bolehkah saya membawa anak?", answer: "Hubungi pengundang jika Anda memerlukan informasi lebih lanjut." },
  ],
  accommodation: [
    { title: "Penginapan sekitar", description: "Ilustrasi lokasi menginap · detail mengikuti pilihan pengundang.", image: "blush-accommodation-one.png" },
    { title: "Perjalanan menuju acara", description: "Lihat tautan peta pada detail acara untuk petunjuk menuju lokasi.", image: "blush-accommodation-two.png" },
  ],
} as const;
