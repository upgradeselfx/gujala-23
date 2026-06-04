'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { generateLaporanTahunan, LaporanTahunan } from '@/lib/laporanTahunan';
import { Calendar, Download, Printer, TrendingUp, Users, Wallet, HandCoins, Trophy, FileText } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import html2pdf from 'html2pdf.js';

export default function LaporanTahunanPage() {
  const { user, userData } = useAuth();
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [laporan, setLaporan] = useState<LaporanTahunan | null>(null);
  const [loading, setLoading] = useState(false);

  const isPengelola = userData?.role === 'pengelola';

  useEffect(() => {
    if (isPengelola) {
      fetchLaporan();
    }
  }, [tahun]);

  const fetchLaporan = async () => {
    setLoading(true);
    try {
      const data = await generateLaporanTahunan(tahun);
      setLaporan(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat laporan tahunan');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const element = document.getElementById('laporan-tahunan-content');
    if (!element) return;
    
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `laporan_tahunan_${tahun}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
    toast.success('PDF sedang diproses...');
  };

  if (!isPengelola) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">⚠️ Akses ditolak. Hanya pengelola yang dapat mengakses halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-xl">
            <Calendar size={24} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Tahunan</h1>
            <p className="text-gray-500 dark:text-gray-400">Rekapitulasi keuangan tahunan koperasi</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={tahun}
            onChange={(e) => setTahun(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={fetchLaporan} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Tampilkan
          </button>
          <button onClick={handlePrint} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Printer size={16} /> Cetak
          </button>
          <button onClick={handleExportPDF} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
            <FileText size={16} /> PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : laporan ? (
        <div id="laporan-tahunan-content" className="space-y-6">
          {/* Header Laporan */}
          <div className="text-center border-b pb-4">
            <h2 className="text-2xl font-bold">GUJALA 23</h2>
            <p className="text-gray-500">Laporan Tahunan {laporan.tahun}</p>
            <p className="text-xs text-gray-400">Dicetak: {new Date().toLocaleDateString('id-ID')}</p>
          </div>

          {/* Ringkasan Utama */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><Users size={16} /><span className="text-sm">Total Anggota</span></div>
              <p className="text-2xl font-bold">{laporan.totalAnggota} orang</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><Wallet size={16} /><span className="text-sm">Total Simpanan</span></div>
              <p className="text-2xl font-bold text-green-600">Rp {laporan.totalSimpanan.saldoAkhir.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><HandCoins size={16} /><span className="text-sm">Pinjaman Aktif</span></div>
              <p className="text-2xl font-bold text-orange-600">{laporan.totalPinjaman.jumlahPinjamanAktif} pinjaman</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-gray-500 mb-1"><Trophy size={16} /><span className="text-sm">Kas Arisan</span></div>
              <p className="text-2xl font-bold text-purple-600">Rp {laporan.totalArisan.totalTerkumpul.toLocaleString('id-ID')}</p>
            </div>
          </div>

          {/* Laporan Simpanan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Wallet size={18} /> Laporan Simpanan</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-green-50 rounded-lg"><p className="text-sm text-gray-500">Total Setor</p><p className="font-bold text-green-600">Rp {laporan.totalSimpanan.totalSetor.toLocaleString('id-ID')}</p></div>
              <div className="p-2 bg-orange-50 rounded-lg"><p className="text-sm text-gray-500">Total Tarik</p><p className="font-bold text-orange-600">Rp {laporan.totalSimpanan.totalTarik.toLocaleString('id-ID')}</p></div>
              <div className="p-2 bg-blue-50 rounded-lg"><p className="text-sm text-gray-500">Saldo Akhir</p><p className="font-bold text-blue-600">Rp {laporan.totalSimpanan.saldoAkhir.toLocaleString('id-ID')}</p></div>
            </div>
          </div>

          {/* Laporan Pinjaman */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><HandCoins size={18} /> Laporan Pinjaman</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="p-2 bg-purple-50 rounded-lg"><p className="text-sm text-gray-500">Disetujui</p><p className="font-bold">Rp {laporan.totalPinjaman.totalDisetujui.toLocaleString('id-ID')}</p></div>
              <div className="p-2 bg-green-50 rounded-lg"><p className="text-sm text-gray-500">Dibayar</p><p className="font-bold text-green-600">Rp {laporan.totalPinjaman.totalDibayar.toLocaleString('id-ID')}</p></div>
              <div className="p-2 bg-orange-50 rounded-lg"><p className="text-sm text-gray-500">Sisa</p><p className="font-bold text-orange-600">Rp {laporan.totalPinjaman.totalSisa.toLocaleString('id-ID')}</p></div>
              <div className="p-2 bg-blue-50 rounded-lg"><p className="text-sm text-gray-500">Aktif</p><p className="font-bold">{laporan.totalPinjaman.jumlahPinjamanAktif}</p></div>
              <div className="p-2 bg-green-50 rounded-lg"><p className="text-sm text-gray-500">Lunas</p><p className="font-bold">{laporan.totalPinjaman.jumlahPinjamanLunas}</p></div>
            </div>
          </div>

          {/* Laporan Cash Bulanan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Calendar size={18} /> Laporan Cash Bulanan {laporan.tahun}</h3>
            <div className="flex justify-between items-center">
              <div><p className="text-sm text-gray-500">Target</p><p className="font-bold">Rp {laporan.totalCash.target.toLocaleString('id-ID')}</p></div>
              <div><p className="text-sm text-gray-500">Terkumpul</p><p className="font-bold text-green-600">Rp {laporan.totalCash.terkumpul.toLocaleString('id-ID')}</p></div>
              <div><p className="text-sm text-gray-500">Persentase</p><p className="font-bold text-blue-600">{laporan.totalCash.persentase.toFixed(1)}%</p></div>
            </div>
          </div>

          {/* Laporan Arisan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Trophy size={18} /> Laporan Arisan</h3>
            <p><strong>Total Sesi:</strong> {laporan.totalArisan.totalSesi} sesi</p>
            <p><strong>Total Terkumpul:</strong> Rp {laporan.totalArisan.totalTerkumpul.toLocaleString('id-ID')}</p>
            {laporan.totalArisan.daftarPemenang.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-2">Daftar Pemenang:</p>
                <div className="space-y-1">
                  {laporan.totalArisan.daftarPemenang.map((p, i) => (
                    <div key={i} className="text-sm flex justify-between border-b py-1">
                      <span>{p.periode}</span>
                      <span className="font-medium">{p.pemenang}</span>
                      <span className="text-green-600">Rp {p.potongan.toLocaleString('id-ID')}</span>
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
              <thead className="bg-gray-50">
                <tr><th className="p-2 text-left">Bulan</th><th className="p-2 text-right">Setor</th><th className="p-2 text-right">Tarik</th><th className="p-2 text-right">Pinjaman Baru</th><th className="p-2 text-right">Cash</th></tr>
              </thead>
              <tbody>
                {laporan.rekapBulanan.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 font-medium">{item.bulan}</td>
                    <td className="p-2 text-right text-green-600">Rp {item.setorSimpanan.toLocaleString('id-ID')}</td>
                    <td className="p-2 text-right text-orange-600">Rp {item.tarikSimpanan.toLocaleString('id-ID')}</td>
                    <td className="p-2 text-right text-purple-600">Rp {item.pinjamanBaru.toLocaleString('id-ID')}</td>
                    <td className="p-2 text-right text-blue-600">Rp {item.cashTerkumpul.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 border-t pt-4">
            <p>Laporan ini digenerate secara otomatis oleh sistem GUJALA 23</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Calendar size={48} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">Pilih tahun dan klik "Tampilkan" untuk melihat laporan tahunan</p>
        </div>
      )}
    </div>
  );
}