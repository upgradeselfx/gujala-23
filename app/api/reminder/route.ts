// app/api/reminder/route.ts
import { NextResponse } from 'next/server';
import { checkUpcomingPayments, sendEmailReminder, sendWhatsAppReminder } from '@/lib/reminderService';
import { db } from '@/app/firebase/client';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { type, userId } = await request.json();
    
    if (type === 'check') {
      const { upcomingPinjaman, upcomingCash } = await checkUpcomingPayments();
      
      // Ambil semua anggota
      const anggotaSnap = await getDocs(collection(db, 'users'));
      const anggotaMap = new Map();
      anggotaSnap.forEach(doc => {
        anggotaMap.set(doc.id, doc.data());
      });
      
      const reminders = [];
      
      // Reminder pinjaman
      for (const pinjaman of upcomingPinjaman) {
        const anggota = anggotaMap.get(pinjaman.userId);
        if (anggota && anggota.email) {
          reminders.push({
            userId: pinjaman.userId,
            email: anggota.email,
            nama: anggota.nama,
            jenis: 'pinjaman',
            jumlah: pinjaman.sisa,
            tanggalJatuhTempo: pinjaman.tanggalJatuhTempo,
          });
        }
      }
      
      // Reminder cash
      for (const cash of upcomingCash) {
        const anggota = anggotaMap.get(cash.userId);
        if (anggota && anggota.email) {
          reminders.push({
            userId: cash.userId,
            email: anggota.email,
            nama: anggota.nama,
            jenis: 'cash',
            jumlah: cash.jumlah,
            tanggalJatuhTempo: cash.tanggalJatuhTempo,
          });
        }
      }
      
      return NextResponse.json({ reminders, count: reminders.length });
    }
    
    if (type === 'send') {
      const { reminder } = await request.json();
      
      // Kirim email
      const emailResult = await sendEmailReminder(
        reminder.email,
        reminder.nama,
        reminder.jenis,
        reminder.jumlah,
        new Date(reminder.tanggalJatuhTempo)
      );
      
      return NextResponse.json({ success: emailResult.success });
    }
    
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}