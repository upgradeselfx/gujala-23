'use client';

import { useAuth } from '@/context/AuthContext';
import { Calendar, Printer, Users, Wallet, HandCoins, Trophy } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/firebase/client';
import { useEffect, useState } from 'react';

export default function LaporanTahunanPage() {
  const { userData } = useAuth();
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [totalAnggota, setTotalAnggota] = useState(0);
  const [totalSimpanan, setTotalSimpanan] = useState(0);
  const [totalPinjaman, setTotalPinjaman] = useState(0);
  const isPengelola = userData?.role === 'pengelola';

  useEffect(() => {
    if (isPengelola) {
      fetchData();
    }
  }, [tahun]);

  const fetchData = async () => {
    const anggota = await getDocs(collection(db, 'users'));
    setTotalAnggota(anggota.size);

    const simpanan = await getDocs(collection(db, 'transaksi_simpanan'));
    let setor = 0, tarik = 0;
    simpanan.forEach(doc => {
      const data = doc.data();
      if (data.jenis === 'setor') setor += data.jumlah;
      if (data.jenis === 'tarik') tarik += data.jumlah;
    });
    setTotalSimpanan(setor - tarik);

    const pinjaman = await getDocs(collection(db, 'pinjaman'));
    let total = 0;
    pinjaman.forEach(doc => {
      const data = doc.data();
      if (data.status === 'aktif' || data.status === 'lunas') total += data.jumlah;
    });
    setTotalPinjaman(total);
  };

  if (!isPengelola) return <div className="p-6 text-red-500">⚠️ Akses ditolak. Hanya pengelola.</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold">Laporan Tahunan</h1><p className="text-gray-500">Rekapitulasi keuangan tahunan</p></div>
        <button onClick={() => window.print()} className="px-3 py-2 border rounded-lg flex items-center gap-2"><Printer size={16} /> Cetak / PDF</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow"><Users size={24} className="text-blue-500 mb-2" /><p className="text-sm text-gray-500">Total Anggota</p><p className="text-2xl font-bold">{totalAnggota}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow"><Wallet size={24} className="text-green-500 mb-2" /><p className="text-sm text-gray-500">Total Simpanan</p><p className="text-2xl font-bold">Rp {totalSimpanan.toLocaleString('id-ID')}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow"><HandCoins size={24} className="text-orange-500 mb-2" /><p className="text-sm text-gray-500">Total Pinjaman</p><p className="text-2xl font-bold">Rp {totalPinjaman.toLocaleString('id-ID')}</p></div>
      </div>
      <div className="text-center text-xs text-gray-400 border-t pt-4">Laporan digenerate otomatis oleh GUJALA 23</div>
    </div>
  );
}