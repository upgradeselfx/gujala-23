'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { History, User, Wallet, HandCoins, CalendarDays, Trophy, Megaphone, LogIn, LogOut, Settings, FileText, Search, Filter } from 'lucide-react';

type ActivityLogType = {
  id: string;
  userId: string;
  userNama: string;
  userRole: string;
  activity: string;
  deskripsi: string;
  timestamp: Date;
};

const activityIcons: Record<string, any> = {
  login: LogIn,
  logout: LogOut,
  register: User,
  tambah_anggota: User,
  edit_anggota: User,
  hapus_anggota: User,
  setor_saldo: Wallet,
  tarik_saldo: Wallet,
  ajukan_pinjaman: HandCoins,
  setujui_pinjaman: HandCoins,
  tolak_pinjaman: HandCoins,
  bayar_pinjaman: HandCoins,
  bayar_cash: CalendarDays,
  buat_arisan: Trophy,
  buat_pengumuman: Megaphone,
  edit_pengumuman: Megaphone,
  hapus_pengumuman: Megaphone,
  ganti_password: Settings,
  edit_profil: Settings,
};

const getActivityIcon = (activity: string) => {
  const Icon = activityIcons[activity] || History;
  return <Icon size={16} />;
};

const getActivityColor = (activity: string) => {
  if (activity.includes('login') || activity.includes('logout')) return 'text-blue-600 bg-blue-100';
  if (activity.includes('tambah') || activity.includes('setor')) return 'text-green-600 bg-green-100';
  if (activity.includes('hapus') || activity.includes('tarik')) return 'text-red-600 bg-red-100';
  if (activity.includes('pinjaman')) return 'text-orange-600 bg-orange-100';
  if (activity.includes('arisan')) return 'text-purple-600 bg-purple-100';
  if (activity.includes('pengumuman')) return 'text-cyan-600 bg-cyan-100';
  return 'text-gray-600 bg-gray-100';
};

export default function ActivityLog({ limitCount = 10, showFilter = true }) {
  const { user, userData } = useAuth();
  const [logs, setLogs] = useState<ActivityLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let q;
      if (userData?.role === 'pengelola') {
        q = query(
          collection(db, 'activity_logs'),
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );
      } else {
        q = query(
          collection(db, 'activity_logs'),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );
      }
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as ActivityLogType[];
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

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.activity !== filter) return false;
    if (search && !log.deskripsi.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activityOptions = [...new Set(logs.map(l => l.activity))];

  return (
    <div className="space-y-4">
      {showFilter && (
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semua
            </button>
            {activityOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  filter === opt ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari aktivitas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <History size={40} className="mx-auto mb-2 opacity-50" />
          <p>Belum ada riwayat aktivitas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:shadow-md transition-all">
              <div className={`p-2 rounded-full ${getActivityColor(log.activity)}`}>
                {getActivityIcon(log.activity)}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{log.deskripsi}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Oleh: {log.userNama} ({log.userRole === 'pengelola' ? 'Pengelola' : 'Anggota'})
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {log.timestamp.toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}