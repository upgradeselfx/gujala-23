'use client';

import { useAuth } from '@/context/AuthContext';
import ActivityLog from '@/components/ActivityLog';
import { History } from 'lucide-react';

export default function LogAktivitasPage() {
  const { userData } = useAuth();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-xl">
          <History size={24} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Riwayat Aktivitas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Catatan semua aktivitas yang dilakukan oleh {userData?.role === 'pengelola' ? 'semua anggota' : 'Anda'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <ActivityLog limitCount={50} showFilter={true} />
      </div>
    </div>
  );
}