// lib/activityLogger.ts
import { db } from '@/app/firebase/client';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export type ActivityType = 
  | 'login' 
  | 'logout' 
  | 'register'
  | 'tambah_anggota'
  | 'edit_anggota'
  | 'hapus_anggota'
  | 'setor_saldo'
  | 'tarik_saldo'
  | 'ajukan_pinjaman'
  | 'setujui_pinjaman'
  | 'tolak_pinjaman'
  | 'bayar_pinjaman'
  | 'bayar_cash'
  | 'buat_arisan'
  | 'buat_pengumuman'
  | 'edit_pengumuman'
  | 'hapus_pengumuman'
  | 'ganti_password'
  | 'edit_profil';

export interface ActivityLog {
  userId: string;
  userNama: string;
  userRole: string;
  activity: ActivityType;
  deskripsi: string;
  detail?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export async function logActivity(
  userId: string,
  userNama: string,
  userRole: string,
  activity: ActivityType,
  deskripsi: string,
  detail?: any
) {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId,
      userNama,
      userRole,
      activity,
      deskripsi,
      detail: detail || null,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('Gagal mencatat aktivitas:', error);
  }
}