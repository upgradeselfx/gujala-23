// app/dashboard/laporan-tahunan/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { Calendar, Printer, Users, Wallet, HandCoins, Trophy, TrendingUp, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

type LaporanTahunanData = {
  tahun: number;
  totalAnggota: number;
  totalAnggotaBaru: number;
  simpanan: {
    totalSetor: number;
    totalTarik: number;
    saldoAkhir: number;
    rataRataSaldo: number;
  };
  pinjaman: {
    totalDisetujui: number;
    totalDibayar: number;
    totalSisa: number;
    jumlahPengajuan: number;
    jumlahAktif: number;
    jumlahLunas: number;
    jumlahDitolak: number;
    rataRataPinjaman: number;
  };
  cash: {
    target: number;
    terkumpul: number;
    persentase: number;
    totalBayar: number;
  };
  arisan: {
    totalSesi: number;
    totalTerkumpul: number;
    daftarPemenang: { periode: string; pemenang: string; potongan: number }[];
  };
  rekapBulanan: {
    bulan: string;
    setorSimpanan: number;
    tarikSimpanan: number;
    pinjamanBaru: number;
    cashTerkumpul: number;
  }[];
};

const getDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return null;
};

export default function LaporanTahunanPage() {
  const { userData } = useAuth();
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [laporan, setLaporan] = useState<LaporanTahunanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isPengelola = userData?.role === 'pengelola';

  const fetchLaporan = async () => {
    if (!isPengelola) return;
    setLoading(true);
    try {
      const anggotaSnap = await getDocs(collection(db, 'users'));
      const transaksiSimpananSnap = await getDocs(collection(db, 'transaksi_simpanan'));
      const pinjamanSnap = await getDocs(collection(db, 'pinjaman'));
      const cashSnap = await getDocs(query(collection(db, 'cash_bulanan'), where('tahun', '==', tahun)));
      const arisanSnap = await getDocs(query(collection(db, 'arisan_sesi'), where('tahun', '==', tahun), orderBy('bulan', 'asc')));

      // Hitung data (sama seperti sebelumnya)
      const totalAnggota = anggotaSnap.size;
      let anggotaBaru = 0;
      anggotaSnap.forEach(doc => {
        const createdAt = getDate(doc.data().createdAt);
        if (createdAt && createdAt.getFullYear() === tahun) anggotaBaru++;
      });

      let totalSetor = 0, totalTarik = 0;
      const saldoPerAnggota: { [key: string]: number } = {};
      transaksiSimpananSnap.forEach(doc => {
        const data = doc.data();
        if (data.jenis === 'setor') {
          totalSetor += data.jumlah;
          saldoPerAnggota[data.userId] = (saldoPerAnggota[data.userId] || 0) + data.jumlah;
        } else if (data.jenis === 'tarik' && data.status !== 'gagal') {
          totalTarik += data.jumlah;
          saldoPerAnggota[data.userId] = (saldoPerAnggota[data.userId] || 0) - data.jumlah;
        }
      });
      const saldoAkhir = totalSetor - totalTarik;
      const rataRataSaldo = totalAnggota > 0 ? saldoAkhir / totalAnggota : 0;

      let totalDisetujui = 0, totalDibayar = 0, totalSisa = 0;
      let jumlahPengajuan = 0, jumlahAktif = 0, jumlahLunas = 0, jumlahDitolak = 0;
      pinjamanSnap.forEach(doc => {
        const data = doc.data();
        jumlahPengajuan++;
        if (data.status === 'aktif' || data.status === 'lunas') {
          totalDisetujui += data.jumlah;
          totalSisa += data.sisa || 0;
        }
        if (data.status === 'aktif') jumlahAktif++;
        else if (data.status === 'lunas') {
          jumlahLunas++;
          totalDibayar += data.total - (data.sisa || 0);
        } else if (data.status === 'ditolak') jumlahDitolak++;
      });
      const rataRataPinjaman = totalDisetujui > 0 ? totalDisetujui / (jumlahAktif + jumlahLunas) : 0;

      let totalCashTarget = 0, totalCashTerkumpul = 0, totalCashBayar = 0;
      cashSnap.forEach(doc => {
        const data = doc.data();
        totalCashTarget += data.jumlah;
        if (data.statusBayar === 'lunas') {
          totalCashTerkumpul += data.jumlah;
          totalCashBayar++;
        }
      });
      const persentaseCash = totalCashTarget > 0 ? (totalCashTerkumpul / totalCashTarget) * 100 : 0;

      let totalArisanTerkumpul = 0;
      const daftarPemenang: { periode: string; pemenang: string; potongan: number }[] = [];
      arisanSnap.forEach(doc => {
        const data = doc.data();
        totalArisanTerkumpul += data.jumlahPotongan || 0;
        daftarPemenang.push({
          periode: data.periode,
          pemenang: data.pemenangNama,
          potongan: data.jumlahPotongan || 0,
        });
      });

      const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const rekapBulanan = [];
      for (let i = 0; i < 12; i++) {
        const bulan = i + 1;
        let setorBulan = 0, tarikBulan = 0, pinjamanBaru = 0, cashBulan = 0;
        transaksiSimpananSnap.forEach(doc => {
          const data = doc.data();
          const ts = getDate(data.timestamp);
          if (ts && ts.getFullYear() === tahun && ts.getMonth() + 1 === bulan) {
            if (data.jenis === 'setor') setorBulan += data.jumlah;
            if (data.jenis === 'tarik') tarikBulan += data.jumlah;
          }
        });
        pinjamanSnap.forEach(doc => {
          const data = doc.data();
          const ts = getDate(data.diajukanPada);
          if (ts && ts.getFullYear() === tahun && ts.getMonth() + 1 === bulan) {
            pinjamanBaru += data.jumlah;
          }
        });
        cashSnap.forEach(doc => {
          const data = doc.data();
          if (data.bulan === bulan && data.statusBayar === 'lunas') cashBulan += data.jumlah;
        });
        rekapBulanan.push({
          bulan: bulanNames[i],
          setorSimpanan: setorBulan,
          tarikSimpanan: tarikBulan,
          pinjamanBaru,
          cashTerkumpul: cashBulan,
        });
      }

      setLaporan({
        tahun, totalAnggota, totalAnggotaBaru: anggotaBaru,
        simpanan: { totalSetor, totalTarik, saldoAkhir, rataRataSaldo },
        pinjaman: { totalDisetujui, totalDibayar, totalSisa, jumlahPengajuan, jumlahAktif, jumlahLunas, jumlahDitolak, rataRataPinjaman },
        cash: { target: totalCashTarget, terkumpul: totalCashTerkumpul, persentase: persentaseCash, totalBayar: totalCashBayar },
        arisan: { totalSesi: arisanSnap.size, totalTerkumpul: totalArisanTerkumpul, daftarPemenang },
        rekapBulanan,
      });
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat laporan tahunan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPengelola) fetchLaporan();
  }, [tahun]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    if (!laporan) return;
    setExporting(true);
    const headers = ['No', 'Bulan', 'Setor Simpanan', 'Tarik Simpanan', 'Pinjaman Baru', 'Cash Terkumpul'];
    const rows = laporan.rekapBulanan.map((item, idx) => [idx + 1, item.bulan, item.setorSimpanan, item.tarikSimpanan, item.pinjamanBaru, item.cashTerkumpul]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan_tahunan_${tahun}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Laporan berhasil diexport');
    setExporting(false);
  };

  if (!isPengelola) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">⚠️ Akses ditolak. Hanya pengelola.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Toaster position="top-right" />
      
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Calendar size={24} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Laporan Tahunan</h1>
            <p className="text-gray-500">Rekapitulasi keuangan lengkap tahunan koperasi</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select value={tahun} onChange={(e) => setTahun(parseInt(e.target.value))} className="px-3 py-2 border rounded-lg dark:bg-gray-700">
            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchLaporan} disabled={loading} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Tampilkan</button>
          <button onClick={handlePrint} className="px-3 py-2 border rounded-lg flex items-center gap-2"><Printer size={16} /> Cetak</button>
          <button onClick={handleExportCSV} disabled={exporting || !laporan} className="px-3 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"><Download size={16} /> {exporting ? 'Memproses...' : 'Export CSV'}</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : laporan ? (
        <div id="laporan-tahunan-content" className="space-y-6">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-2xl font-bold">GUJALA 23</h2>
            <p className="text-gray-500">Laporan Tahunan {laporan.tahun}</p>
            <p className="text-xs text-gray-400">Dicetak: {new Date().toLocaleDateString('id-ID')}</p>
          </div>

          {/* Ringkasan Utama */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><Users size={16} /><span className="text-sm">Total Anggota</span></div>
              <p className="text-2xl font-bold">{laporan.totalAnggota}</p>
              <p className="text-xs text-green-600">+{laporan.totalAnggotaBaru} baru</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><Wallet size={16} /><span className="text-sm">Total Simpanan</span></div>
              <p className="text-2xl font-bold text-green-600">Rp {laporan.simpanan.saldoAkhir.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><HandCoins size={16} /><span className="text-sm">Pinjaman Aktif</span></div>
              <p className="text-2xl font-bold text-orange-600">{laporan.pinjaman.jumlahAktif}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><Trophy size={16} /><span className="text-sm">Kas Arisan</span></div>
              <p className="text-2xl font-bold text-purple-600">Rp {laporan.arisan.totalTerkumpul.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><TrendingUp size={16} /><span className="text-sm">Cash Terkumpul</span></div>
              <p className="text-2xl font-bold text-blue-600">{laporan.cash.persentase.toFixed(1)}%</p>
            </div>
          </div>

          {/* Laporan Simpanan - DARK MODE FIX (background ikut dark mode) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Wallet size={18} /> Laporan Simpanan</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="p-2 bg-green-50 dark:bg-green-900/40 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Setor</p>
                <p className="font-bold text-green-700 dark:text-green-300">Rp {laporan.simpanan.totalSetor.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-2 bg-orange-50 dark:bg-orange-900/40 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Tarik</p>
                <p className="font-bold text-orange-700 dark:text-orange-300">Rp {laporan.simpanan.totalTarik.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Saldo Akhir</p>
                <p className="font-bold text-blue-700 dark:text-blue-300">Rp {laporan.simpanan.saldoAkhir.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-2 bg-purple-50 dark:bg-purple-900/40 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Rata-rata Saldo</p>
                <p className="font-bold text-purple-700 dark:text-purple-300">Rp {laporan.simpanan.rataRataSaldo.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>

          {/* Laporan Pinjaman - DARK MODE FIX */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><HandCoins size={18} /> Laporan Pinjaman</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/40 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Disetujui</p>
                <p className="font-bold text-purple-700 dark:text-purple-300">Rp {laporan.pinjaman.totalDisetujui.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-2 bg-green-50 dark:bg-green-900/40 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Dibayar</p>
                <p className="font-bold text-green-700 dark:text-green-300">Rp {laporan.pinjaman.totalDibayar.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-2 bg-orange-50 dark:bg-orange-900/40 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Sisa</p>
                <p className="font-bold text-orange-700 dark:text-orange-300">Rp {laporan.pinjaman.totalSisa.toLocaleString('id-ID')}</p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Rata-rata Pinjaman</p>
                <p className="font-bold text-blue-700 dark:text-blue-300">Rp {laporan.pinjaman.rataRataPinjaman.toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="flex justify-around text-center">
              <div><p className="text-sm text-gray-500 dark:text-gray-400">Total Pengajuan</p><p className="font-bold">{laporan.pinjaman.jumlahPengajuan}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-gray-400">Aktif</p><p className="font-bold text-blue-600 dark:text-blue-400">{laporan.pinjaman.jumlahAktif}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-gray-400">Lunas</p><p className="font-bold text-green-600 dark:text-green-400">{laporan.pinjaman.jumlahLunas}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-gray-400">Ditolak</p><p className="font-bold text-red-600 dark:text-red-400">{laporan.pinjaman.jumlahDitolak}</p></div>
            </div>
          </div>

          {/* Laporan Cash Bulanan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Calendar size={18} /> Laporan Cash Bulanan {laporan.tahun}</h3>
            <div className="flex justify-between items-center">
              <div><p className="text-sm text-gray-500 dark:text-gray-400">Target</p><p className="font-bold">Rp {laporan.cash.target.toLocaleString('id-ID')}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-gray-400">Terkumpul</p><p className="font-bold text-green-700 dark:text-green-300">Rp {laporan.cash.terkumpul.toLocaleString('id-ID')}</p></div>
              <div><p className="text-sm text-gray-500 dark:text-gray-400">Persentase</p><p className="font-bold text-blue-700 dark:text-blue-300">{laporan.cash.persentase.toFixed(1)}%</p></div>
              <div><p className="text-sm text-gray-500 dark:text-gray-400">Total Bayar</p><p className="font-bold">{laporan.cash.totalBayar} kali</p></div>
            </div>
          </div>

          {/* Laporan Arisan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Trophy size={18} /> Laporan Arisan</h3>
            <p className="text-gray-700 dark:text-gray-300"><strong>Total Sesi:</strong> {laporan.arisan.totalSesi} sesi</p>
            <p className="text-gray-700 dark:text-gray-300"><strong>Total Terkumpul:</strong> Rp {laporan.arisan.totalTerkumpul.toLocaleString('id-ID')}</p>
            {laporan.arisan.daftarPemenang.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Daftar Pemenang:</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {laporan.arisan.daftarPemenang.map((p, i) => (
                    <div key={i} className="text-sm flex justify-between border-b border-gray-200 dark:border-gray-700 py-1">
                      <span className="text-gray-600 dark:text-gray-400">{p.periode}</span>
                      <span className="font-medium text-purple-600 dark:text-purple-400">{p.pemenang}</span>
                      <span className="text-green-600 dark:text-green-400">Rp {p.potongan.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rekap Bulanan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 overflow-x-auto">
            <h3 className="text-lg font-semibold mb-3">Rekap Bulanan {laporan.tahun}</h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="p-2 text-left text-gray-700 dark:text-gray-300">Bulan</th>
                  <th className="p-2 text-right text-gray-700 dark:text-gray-300">Setor Simpanan</th>
                  <th className="p-2 text-right text-gray-700 dark:text-gray-300">Tarik Simpanan</th>
                  <th className="p-2 text-right text-gray-700 dark:text-gray-300">Pinjaman Baru</th>
                  <th className="p-2 text-right text-gray-700 dark:text-gray-300">Cash Terkumpul</th>
                </tr>
              </thead>
              <tbody>
                {laporan.rekapBulanan.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-medium text-gray-900 dark:text-white">{item.bulan}</td>
                    <td className="p-2 text-right text-green-700 dark:text-green-300">Rp {item.setorSimpanan.toLocaleString('id-ID')}</td>
                    <td className="p-2 text-right text-orange-700 dark:text-orange-300">Rp {item.tarikSimpanan.toLocaleString('id-ID')}</td>
                    <td className="p-2 text-right text-purple-700 dark:text-purple-300">Rp {item.pinjamanBaru.toLocaleString('id-ID')}</td>
                    <td className="p-2 text-right text-blue-700 dark:text-blue-300">Rp {item.cashTerkumpul.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 border-t pt-4">
            <p>Laporan ini digenerate secara otomatis oleh sistem GUJALA 23</p>
            <p className="mt-1">© {laporan.tahun} GUJALA 23</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Calendar size={48} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">Pilih tahun dan klik "Tampilkan"</p>
        </div>
      )}
    </div>
  );
}