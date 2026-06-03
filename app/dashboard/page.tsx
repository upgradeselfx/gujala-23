// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
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
    simpananSaya: 0,
    pinjamanSaya: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // 1. Ambil saldo dari collection 'saldo'
        let saldoSaya = 0;
        const saldoRef = doc(db, 'saldo', user.uid);
        const saldoSnap = await getDoc(saldoRef);
        if (saldoSnap.exists()) {
          saldoSaya = saldoSnap.data().jumlah || 0;
        } else {
          // Coba hitung dari transaksi simpanan (fallback)
          const transaksiQuery = query(
            collection(db, 'transaksi_simpanan'),
            where('userId', '==', user.uid)
          );
          const transaksiSnap = await getDocs(transaksiQuery);
          let setor = 0, tarik = 0;
          transaksiSnap.forEach(doc => {
            const data = doc.data();
            if (data.jenis === 'setor') setor += data.jumlah;
            if (data.jenis === 'tarik') tarik += data.jumlah;
          });
          saldoSaya = setor - tarik;
        }

        // 2. Ambil sisa pinjaman
        let pinjamanSaya = 0;
        const pinjamanQuery = query(
          collection(db, 'pinjaman'),
          where('userId', '==', user.uid),
          where('status', 'in', ['aktif', 'pending'])
        );
        const pinjamanSnap = await getDocs(pinjamanQuery);
        pinjamanSnap.forEach(doc => {
          const data = doc.data();
          pinjamanSaya += data.sisa || data.jumlah || 0;
        });

        // 3. Total anggota & total simpanan (hanya pengelola)
        let totalAnggota = 0;
        let totalSimpanan = 0;

        if (userData?.role === 'pengelola') {
          const anggotaSnap = await getDocs(collection(db, 'users'));
          totalAnggota = anggotaSnap.size;

          const simpananSnap = await getDocs(collection(db, 'transaksi_simpanan'));
          let totalSetor = 0, totalTarik = 0;
          simpananSnap.forEach(doc => {
            const data = doc.data();
            if (data.jenis === 'setor') totalSetor += data.jumlah;
            if (data.jenis === 'tarik') totalTarik += data.jumlah;
          });
          totalSimpanan = totalSetor - totalTarik;
        }

        setSummary({
          totalAnggota,
          totalSimpanan,
          totalPinjamanAktif: 0,
          simpananSaya: saldoSaya,
          pinjamanSaya: pinjamanSaya,
        });
      } catch (error) {
        console.error(error);
        // Tetap tampilkan 0, jangan error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, userData]);

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Selamat datang kembali, {userData?.nama || 'User'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Anggota</p>
                <p className="text-2xl font-bold mt-1">{summary.totalAnggota}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {isPengelola ? 'Total Simpanan' : 'Saldo Saya'}
              </p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                Rp {(isPengelola ? summary.totalSimpanan : summary.simpananSaya || 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Wallet className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {isPengelola ? 'Total Pinjaman Aktif' : 'Sisa Pinjaman Saya'}
              </p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                Rp {(isPengelola ? summary.totalPinjamanAktif : summary.pinjamanSaya || 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <HandCoins className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        {!isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-lg font-medium mt-1">Anggota Aktif</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <LayoutDashboard className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}