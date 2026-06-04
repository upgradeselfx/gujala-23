'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { LayoutDashboard, Users, Wallet, HandCoins } from 'lucide-react';

export default function DashboardPage() {
  const { user, userData } = useAuth();
  const [saldo, setSaldo] = useState(0);
  const [pinjaman, setPinjaman] = useState(0);
  const [totalAnggota, setTotalAnggota] = useState(0);
  const [loading, setLoading] = useState(true);
  const isPengelola = userData?.role === 'pengelola';

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Saldo
        const saldoRef = doc(db, 'saldo', user.uid);
        const saldoSnap = await getDoc(saldoRef);
        setSaldo(saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0);

        // Pinjaman (contoh sederhana)
        setPinjaman(0);
        
        // Total anggota (hanya pengelola)
        if (isPengelola) {
          setTotalAnggota(1); // sementara, ganti dengan data real nanti
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, isPengelola]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-6">Selamat datang kembali, {userData?.nama || 'User'}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
            <div className="flex justify-between items-center">
              <p className="text-gray-500">Total Anggota</p>
              <Users size={24} className="text-blue-500" />
            </div>
            <p className="text-3xl font-bold mt-2">{totalAnggota}</p>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center">
            <p className="text-gray-500">{isPengelola ? 'Total Simpanan' : 'Saldo Saya'}</p>
            <Wallet size={24} className="text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600 mt-2">Rp {saldo.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center">
            <p className="text-gray-500">{isPengelola ? 'Total Pinjaman Aktif' : 'Sisa Pinjaman Saya'}</p>
            <HandCoins size={24} className="text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-orange-600 mt-2">Rp {pinjaman.toLocaleString('id-ID')}</p>
        </div>
        {!isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
            <div className="flex justify-between items-center">
              <p className="text-gray-500">Status</p>
              <LayoutDashboard size={24} className="text-purple-500" />
            </div>
            <p className="text-xl font-medium mt-2">Anggota Aktif</p>
          </div>
        )}
      </div>
    </div>
  );
}