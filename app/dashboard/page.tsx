'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { LayoutDashboard, Users, Wallet, HandCoins } from 'lucide-react';

export default function DashboardPage() {
  const { user, userData } = useAuth();
  const [summary, setSummary] = useState({
    totalAnggota: 0,
    totalSimpanan: 0,
    totalPinjamanAktif: 0,
    simpananSaya: 0,
    pinjamanSaya: 0,
  });
  const [loading, setLoading] = useState(true);
  const isPengelola = userData?.role === 'pengelola';

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Saldo saya
        let saldoSaya = 0;
        const saldoRef = doc(db, 'saldo', user.uid);
        const saldoSnap = await getDoc(saldoRef);
        if (saldoSnap.exists()) {
          saldoSaya = saldoSnap.data().jumlah || 0;
        } else {
          const transaksiQuery = query(collection(db, 'transaksi_simpanan'), where('userId', '==', user.uid));
          const transaksiSnap = await getDocs(transaksiQuery);
          let setor = 0, tarik = 0;
          transaksiSnap.forEach(doc => {
            const data = doc.data();
            if (data.jenis === 'setor') setor += data.jumlah;
            if (data.jenis === 'tarik') tarik += data.jumlah;
          });
          saldoSaya = setor - tarik;
        }

        // Sisa pinjaman saya
        let pinjamanSaya = 0;
        const pinjamanQuery = query(collection(db, 'pinjaman'), where('userId', '==', user.uid), where('status', 'in', ['aktif', 'pending']));
        const pinjamanSnap = await getDocs(pinjamanQuery);
        pinjamanSnap.forEach(doc => { pinjamanSaya += doc.data().sisa || doc.data().jumlah || 0; });

        let totalAnggota = 0, totalSimpanan = 0, totalPinjamanAktif = 0;
        if (isPengelola) {
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
          
          const pinjamanAktifQuery = query(collection(db, 'pinjaman'), where('status', '==', 'aktif'));
          const pinjamanAktifSnap = await getDocs(pinjamanAktifQuery);
          pinjamanAktifSnap.forEach(doc => { totalPinjamanAktif += doc.data().sisa || doc.data().jumlah || 0; });
        }
        setSummary({ totalAnggota, totalSimpanan, totalPinjamanAktif, simpananSaya: saldoSaya, pinjamanSaya });
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, [user, isPengelola]);

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-6">Selamat datang kembali, {userData?.nama || 'User'}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
            <div className="flex justify-between"><p className="text-gray-500">Total Anggota</p><Users className="text-blue-500" /></div>
            <p className="text-2xl font-bold mt-2">{summary.totalAnggota}</p>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between"><p className="text-gray-500">{isPengelola ? 'Total Simpanan' : 'Saldo Saya'}</p><Wallet className="text-green-500" /></div>
          <p className="text-2xl font-bold text-green-600 mt-2">Rp {(isPengelola ? summary.totalSimpanan : summary.simpananSaya).toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between"><p className="text-gray-500">{isPengelola ? 'Total Pinjaman Aktif' : 'Sisa Pinjaman Saya'}</p><HandCoins className="text-orange-500" /></div>
          <p className="text-2xl font-bold text-orange-600 mt-2">Rp {(isPengelola ? summary.totalPinjamanAktif : summary.pinjamanSaya).toLocaleString('id-ID')}</p>
        </div>
        {!isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
            <div className="flex justify-between"><p className="text-gray-500">Status</p><LayoutDashboard className="text-purple-500" /></div>
            <p className="text-lg font-medium mt-2">Anggota Aktif</p>
          </div>
        )}
      </div>
    </div>
  );
}