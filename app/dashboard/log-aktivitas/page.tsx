'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { History, User, Wallet, HandCoins, CalendarDays, Trophy, Megaphone, LogIn, LogOut, Settings } from 'lucide-react';

type ActivityLogType = {
  id: string;
  userId: string;
  userNama: string;
  userRole: string;
  activity: string;
  deskripsi: string;
  timestamp: Date;
};

const getActivityIcon = (activity: string) => {
  if (activity.includes('login')) return <LogIn size={16} />;
  if (activity.includes('logout')) return <LogOut size={16} />;
  if (activity.includes('tambah') || activity.includes('edit')) return <User size={16} />;
  if (activity.includes('setor') || activity.includes('tarik')) return <Wallet size={16} />;
  if (activity.includes('pinjaman')) return <HandCoins size={16} />;
  if (activity.includes('cash')) return <CalendarDays size={16} />;
  if (activity.includes('arisan')) return <Trophy size={16} />;
  if (activity.includes('pengumuman')) return <Megaphone size={16} />;
  return <Settings size={16} />;
};

const getActivityColor = (activity: string) => {
  if (activity.includes('login')) return 'text-blue-600 bg-blue-100';
  if (activity.includes('logout')) return 'text-gray-600 bg-gray-100';
  if (activity.includes('tambah')) return 'text-green-600 bg-green-100';
  if (activity.includes('hapus')) return 'text-red-600 bg-red-100';
  if (activity.includes('setor')) return 'text-green-600 bg-green-100';
  if (activity.includes('tarik')) return 'text-orange-600 bg-orange-100';
  return 'text-gray-600 bg-gray-100';
};

export default function LogAktivitasPage() {
  const { user, userData } = useAuth();
  const [logs, setLogs] = useState<ActivityLogType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let q;
      if (userData?.role === 'pengelola') {
        q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
      } else {
        q = query(collection(db, 'activity_logs'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(50));
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate() || new Date() })) as ActivityLogType[];
      setLogs(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-xl"><History size={24} className="text-blue-600" /></div>
        <div><h1 className="text-2xl font-bold">Riwayat Aktivitas</h1><p className="text-gray-500">Catatan semua aktivitas Anda</p></div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
        {loading ? (
          <div className="text-center py-4">Memuat...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-4 text-gray-500">Belum ada aktivitas</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className={`p-2 rounded-full ${getActivityColor(log.activity)}`}>{getActivityIcon(log.activity)}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{log.deskripsi}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Oleh: {log.userNama} ({log.userRole === 'pengelola' ? 'Pengelola' : 'Anggota'})</p>
                  <p className="text-xs text-gray-400">{log.timestamp.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}