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
  attire: "Casual Attire",
  attireSubtitle: "Casual Pool wear",
  paletteCaption: "Suggested colors:",
  palette: [
    { name: "Taupe", color: "#c9b8a5" },
    { name: "White", color: "#fffdfb" },
    { name: "Lavender", color: "#b6a2cb" },
    { name: "Rose Gold", color: "#e7c6b4" },
    { name: "Dusty", color: "#8270e9" },
  ],
  story: "We wanted this celebration to feel personal. Inside are cherished memories, thoughtful surprises, and small moments we are glad to share with you.",
  giftNote: "Your presence is your gift. Thank you for celebrating this day with us.",
  menu: [
    { label: "Starter", title: "Burrata & Heirloom Medley", description: "Creamy burrata with sun-ripened heirloom tomatoes." },
    { label: "Main", title: "Miso-Glazed Beef Tenderloin", description: "Pan-seared tenderloin with silky parsnip purée." },
    { label: "Desserts", title: "Velvet White Chocolate & Raspberry Mousse", description: "White chocolate mousse with fresh raspberry." },
  ],
  faq: [
    { question: "Can I bring a plus one?", answer: "Silakan ikuti informasi penerima undangan yang diberikan oleh pengundang." },
    { question: "Can I bring my parents?", answer: "Jumlah tamu mengikuti detail undangan yang diterima." },
    { question: "Can I bring my child?", answer: "Hubungi pengundang jika Anda memerlukan informasi lebih lanjut." },
  ],
  accommodation: [
    { title: "Penginapan sekitar", description: "Ilustrasi lokasi menginap · detail mengikuti pilihan pengundang.", image: "blush-accommodation-one.png" },
    { title: "Perjalanan menuju acara", description: "Lihat tautan peta pada detail acara untuk petunjuk menuju lokasi.", image: "blush-accommodation-two.png" },
  ],
} as const;
