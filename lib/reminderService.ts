// lib/reminderService.ts
import { db } from '@/app/firebase/client';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import emailjs from '@emailjs/browser';

export type ReminderSettings = {
  enabled: boolean;
  hariSebelum: number;
  emailPengirim?: string;
  whatsappNumber?: string;
};

// Cek tagihan yang akan jatuh tempo
export async function checkUpcomingPayments() {
  const today = new Date();
  const threeDaysLater = new Date();
  threeDaysLater.setDate(today.getDate() + 3);

  // 1. Cek pinjaman yang akan jatuh tempo (dalam 3 hari)
  const pinjamanAktif = await getDocs(query(
    collection(db, 'pinjaman'),
    where('status', '==', 'aktif')
  ));

  const upcomingPinjaman: any[] = [];
  pinjamanAktif.forEach(doc => {
    const data = doc.data();
    // Asumsikan tanggal jatuh tempo adalah tanggal diajukan + 1 bulan
    const tanggalJatuhTempo = data.disetujuiPada?.toDate();
    if (tanggalJatuhTempo) {
      const nextDueDate = new Date(tanggalJatuhTempo);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      
      if (nextDueDate <= threeDaysLater && nextDueDate >= today) {
        upcomingPinjaman.push({
          ...data,
          id: doc.id,
          tanggalJatuhTempo: nextDueDate,
          jenis: 'pinjaman'
        });
      }
    }
  });

  // 2. Cek cash bulanan yang belum dibayar
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  
  const cashBelumBayar = await getDocs(query(
    collection(db, 'cash_bulanan'),
    where('bulan', '==', currentMonth),
    where('tahun', '==', currentYear),
    where('statusBayar', '==', 'belum')
  ));

  const upcomingCash: any[] = [];
  cashBelumBayar.forEach(doc => {
    upcomingCash.push({
      ...doc.data(),
      id: doc.id,
      jenis: 'cash',
      tanggalJatuhTempo: new Date(currentYear, currentMonth - 1, 25)
    });
  });

  return { upcomingPinjaman, upcomingCash };
}

// Kirim reminder via email (pake EmailJS)
export async function sendEmailReminder(to: string, nama: string, jenis: string, jumlah: number, tanggalJatuhTempo: Date) {
  const templateParams = {
    to_email: to,
    to_name: nama,
    jenis_payment: jenis === 'pinjaman' ? 'Angsuran Pinjaman' : 'Cash Bulanan',
    jumlah: `Rp ${jumlah.toLocaleString('id-ID')}`,
    due_date: tanggalJatuhTempo.toLocaleDateString('id-ID'),
    tahun: new Date().getFullYear().toString(),
  };

  try {
    const response = await emailjs.send(
      process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
      templateParams,
      process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
    );
    return { success: true, response };
  } catch (error) {
    console.error('Email gagal dikirim:', error);
    return { success: false, error };
  }
}

// Kirim reminder via WhatsApp (pake API eksternal)
export async function sendWhatsAppReminder(phoneNumber: string, nama: string, jenis: string, jumlah: number, tanggalJatuhTempo: Date) {
  // Format nomor WhatsApp (hapus +62 atau 0)
  let formattedNumber = phoneNumber.replace(/\D/g, '');
  if (formattedNumber.startsWith('0')) {
    formattedNumber = '62' + formattedNumber.substring(1);
  }
  if (!formattedNumber.startsWith('62')) {
    formattedNumber = '62' + formattedNumber;
  }

  const message = `Halo ${nama},\n\nIni adalah pengingat bahwa tagihan ${jenis === 'pinjaman' ? 'angsuran pinjaman' : 'cash bulanan'} Anda sebesar Rp ${jumlah.toLocaleString('id-ID')} akan jatuh tempo pada ${tanggalJatuhTempo.toLocaleDateString('id-ID')}.\n\nSegera lakukan pembayaran ya!\n\n- GUJALA 23 -`;

  try {
    // Gunakan API WhatsApp (contoh: Fonnte, WA Gateway, dll)
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': process.env.NEXT_PUBLIC_FONNTE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: formattedNumber,
        message: message,
      }),
    });
    return { success: response.ok, response };
  } catch (error) {
    console.error('WhatsApp gagal dikirim:', error);
    return { success: false, error };
  }
}

// Simpan pengaturan reminder
export async function saveReminderSettings(userId: string, settings: ReminderSettings) {
  const settingsRef = doc(db, 'reminder_settings', userId);
  await updateDoc(settingsRef, {
    ...settings,
    updatedAt: Timestamp.now(),
  }).catch(async () => {
    // Jika belum ada, buat baru
    await setDoc(settingsRef, {
      ...settings,
      userId,
      createdAt: Timestamp.now(),
    });
  });
}

// Ambil pengaturan reminder
export async function getReminderSettings(userId: string): Promise<ReminderSettings> {
  const settingsRef = doc(db, 'reminder_settings', userId);
  const settingsSnap = await getDoc(settingsRef);
  if (settingsSnap.exists()) {
    return settingsSnap.data() as ReminderSettings;
  }
  return {
    enabled: true,
    hariSebelum: 3,
  };
}