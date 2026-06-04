'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import {
  FileText,
  Wallet,
  HandCoins,
  CalendarDays,
  Trophy,
  Download,
  Printer,
} from 'lucide-react';

type Anggota = {
  uid: string;
  nama: string;
  email: string;
  noTel: string;
};

type LaporanSimpanan = {
  userId: string;
  userNama: string;
  totalSetor: number;
  totalTarik: number;
  saldoAkhir: number;
};

type LaporanPinjaman = {
  id: string;
  userId: string;
  userNama: string;
  jumlah: number;
  sisa: number;
  status: string;
  tenor: number;
  angsuranPerBulan: number;
};

type LaporanCash = {
  userId: string;
  userNama: string;
  bulan: number;
  tahun: number;
  jumlah: number;
  statusBayar: string;
  tanggalBayar?: Date;
};

type SesiArisan = {
  id: string;
  periode: string;
  bulan: number;
  tahun: number;
  pemenangNama: string;
  jumlahPotongan: number;
  createdAt: Date;
};

export default function LaporanPage() {
  const { user, userData } = useAuth();
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [selectedAnggota, setSelectedAnggota] = useState<string>('all');
  const [laporanSimpanan, setLaporanSimpanan] = useState<LaporanSimpanan[]>([]);
  const [laporanPinjaman, setLaporanPinjaman] = useState<LaporanPinjaman[]>([]);
  const [laporanCash, setLaporanCash] = useState<LaporanCash[]>([]);
  const [sesiArisan, setSesiArisan] = useState<SesiArisan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'simpanan' | 'pinjaman' | 'cash' | 'arisan'>('simpanan');
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());

  const isPengelola = userData?.role === 'pengelola';

  const fetchAnggota = async () => {
    if (!isPengelola) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        nama: doc.data().nama,
        email: doc.data().email,
        noTel: doc.data().noTel || '',
      }));
      setAnggota(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data anggota');
    }
  };

  const fetchLaporanSimpanan = async () => {
    try {
      let targetUsers: { uid: string; nama: string }[] = [];
      if (isPengelola && selectedAnggota !== 'all') {
        const anggotaTarget = anggota.find(a => a.uid === selectedAnggota);
        if (anggotaTarget) {
          targetUsers = [{ uid: anggotaTarget.uid, nama: anggotaTarget.nama }];
        }
      } else if (isPengelola && selectedAnggota === 'all') {
        targetUsers = anggota.map(a => ({ uid: a.uid, nama: a.nama }));
      } else {
        targetUsers = [{ uid: user!.uid, nama: userData?.nama || '' }];
      }

      const laporan: LaporanSimpanan[] = [];
      
      for (const target of targetUsers) {
        const saldoRef = doc(db, 'saldo', target.uid);
        const saldoSnap = await getDoc(saldoRef);
        const saldoAkhir = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;

        const transaksiQuery = query(
          collection(db, 'transaksi_simpanan'),
          where('userId', '==', target.uid)
        );
        const transaksiSnap = await getDocs(transaksiQuery);
        
        let totalSetor = 0;
        let totalTarik = 0;
        transaksiSnap.forEach(doc => {
          const data = doc.data();
          if (data.jenis === 'setor') totalSetor += data.jumlah;
          if (data.jenis === 'tarik') totalTarik += data.jumlah;
        });

        laporan.push({
          userId: target.uid,
          userNama: target.nama,
          totalSetor,
          totalTarik,
          saldoAkhir,
        });
      }
      
      setLaporanSimpanan(laporan);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat laporan simpanan');
    }
  };

  const fetchLaporanPinjaman = async () => {
    try {
      let pinjamanQuery;
      if (isPengelola && selectedAnggota !== 'all') {
        pinjamanQuery = query(
          collection(db, 'pinjaman'),
          where('userId', '==', selectedAnggota),
          orderBy('diajukanPada', 'desc')
        );
      } else if (isPengelola && selectedAnggota === 'all') {
        pinjamanQuery = query(
          collection(db, 'pinjaman'),
          orderBy('diajukanPada', 'desc')
        );
      } else {
        pinjamanQuery = query(
          collection(db, 'pinjaman'),
          where('userId', '==', user!.uid),
          orderBy('diajukanPada', 'desc')
        );
      }

      const pinjamanSnap = await getDocs(pinjamanQuery);
      const laporan: LaporanPinjaman[] = [];
      
      for (const docSnap of pinjamanSnap.docs) {
        const data = docSnap.data();
        let userNama = data.userNama || '';
        if (isPengelola && !userNama && selectedAnggota !== 'all') {
          const userDoc = await getDoc(doc(db, 'users', data.userId));
          userNama = userDoc.exists() ? userDoc.data().nama : data.userId;
        }
        
        laporan.push({
          id: docSnap.id,
          userId: data.userId,
          userNama: userNama,
          jumlah: data.jumlah,
          sisa: data.sisa,
          status: data.status,
          tenor: data.tenor,
          angsuranPerBulan: data.angsuranPerBulan,
        });
      }
      
      setLaporanPinjaman(laporan);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat laporan pinjaman');
    }
  };

  const fetchLaporanCash = async () => {
    try {
      let cashQuery;
      if (isPengelola && selectedAnggota !== 'all') {
        cashQuery = query(
          collection(db, 'cash_bulanan'),
          where('userId', '==', selectedAnggota),
          where('bulan', '==', selectedBulan),
          where('tahun', '==', selectedTahun)
        );
      } else if (isPengelola && selectedAnggota === 'all') {
        cashQuery = query(
          collection(db, 'cash_bulanan'),
          where('bulan', '==', selectedBulan),
          where('tahun', '==', selectedTahun)
        );
      } else {
        cashQuery = query(
          collection(db, 'cash_bulanan'),
          where('userId', '==', user!.uid),
          where('bulan', '==', selectedBulan),
          where('tahun', '==', selectedTahun)
        );
      }

      const cashSnap = await getDocs(cashQuery);
      const laporan: LaporanCash[] = [];
      
      for (const docSnap of cashSnap.docs) {
        const data = docSnap.data();
        laporan.push({
          userId: data.userId,
          userNama: data.userNama,
          bulan: data.bulan,
          tahun: data.tahun,
          jumlah: data.jumlah,
          statusBayar: data.statusBayar,
          tanggalBayar: data.tanggalBayar?.toDate(),
        });
      }
      
      setLaporanCash(laporan);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat laporan cash');
    }
  };

  const fetchLaporanArisan = async () => {
    try {
      const arisanQuery = query(
        collection(db, 'arisan_sesi'),
        orderBy('tahun', 'desc'),
        orderBy('bulan', 'desc')
      );
      const arisanSnapshot = await getDocs(arisanQuery);
      const data = arisanSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as SesiArisan[];
      setSesiArisan(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat laporan arisan');
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnggota();
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (activeTab === 'simpanan') await fetchLaporanSimpanan();
      if (activeTab === 'pinjaman') await fetchLaporanPinjaman();
      if (activeTab === 'cash') await fetchLaporanCash();
      if (activeTab === 'arisan') await fetchLaporanArisan();
      setLoading(false);
    };
    if (anggota.length > 0 || !isPengelola) {
      loadData();
    }
  }, [activeTab, selectedAnggota, selectedBulan, selectedTahun, anggota]);

  const getNamaBulan = (bulan: number) => {
    const bulanList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return bulanList[bulan - 1];
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let data: any[] = [];
    let headers: string[] = [];
    
    if (activeTab === 'simpanan') {
      headers = ['No', 'Nama', 'Total Setor', 'Total Tarik', 'Saldo Akhir'];
      data = laporanSimpanan.map((item, idx) => ({
        no: idx + 1,
        nama: item.userNama,
        totalSetor: item.totalSetor,
        totalTarik: item.totalTarik,
        saldoAkhir: item.saldoAkhir,
      }));
    } else if (activeTab === 'pinjaman') {
      headers = ['No', 'Nama', 'Jumlah Pinjaman', 'Sisa', 'Status', 'Angsuran/Bulan'];
      data = laporanPinjaman.map((item, idx) => ({
        no: idx + 1,
        nama: item.userNama,
        jumlah: item.jumlah,
        sisa: item.sisa,
        status: item.status === 'aktif' ? 'Aktif' : item.status === 'lunas' ? 'Lunas' : item.status === 'ditolak' ? 'Ditolak' : 'Menunggu',
        angsuran: item.angsuranPerBulan,
      }));
    } else if (activeTab === 'cash') {
      headers = ['No', 'Nama', 'Jumlah', 'Status', 'Tanggal Bayar'];
      data = laporanCash.map((item, idx) => ({
        no: idx + 1,
        nama: item.userNama,
        jumlah: item.jumlah,
        status: item.statusBayar === 'lunas' ? 'Lunas' : 'Belum',
        tanggalBayar: item.tanggalBayar?.toLocaleDateString('id-ID') || '-',
      }));
    } else if (activeTab === 'arisan') {
      headers = ['No', 'Periode', 'Pemenang', 'Potongan', 'Tanggal'];
      data = sesiArisan.map((item, idx) => ({
        no: idx + 1,
        periode: item.periode,
        pemenang: item.pemenangNama,
        potongan: item.jumlahPotongan,
        tanggal: item.createdAt.toLocaleDateString('id-ID'),
      }));
    }

    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(header => {
        let val = row[header.toLowerCase().replace(/ /g, '')];
        if (typeof val === 'number') val = val.toString().replace('.', ',');
        if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
        return val;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Laporan berhasil diexport');
  };

  const ringkasanSimpanan = {
    totalSetor: laporanSimpanan.reduce((sum, i) => sum + i.totalSetor, 0),
    totalTarik: laporanSimpanan.reduce((sum, i) => sum + i.totalTarik, 0),
    totalSaldo: laporanSimpanan.reduce((sum, i) => sum + i.saldoAkhir, 0),
  };

  const ringkasanPinjaman = {
    totalPinjaman: laporanPinjaman.filter(p => p.status === 'aktif' || p.status === 'lunas').reduce((sum, i) => sum + i.jumlah, 0),
    totalSisa: laporanPinjaman.filter(p => p.status === 'aktif').reduce((sum, i) => sum + i.sisa, 0),
    aktif: laporanPinjaman.filter(i => i.status === 'aktif').length,
    lunas: laporanPinjaman.filter(i => i.status === 'lunas').length,
    ditolak: laporanPinjaman.filter(i => i.status === 'ditolak').length,
  };

  const ringkasanCash = {
    totalSudahBayar: laporanCash.filter(i => i.statusBayar === 'lunas').length,
    totalBelumBayar: laporanCash.filter(i => i.statusBayar === 'belum').length,
    totalTerkumpul: laporanCash.filter(i => i.statusBayar === 'lunas').reduce((sum, i) => sum + i.jumlah, 0),
  };

  if (!user) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aktif':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Aktif</span>;
      case 'lunas':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Lunas</span>;
      case 'ditolak':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Ditolak</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Menunggu</span>;
    }
  };

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Lihat rekap data simpanan, pinjaman, cash bulanan, dan arisan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
            <Printer size={16} /> Cetak / PDF
          </button>
          <button onClick={handleExportCSV} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        <button onClick={() => setActiveTab('simpanan')} className={`px-4 py-2 flex items-center gap-2 ${activeTab === 'simpanan' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Wallet size={16} /> Simpanan
        </button>
        <button onClick={() => setActiveTab('pinjaman')} className={`px-4 py-2 flex items-center gap-2 ${activeTab === 'pinjaman' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <HandCoins size={16} /> Pinjaman
        </button>
        <button onClick={() => setActiveTab('cash')} className={`px-4 py-2 flex items-center gap-2 ${activeTab === 'cash' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <CalendarDays size={16} /> Cash Bulanan
        </button>
        <button onClick={() => setActiveTab('arisan')} className={`px-4 py-2 flex items-center gap-2 ${activeTab === 'arisan' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Trophy size={16} /> Arisan
        </button>
      </div>

      {isPengelola && activeTab !== 'arisan' && (
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Filter Anggota</label>
            <select value={selectedAnggota} onChange={(e) => setSelectedAnggota(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700">
              <option value="all">Semua Anggota</option>
              {anggota.map(a => <option key={a.uid} value={a.uid}>{a.nama}</option>)}
            </select>
          </div>
          {activeTab === 'cash' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Bulan</label>
                <select value={selectedBulan} onChange={(e) => setSelectedBulan(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(b => <option key={b} value={b}>{getNamaBulan(b)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Tahun</label>
                <select value={selectedTahun} onChange={(e) => setSelectedTahun(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700">
                  {[2024, 2025, 2026, 2027, 2028].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      <div id="laporan-content">
        {/* LAPORAN SIMPANAN */}
        {activeTab === 'simpanan' && (
          <div>
            {isPengelola && selectedAnggota === 'all' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Total Setor</p>
                  <p className="text-2xl font-bold text-green-600">Rp {ringkasanSimpanan.totalSetor.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Total Tarik</p>
                  <p className="text-2xl font-bold text-orange-600">Rp {ringkasanSimpanan.totalTarik.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Total Saldo</p>
                  <p className="text-2xl font-bold text-blue-600">Rp {ringkasanSimpanan.totalSaldo.toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Setor</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Tarik</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {laporanSimpanan.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada data simpanan</td>
                      </tr>
                    ) : (
                      laporanSimpanan.map((item, idx) => (
                        <tr key={item.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.userNama}</td>
                          <td className="px-6 py-4 text-sm text-right text-green-600">Rp {item.totalSetor.toLocaleString('id-ID')}</td>
                          <td className="px-6 py-4 text-sm text-right text-orange-600">Rp {item.totalTarik.toLocaleString('id-ID')}</td>
                          <td className="px-6 py-4 text-sm text-right font-medium">Rp {item.saldoAkhir.toLocaleString('id-ID')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* LAPORAN PINJAMAN */}
        {activeTab === 'pinjaman' && (
          <div>
            {isPengelola && selectedAnggota === 'all' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Total Pinjaman Disetujui</p>
                  <p className="text-2xl font-bold text-purple-600">Rp {ringkasanPinjaman.totalPinjaman.toLocaleString('id-ID')}</p>
                  <p className="text-xs text-gray-400">(aktif + lunas)</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Total Sisa Tagihan</p>
                  <p className="text-2xl font-bold text-orange-600">Rp {ringkasanPinjaman.totalSisa.toLocaleString('id-ID')}</p>
                  <p className="text-xs text-gray-400">(hanya pinjaman aktif)</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Pinjaman Aktif</p>
                  <p className="text-2xl font-bold text-blue-600">{ringkasanPinjaman.aktif}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Pinjaman Ditolak</p>
                  <p className="text-2xl font-bold text-red-600">{ringkasanPinjaman.ditolak}</p>
                </div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peminjam</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sisa</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Angsuran/Bulan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {laporanPinjaman.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Belum ada data pinjaman</td>
                      </tr>
                    ) : (
                      laporanPinjaman.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.userNama}</td>
                          <td className="px-6 py-4 text-sm text-right">Rp {item.jumlah.toLocaleString('id-ID')}</td>
                          <td className="px-6 py-4 text-sm text-right text-orange-600">
                            {item.status === 'ditolak' ? 'Rp 0' : `Rp ${item.sisa.toLocaleString('id-ID')}`}
                          </td>
                          <td className="px-6 py-4 text-center">{getStatusBadge(item.status)}</td>
                          <td className="px-6 py-4 text-sm text-right">Rp {item.angsuranPerBulan.toLocaleString('id-ID')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* LAPORAN CASH BULANAN */}
        {activeTab === 'cash' && (
          <div>
            {isPengelola && selectedAnggota === 'all' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Sudah Bayar</p>
                  <p className="text-2xl font-bold text-green-600">{ringkasanCash.totalSudahBayar} orang</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Belum Bayar</p>
                  <p className="text-2xl font-bold text-orange-600">{ringkasanCash.totalBelumBayar} orang</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <p className="text-sm text-gray-500">Terkumpul</p>
                  <p className="text-2xl font-bold text-blue-600">Rp {ringkasanCash.totalTerkumpul.toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {laporanCash.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada data cash bulanan untuk periode ini</td>
                      </tr>
                    ) : (
                      laporanCash.map((item, idx) => (
                        <tr key={item.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.userNama}</td>
                          <td className="px-6 py-4 text-sm text-right">Rp {item.jumlah.toLocaleString('id-ID')}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${item.statusBayar === 'lunas' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {item.statusBayar === 'lunas' ? 'Lunas' : 'Belum'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{item.tanggalBayar?.toLocaleDateString('id-ID') || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* LAPORAN ARISAN */}
        {activeTab === 'arisan' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={20} className="text-yellow-500" />
              <h2 className="text-lg font-semibold">Riwayat Arisan</h2>
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : sesiArisan.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Belum ada sesi arisan</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pemenang</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Potongan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sesiArisan.map((sesi, idx) => (
                      <tr key={sesi.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{sesi.periode}</td>
                        <td className="px-4 py-3 text-sm text-purple-600 font-medium">{sesi.pemenangNama}</td>
                        <td className="px-4 py-3 text-sm text-right">Rp {sesi.jumlahPotongan?.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{sesi.createdAt?.toLocaleDateString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}