// lib/chatbotResponses.ts

type ResponseRule = {
  keywords: string[];
  response: string | ((params: { role: string; message: string }) => string);
};

// Database jawaban AI (dengan pembedaan role)
const responseRules: ResponseRule[] = [
  // ========== SAPAAN ==========
  {
    keywords: ['halo', 'hai', 'hey', 'hi', 'selamat pagi', 'selamat siang', 'selamat malam', 'pagi', 'siang', 'malam'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "Halo Bos Pengelola! 👋 Ada yang bisa saya bantu? Saya siap membantu mengelola GUJALA 23. Tanyakan tentang anggota, pinjaman, arisan, atau fitur lainnya!";
      }
      return "Halo Bos! 👋 Ada yang bisa saya bantu? Saya AI asisten GUJALA 23. Tanyakan tentang simpanan, pinjaman, arisan, atau cara pakai aplikasi ini!";
    }
  },
  {
    keywords: ['terima kasih', 'makasih', 'thanks', 'thank you', 'thank'],
    response: "Sama-sama Bos! Senang bisa membantu. Kalo ada pertanyaan lain, tanya aja ya 😊"
  },
  {
    keywords: ['siapa kamu', 'kamu siapa', 'siapa anda', 'perkenalan'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "Saya adalah AI asisten GUJALA 23 versi Pengelola! 🤖 Saya dirancang khusus untuk membantu Anda mengelola aplikasi koperasi, arisan, dan cash bulanan. Saya bisa membantu menjawab pertanyaan tentang anggota, transaksi, laporan, dan fitur administrasi lainnya.";
      }
      return "Saya adalah AI asisten GUJALA 23 🤖 Saya dibuat untuk membantu anggota memahami fitur-fitur aplikasi, cara menggunakan simpanan, pinjaman, arisan, dan menjawab pertanyaan umum lainnya. Ada yang bisa saya bantu, Bos?";
    }
  },

  // ========== FITUR UMUM ==========
  {
    keywords: ['bisa apa', 'kamu bisa', 'fitur', 'fungsi', 'apa saja'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "📋 **Fitur untuk Pengelola:**\n\n1. **Kelola Anggota** - Tambah, edit, hapus anggota\n2. **Simpanan** - Setor/tarik saldo untuk anggota\n3. **Pinjaman** - Setujui/tolak, catat pembayaran angsuran\n4. **Cash Bulanan** - Atur besaran, catat pembayaran anggota\n5. **Arisan** - Buat sesi, pilih pemenang\n6. **Pengumuman** - Buat/edit/hapus pengumuman\n7. **Laporan** - Lihat semua laporan + export\n8. **Laporan Tahunan** - Rekap keuangan tahunan\n9. **Dashboard** - Grafik & ringkasan data\n\nAda yang ingin ditanyakan lebih detail, Bos?";
      }
      return "📋 **Fitur untuk Anggota:**\n\n1. **Simpanan** - Lihat saldo & riwayat (setor/tarik hubungi pengelola)\n2. **Pinjaman** - Ajukan pinjaman & pantau status\n3. **Cash Bulanan** - Lihat kewajiban iuran\n4. **Arisan** - Lihat riwayat arisan\n5. **Pengumuman** - Baca pengumuman\n6. **Laporan** - Lihat laporan pribadi\n7. **Dashboard** - Lihat ringkasan saldo & pinjaman\n8. **Profil** - Edit profil & ganti password\n\nFitur apa yang ingin Bos ketahui lebih lanjut?";
    }
  },
  {
    keywords: ['cara pakai', 'tutorial', 'panduan', 'bagaimana cara', 'petunjuk'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "📖 **Panduan Pengelola:**\n\n1. **Kelola Anggota** → Tambah anggota dengan isi data (password default 'anggota123')\n2. **Simpanan** → Pilih anggota, klik Setor/Tarik, isi jumlah\n3. **Pinjaman** → Lihat pengajuan, klik Setujui/Tolak, catat pembayaran\n4. **Cash Bulanan** → Atur besaran, tandai anggota yang sudah bayar\n5. **Arisan** → Buat sesi, pilih pemenang (manual/acak)\n6. **Laporan** → Filter per anggota, export CSV atau cetak\n\nAda langkah yang ingin didetailkan, Bos?";
      }
      return "📖 **Panduan Anggota:**\n\n1. **Ajukan Pinjaman** → Buka menu Pinjaman, klik Ajukan, isi jumlah & tenor\n2. **Pantau Status** → Lihat status pinjaman (Menunggu/Aktif/Lunas/Ditolak)\n3. **Bayar Cash** → Hubungi pengelola untuk bayar cash bulanan\n4. **Lihat Arisan** → Buka menu Arisan untuk lihat riwayat\n5. **Baca Pengumuman** → Klik bell icon atau buka menu Pengumuman\n\nAda yang ingin ditanyakan lebih lanjut, Bos?";
    }
  },

  // ========== SIMPANAN ==========
  {
    keywords: ['simpanan', 'setor', 'tarik', 'saldo', 'nabung'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "💳 **Fitur Simpanan (Pengelola):**\n\n- Anda bisa setor/tarik saldo untuk anggota mana pun\n- Setiap transaksi tercatat di riwayat\n- Saldo anggota bisa dilihat di ringkasan 'Semua Anggota'\n- Transaksi terekam otomatis dan mempengaruhi saldo\n\nCara: Pilih anggota → klik Setor/Tarik → isi jumlah → simpan.";
      }
      return "💳 **Fitur Simpanan (Anggota):**\n\n- Anda hanya bisa **melihat** saldo dan riwayat transaksi\n- Untuk setor atau tarik saldo, silakan **hubungi pengelola**\n- Setiap transaksi akan tercatat di riwayat Anda\n\nSaldo Anda saat ini bisa dilihat di dashboard utama, Bos.";
    }
  },

  // ========== PINJAMAN ==========
  {
    keywords: ['pinjaman', 'pinjam', 'angsuran', 'bunga', 'tenor'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "💰 **Fitur Pinjaman (Pengelola):**\n\n- **Setujui/Tolak** pengajuan pinjaman anggota\n- **Catat pembayaran** angsuran (1-4 bulan atau langsung lunas)\n- Bunga flat 5% dari jumlah pinjaman\n- Lihat semua pinjaman aktif & lunas\n- Filter berdasarkan status (Menunggu/Aktif/Lunas/Ditolak)\n\nCara: Buka menu Pinjaman → pilih pengajuan → Setujui/Tolak → untuk bayar, pilih pinjaman aktif → Catat Pembayaran.";
      }
      return "💰 **Fitur Pinjaman (Anggota):**\n\n- **Ajukan pinjaman** dengan bunga flat 5%\n- Tenor 1-36 bulan\n- Status pinjaman: Menunggu → Aktif → Lunas / Ditolak\n- Anda bisa pantau status & sisa pinjaman\n- Angsuran per bulan dihitung otomatis\n\n**Cara:** Buka Pinjaman → Ajukan Pinjaman → isi jumlah & tenor → tunggu persetujuan pengelola.";
    }
  },

  // ========== ARISAN ==========
  {
    keywords: ['arisan', 'undian', 'pemenang', 'kupon', 'sesi'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "🎲 **Fitur Arisan (Pengelola):**\n\n- **Buat sesi arisan** per bulan\n- **Pilih pemenang** (manual dari dropdown atau acak)\n- **Potong saldo** pemenang otomatis\n- **Pengumuman** dibuat otomatis\n- Lihat riwayat semua sesi arisan\n\nCara: Buka Arisan → Buat Sesi → pilih bulan/tahun → pilih pemenang → Buat Sesi.";
      }
      return "🎲 **Fitur Arisan (Anggota):**\n\n- Lihat **riwayat arisan** (periode, pemenang, potongan)\n- Total kas arisan yang sudah terkumpul\n- Pemenang arisan dipilih oleh pengelola\n- Anggota hanya bisa melihat, tidak bisa mengikuti sesi\n\nCara: Buka menu Arisan untuk lihat riwayat.";
    }
  },

  // ========== CASH BULANAN ==========
  {
    keywords: ['cash', 'iuran', 'kas', 'bulanan', 'cash bulanan'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "📆 **Cash Bulanan (Pengelola):**\n\n- **Atur besaran cash** per bulan\n- **Catat pembayaran** anggota (potong saldo atau manual)\n- Lihat rekap siapa sudah/belum bayar\n- Ringkasan total terkumpul\n\nCara: Buka Cash Bulanan → pilih bulan/tahun → atur besaran → tandai anggota yang bayar.";
      }
      return "📆 **Cash Bulanan (Anggota):**\n\n- Lihat **kewajiban cash** bulanan Anda\n- Status (Lunas/Belum Lunas)\n- Untuk bayar, silakan **hubungi pengelola**\n- Pengelola akan mencatat pembayaran Anda\n\nBuka menu Cash Bulanan untuk lihat status terbaru, Bos.";
    }
  },

  // ========== LAPORAN ==========
  {
    keywords: ['laporan', 'rekap', 'export', 'csv', 'pdf', 'cetak'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "📊 **Laporan (Pengelola):**\n\n- Laporan Simpanan per anggota\n- Laporan Pinjaman (semua anggota)\n- Laporan Cash Bulanan\n- Laporan Arisan (riwayat pemenang)\n- Laporan Tahunan (rekap keuangan)\n- **Export CSV** dan **Cetak PDF** tersedia\n- Filter per anggota dan periode\n\nCara: Buka Laporan → pilih tab → filter → export/cetak.";
      }
      return "📊 **Laporan (Anggota):**\n\n- Laporan Simpanan (hanya data Anda)\n- Laporan Pinjaman (hanya pinjaman Anda)\n- Laporan Cash Bulanan (status bayar Anda)\n- Laporan Arisan (riwayat)\n- **Export CSV** tersedia untuk data pribadi\n\nCara: Buka Laporan → pilih tab untuk lihat data Anda.";
    }
  },

  // ========== ANGGOTA ==========
  {
    keywords: ['anggota', 'member', 'daftar anggota', 'tambah anggota', 'hapus anggota'],
    response: ({ role }) => {
      if (role === 'pengelola') {
        return "👥 **Kelola Anggota (Pengelola):**\n\n- **Tambah anggota** dengan isi nama, email, no telp, alamat, password\n- **Edit data** anggota\n- **Hapus anggota** (jika diperlukan)\n- Lihat daftar semua anggota\n\nKode admin untuk daftar: **KeBaB23**\nPassword default untuk anggota baru: **anggota123**";
      }
      return "👥 **Anggota:**\n\n- Anda adalah anggota dari GUJALA 23\n- Bisa melihat data Anda sendiri\n- Jika ingin menjadi pengelola, hubungi admin untuk mendapatkan kode admin\n\nKode admin untuk daftar: **KeBaB23**";
    }
  },

  // ========== DARK MODE ==========
  {
    keywords: ['dark mode', 'gelap', 'terang', 'mode', 'tema', 'theme'],
    response: "🌙 **Dark Mode:**\n\nGUJALA 23 mendukung dark mode! Klik ikon 🌙 (bulan) di sidebar untuk beralih ke mode gelap, atau klik ☀️ (matahari) untuk kembali ke mode terang. Pengaturan tema akan tersimpan secara otomatis di browser Anda."
  },

  // ========== NOTIFIKASI ==========
  {
    keywords: ['notifikasi', 'pengumuman', 'bell', 'lonceng'],
    response: "🔔 **Notifikasi & Pengumuman:**\n\n- Notifikasi muncul di **bell icon** (pojok kanan atas)\n- Pengelola bisa **buat pengumuman**\n- Pengumuman otomatis dibuat saat arisan selesai\n- Anggota bisa membaca pengumuman\n- Notifikasi baru ditandai dengan titik merah\n\nKlik bell icon untuk melihat notifikasi terbaru, Bos!"
  },

  // ========== PROFIL ==========
  {
    keywords: ['profil', 'ganti password', 'edit profil', 'ubah password'],
    response: "👤 **Profil & Ganti Password:**\n\n- Buka menu **Profil** di sidebar\n- Anda bisa lihat data diri (nama, email, no telp, alamat, role)\n- **Edit profil** untuk mengubah nama, no telp, alamat\n- **Ganti password** dengan memasukkan password lama & baru\n\n⚠️ Setelah ganti password, Anda akan logout dan harus login ulang."
  },

  // ========== DASHBOARD ==========
  {
    keywords: ['dashboard', 'grafik', 'chart', 'ringkasan'],
    response: "📈 **Dashboard:**\n\n- Ringkasan saldo dan sisa pinjaman\n- Grafik tren keuangan per bulan\n- Komposisi keuangan (simpanan vs pinjaman)\n- Top 5 anggota dengan saldo tertinggi (khusus pengelola)\n\nDashboard adalah halaman utama setelah login, Bos!"
  },

  // ========== ERROR ==========
  {
    keywords: ['error', 'gagal', 'tidak bisa', 'masalah', 'bug'],
    response: "⚠️ **Mengatasi Masalah:**\n\n1. **Refresh halaman** (F5 atau Ctrl+R)\n2. **Cek koneksi internet**\n3. **Logout lalu login ulang**\n4. **Clear cache browser** (Ctrl+Shift+Del)\n5. **Coba browser lain**\n\nJika masih error, hubungi pengelola atau coba lagi nanti. Tim GUJALA 23 akan segera memperbaiki!"
  },

  // ========== LUPA PASSWORD ==========
  {
    keywords: ['lupa password', 'reset password', 'ganti password lupa', 'forgot password'],
    response: "🔐 **Lupa Password?**\n\n1. Buka halaman **Login**\n2. Klik **'Lupa password?'**\n3. Masukkan email terdaftar\n4. Cek email (termasuk folder **Spam**)\n5. Klik link reset password di email\n6. Masukkan password baru\n\nLink reset hanya berlaku 1 jam, Bos!"
  },

  // ========== KODE ADMIN ==========
  {
    keywords: ['root', 'KeBaB23'],
    response: "🔑 **Kode Admin:**\n\nKode admin untuk mendaftar sebagai **Pengelola** adalah:\n\n```\nKeBaB23\n```\n\nCara: Buka halaman Register → isi data → masukkan kode **KeBaB23** di kolom 'Kode Admin (Opsional)' → Daftar."
  },

  // ========== KONTAK / DUKUNGAN ==========
  {
    keywords: ['kontak', 'dukungan', 'support', 'bantuan', 'help', 'email', 'telepon'],
    response: "📧 **Kontak & Dukungan:**\n\nUntuk bantuan lebih lanjut:\n- Email: **mohamadrosyad1927@gmail.com**\n- WhatsApp: **+62 898 4515 022**\n\nTim support akan merespon secepatnya, Bos!"
  }
];

