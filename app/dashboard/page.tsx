// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { LayoutDashboard, Users, Wallet, HandCoins } from 'lucide-react';

type SummaryData = {
  totalAnggota: number;
  totalSimpanan: number;
  totalPinjamanAktif: number;
  simpananSaya?: number;
  pinjamanSaya?: number;
};

export default function DashboardPage() {
  const { user, userData } = useAuth();
  const [summary, setSummary] = useState<SummaryData>({
    totalAnggota: 0,
    totalSimpanan: 0,
    totalPinjamanAktif: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Ambil semua anggota
        const anggotaSnapshot = await getDocs(collection(db, 'users'));
        const totalAnggota = anggotaSnapshot.size;

        // Ambil semua transaksi simpanan
        const simpananSnapshot = await getDocs(collection(db, 'simpanan'));
        let totalSimpanan = 0;
        let simpananSaya = 0;

        simpananSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.jenis === 'setor') {
            totalSimpanan += data.jumlah;
            if (data.userId === user.uid) {
              simpananSaya += data.jumlah;
            }
          } else if (data.jenis === 'tarik' && data.status === 'sukses') {
            totalSimpanan -= data.jumlah;
            if (data.userId === user.uid) {
              simpananSaya -= data.jumlah;
            }
          }
        });

        // Ambil semua pinjaman aktif
        const pinjamanQuery = query(collection(db, 'pinjaman'), where('status', '==', 'aktif'));
        const pinjamanSnapshot = await getDocs(pinjamanQuery);
        let totalPinjamanAktif = 0;
        let pinjamanSaya = 0;

        pinjamanSnapshot.forEach((doc) => {
          const data = doc.data();
          totalPinjamanAktif += data.sisa || data.jumlah;
          if (data.userId === user.uid) {
            pinjamanSaya += data.sisa || data.jumlah;
          }
        });

        setSummary({
          totalAnggota,
          totalSimpanan,
          totalPinjamanAktif,
          simpananSaya,
          pinjamanSaya,
        });
      } catch (error) {
        console.error('Error fetching summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isPengelola = userData?.role === 'pengelola';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Selamat datang kembali, {userData?.nama}
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card Total Anggota (hanya pengelola) */}
        {isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Anggota</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.totalAnggota}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                <Users className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
            </div>
          </div>
        )}

        {/* Card Total Simpanan (pengelola) / Simpanan Saya (anggota) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isPengelola ? 'Total Simpanan' : 'Saldo Saya'}
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                Rp {(isPengelola ? summary.totalSimpanan : summary.simpananSaya || 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <Wallet className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>

        {/* Card Total Pinjaman Aktif (pengelola) / Pinjaman Saya (anggota) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isPengelola ? 'Total Pinjaman Aktif' : 'Sisa Pinjaman Saya'}
              </p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                Rp {(isPengelola ? summary.totalPinjamanAktif : summary.pinjamanSaya || 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full">
              <HandCoins className="text-orange-600 dark:text-orange-400" size={24} />
            </div>
          </div>
        </div>

        {/* Card Kosong untuk pengelola (atau tambahan lain) */}
        {!isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                  Anggota Aktif
                </p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                <LayoutDashboard className="text-purple-600 dark:text-purple-400" size={24} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pesan jika belum ada data (opsional) */}
      {isPengelola && summary.totalAnggota === 0 && (
        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            📌 Belum ada data. Silakan tambahkan anggota terlebih dahulu di menu Kelola Anggota.
          </p>
        </div>
      )}
    </div>
  );
}