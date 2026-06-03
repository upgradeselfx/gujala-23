// app/dashboard/laporan/page.tsx
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
  Users,
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

export default function LaporanPage() {
  const { user, userData } = useAuth();
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [selectedAnggota, setSelectedAnggota] = useState<string>('all');
  const [laporanSimpanan, setLaporanSimpanan] = useState<LaporanSimpanan[]>([]);
  const [laporanPinjaman, setLaporanPinjaman] = useState<LaporanPinjaman[]>([]);
  const [laporanCash, setLaporanCash] = useState<LaporanCash[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'simpanan' | 'pinjaman' | 'cash' | 'arisan'>('simpanan');
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());

  const isPengelola = userData?.role === 'pengelola';

  // Ambil daftar anggota
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

  // Ambil laporan simpanan
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
        // Ambil saldo akhir
        const saldoRef = doc(db, 'saldo', target.uid);
        const saldoSnap = await getDoc(saldoRef);
        const saldoAkhir = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;

        // Ambil transaksi simpanan
        const transaksiQuery = query(
          collection(db, 'transaksi_simpanan'),
          where('userId', '==', target.uid)
        );
        const transaksiSnap = await getDocs(transaksiQuery);
        
        let totalSetor = 0;
        let totalTarik = 0;
        transaksiSnap.forEach(doc => {
          const data = doc.data();
          if (data.jenis === 'setor') {
            totalSetor += data.jumlah;
          } else if (data.jenis === 'tarik') {
            totalTarik += data.jumlah;
          }
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

  // Ambil laporan pinjaman
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

  // Ambil laporan cash bulanan
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
      setLoading(false);
    };
    if (anggota.length > 0 || !isPengelola) {
      loadData();
    }
  }, [activeTab, selectedAnggota, selectedBulan, selectedTahun, anggota]);

  const getNamaBulan = (bulan: number) => {
    const bulanList = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return bulanList[bulan - 1];
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
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
        status: item.status,
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
    }

    // Konversi ke CSV
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

  if (!user) return null;

  const ringkasanSimpanan = {
    totalSetor: laporanSimpanan.reduce((sum, i) => sum + i.totalSetor, 0),
    totalTarik: laporanSimpanan.reduce((sum, i) => sum + i.totalTarik, 0),
    totalSaldo: laporanSimpanan.reduce((sum, i) => sum + i.saldoAkhir, 0),
  };

  const ringkasanPinjaman = {
    totalPinjaman: laporanPinjaman.reduce((sum, i) => sum + i.jumlah, 0),
    totalSisa: laporanPinjaman.reduce((sum, i) => sum + i.sisa, 0),
    aktif: laporanPinjaman.filter(i => i.status === 'aktif').length,
    lunas: laporanPinjaman.filter(i => i.status === 'lunas').length,
  };

  const ringkasanCash = {
    totalSudahBayar: laporanCash.filter(i => i.statusBayar === 'lunas').length,
    totalBelumBayar: laporanCash.filter(i => i.statusBayar === 'belum').length,
    totalTerkumpul: laporanCash
      .filter(i => i.statusBayar === 'lunas')
      .reduce((sum, i) => sum + i.jumlah, 0),
  };

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Lihat rekap data simpanan, pinjaman, dan cash bulanan
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Printer size={16} />
            Cetak
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('simpanan')}
          className={`px-4 py-2 flex items-center gap-2 ${
            activeTab === 'simpanan'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wallet size={16} />
          Simpanan
        </button>
        <button
          onClick={() => setActiveTab('pinjaman')}
          className={`px-4 py-2 flex items-center gap-2 ${
            activeTab === 'pinjaman'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <HandCoins size={16} />
          Pinjaman
        </button>
        <button
          onClick={() => setActiveTab('cash')}
          className={`px-4 py-2 flex items-center gap-2 ${
            activeTab === 'cash'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarDays size={16} />
          Cash Bulanan
        </button>
        <button
          onClick={() => setActiveTab('arisan')}
          className={`px-4 py-2 flex items-center gap-2 ${
            activeTab === 'arisan'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Trophy size={16} />
          Arisan
        </button>
      </div>

      {/* Filter untuk Pengelola */}
      {isPengelola && activeTab !== 'arisan' && (
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Filter Anggota</label>
            <select
              value={selectedAnggota}
              onChange={(e) => setSelectedAnggota(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700"
            >
              <option value="all">Semua Anggota</option>
              {anggota.map(a => (
                <option key={a.uid} value={a.uid}>{a.nama}</option>
              ))}
            </select>
          </div>
          {activeTab === 'cash' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Bulan</label>
                <select
                  value={selectedBulan}
                  onChange={(e) => setSelectedBulan(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(b => (
                    <option key={b} value={b}>{getNamaBulan(b)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Tahun</label>
                <select
                  value={selectedTahun}
                  onChange={(e) => setSelectedTahun(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700"
                >
                  {[2024, 2025, 2026, 2027, 2028].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* LAPORAN SIMPANAN */}
          {activeTab === 'simpanan' && (
            <div>
              {/* Ringkasan */}
              {isPengelola && selectedAnggota === 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Total Setor</p>
                    <p className="text-2xl font-bold text-green-600">
                      Rp {ringkasanSimpanan.totalSetor.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Total Tarik</p>
                    <p className="text-2xl font-bold text-orange-600">
                      Rp {ringkasanSimpanan.totalTarik.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Total Saldo</p>
                    <p className="text-2xl font-bold text-blue-600">
                      Rp {ringkasanSimpanan.totalSaldo.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              )}

              {/* Tabel */}
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
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            Belum ada data simpanan
                          </td>
                        </tr>
                      ) : (
                        laporanSimpanan.map((item, idx) => (
                          <tr key={item.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.userNama}</td>
                            <td className="px-6 py-4 text-sm text-right text-green-600">
                              Rp {item.totalSetor.toLocaleString('id-ID')}
                            </td>
                            <td className="px-6 py-4 text-sm text-right text-orange-600">
                              Rp {item.totalTarik.toLocaleString('id-ID')}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-medium">
                              Rp {item.saldoAkhir.toLocaleString('id-ID')}
                            </td>
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
              {/* Ringkasan */}
              {isPengelola && selectedAnggota === 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Total Pinjaman</p>
                    <p className="text-2xl font-bold text-purple-600">
                      Rp {ringkasanPinjaman.totalPinjaman.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Total Sisa</p>
                    <p className="text-2xl font-bold text-orange-600">
                      Rp {ringkasanPinjaman.totalSisa.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Pinjaman Aktif</p>
                    <p className="text-2xl font-bold text-blue-600">{ringkasanPinjaman.aktif}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Pinjaman Lunas</p>
                    <p className="text-2xl font-bold text-green-600">{ringkasanPinjaman.lunas}</p>
                  </div>
                </div>
              )}

              {/* Tabel */}
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
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            Belum ada data pinjaman
                          </td>
                        </tr>
                      ) : (
                        laporanPinjaman.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.userNama}</td>
                            <td className="px-6 py-4 text-sm text-right">Rp {item.jumlah.toLocaleString('id-ID')}</td>
                            <td className="px-6 py-4 text-sm text-right text-orange-600">
                              Rp {item.sisa.toLocaleString('id-ID')}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                item.status === 'aktif' 
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.status === 'lunas'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {item.status === 'aktif' ? 'Aktif' : item.status === 'lunas' ? 'Lunas' : 'Menunggu'}
                              </span>
                            </td>
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
              {/* Ringkasan */}
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
                    <p className="text-2xl font-bold text-blue-600">
                      Rp {ringkasanCash.totalTerkumpul.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              )}

              {/* Tabel */}
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
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            Belum ada data cash bulanan untuk periode ini
                          </td>
                        </tr>
                      ) : (
                        laporanCash.map((item, idx) => (
                          <tr key={item.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.userNama}</td>
                            <td className="px-6 py-4 text-sm text-right">Rp {item.jumlah.toLocaleString('id-ID')}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                item.statusBayar === 'lunas' 
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {item.statusBayar === 'lunas' ? 'Lunas' : 'Belum'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {item.tanggalBayar?.toLocaleDateString('id-ID') || '-'}
                            </td>
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
              <div className="space-y-3">
                {/* Di sini lo bisa panggil data arisan dari fetchSesiArisan */}
                <p className="text-gray-500 text-center py-8">
                  Untuk laporan arisan, silakan buka menu <strong>Arisan</strong> langsung.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}