// Default response
const defaultResponse = "Maaf Bos, saya kurang paham dengan pertanyaan itu. 😅\n\nCoba tanyakan tentang:\n- **Fitur** (simpanan, pinjaman, arisan, cash, laporan)\n- **Cara pakai** (tutorial, panduan)\n- **Profil** (ganti password, edit data)\n- **Lupa password**\n-\nKetik kata kunci yang lebih spesifik, ya Bos! 📌";

// Tambahan response untuk keyword umum
const umumResponses: Record<string, string> = {
  'gaji': "💰 Untuk informasi gaji/tunjangan, silakan hubungi pengelola langsung ya Bos!",
  'bonus': "🎁 Untuk informasi bonus, silakan hubungi pengelola, Bos!",
  'libur': "📅 Untuk informasi jadwal libur/cuti, hubungi pengelola, Bos!",
  'rekening': "🏦 Untuk informasi rekening, silakan hubungi pengelola, Bos!",
};

export function getAIResponse(message: string, role: 'anggota' | 'pengelola' = 'anggota'): string {
  const lowerMessage = message.toLowerCase();
  
  // Cek response khusus untuk kata kunci umum
  for (const [key, value] of Object.entries(umumResponses)) {
    if (lowerMessage.includes(key)) {
      return value;
    }
  }
  
  // Cari response berdasarkan keyword
  for (const rule of responseRules) {
    for (const keyword of rule.keywords) {
      if (lowerMessage.includes(keyword)) {
        if (typeof rule.response === 'string') {
          return rule.response;
        }
        return rule.response({ role, message: lowerMessage });
      }
    }
  }
  
  return defaultResponse;
}