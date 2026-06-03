// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  HandCoins, 
  TrendingUp, 
  PieChart,
  Download,
  Calendar
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

type SummaryData = {
  totalAnggota: number;
  totalSimpanan: number;
  totalPinjamanAktif: number;
  simpananSaya?: number;
  pinjamanSaya?: number;
  totalKasArisan?: number;
};

type ChartData = {
  name: string;
  simpanan: number;
  pinjaman: number;
};

type MonthlyData = {
  bulan: string;
  setor: number;
  tarik: number;
};

export default function DashboardPage() {
  const { user, userData } = useAuth();
  const [summary, setSummary] = useState<SummaryData>({
    totalAnggota: 0,
    totalSimpanan: 0,
    totalPinjamanAktif: 0,
    simpananSaya: 0,
    pinjamanSaya: 0,
    totalKasArisan: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isPengelola = userData?.role === 'pengelola';

  // Ambil data dashboard
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
        // Fallback: hitung dari transaksi simpanan
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

      // 3. Total anggota & total simpanan & chart data (hanya pengelola)
      let totalAnggota = 0;
      let totalSimpanan = 0;
      let totalPinjamanAktif = 0;
      let totalKasArisan = 0;
      let chartDataTemp: ChartData[] = [];
      let monthlyDataTemp: MonthlyData[] = [];

      if (isPengelola) {
        // Total anggota
        const anggotaSnap = await getDocs(collection(db, 'users'));
        totalAnggota = anggotaSnap.size;

        // Total simpanan & data chart per anggota
        const simpananSnap = await getDocs(collection(db, 'transaksi_simpanan'));
        let totalSetor = 0, totalTarik = 0;
        const anggotaMap = new Map<string, { setor: number; tarik: number; nama: string }>();
        
        for (const docSnap of simpananSnap.docs) {
          const data = docSnap.data();
          if (data.jenis === 'setor') {
            totalSetor += data.jumlah;
            const existing = anggotaMap.get(data.userId) || { setor: 0, tarik: 0, nama: data.userNama || '' };
            existing.setor += data.jumlah;
            anggotaMap.set(data.userId, existing);
          } else if (data.jenis === 'tarik') {
            totalTarik += data.jumlah;
            const existing = anggotaMap.get(data.userId) || { setor: 0, tarik: 0, nama: data.userNama || '' };
            existing.tarik += data.jumlah;
            anggotaMap.set(data.userId, existing);
          }
        }
        totalSimpanan = totalSetor - totalTarik;

        // Chart data top 5 anggota
        const topAnggota = Array.from(anggotaMap.entries())
          .map(([id, value]) => ({ id, nama: value.nama || id, saldo: value.setor - value.tarik }))
          .sort((a, b) => b.saldo - a.saldo)
          .slice(0, 5);
        
        chartDataTemp = topAnggota.map((a, idx) => ({
          name: a.nama.length > 10 ? a.nama.substring(0, 10) + '...' : a.nama,
          simpanan: a.saldo,
          pinjaman: 0,
        }));

        // Total pinjaman aktif
        const pinjamanAktifQuery = query(
          collection(db, 'pinjaman'),
          where('status', '==', 'aktif')
        );
        const pinjamanAktifSnap = await getDocs(pinjamanAktifQuery);
        pinjamanAktifSnap.forEach(doc => {
          totalPinjamanAktif += doc.data().sisa || doc.data().jumlah || 0;
        });

        // Total kas arisan
        const kasArisanSnap = await getDocs(collection(db, 'kas_arisan'));
        kasArisanSnap.forEach(doc => {
          totalKasArisan += doc.data().jumlah || 0;
        });

        // Monthly transaksi untuk chart tren
        const monthlyMap = new Map<string, { setor: number; tarik: number }>();
        for (let i = 1; i <= 12; i++) {
          monthlyMap.set(i.toString(), { setor: 0, tarik: 0 });
        }
        
        for (const docSnap of simpananSnap.docs) {
          const data = docSnap.data();
          const timestamp = data.timestamp?.toDate();
          if (timestamp && timestamp.getFullYear() === selectedYear) {
            const month = (timestamp.getMonth() + 1).toString();
            const existing = monthlyMap.get(month) || { setor: 0, tarik: 0 };
            if (data.jenis === 'setor') {
              existing.setor += data.jumlah;
            } else if (data.jenis === 'tarik') {
              existing.tarik += data.jumlah;
            }
            monthlyMap.set(month, existing);
          }
        }
        
        const bulanNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        monthlyDataTemp = Array.from({ length: 12 }, (_, i) => {
          const month = (i + 1).toString();
          const data = monthlyMap.get(month) || { setor: 0, tarik: 0 };
          return {
            bulan: bulanNames[i],
            setor: data.setor,
            tarik: data.tarik,
          };
        });
        
        setChartData(chartDataTemp);
        setMonthlyData(monthlyDataTemp);
      }

      setSummary({
        totalAnggota,
        totalSimpanan,
        totalPinjamanAktif,
        simpananSaya: saldoSaya,
        pinjamanSaya: pinjamanSaya,
        totalKasArisan,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, userData, selectedYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const pieData = [
    { name: 'Simpanan', value: isPengelola ? summary.totalSimpanan : summary.simpananSaya || 0 },
    { name: 'Pinjaman Aktif', value: isPengelola ? summary.totalPinjamanAktif : summary.pinjamanSaya || 0 },
  ];
  const COLORS = ['#10b981', '#f97316'];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Selamat datang kembali, {userData?.nama || 'User'}
        </p>
      </div>

      {/* Cards Ringkasan */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Anggota</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.totalAnggota}</p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                <Users className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
            </div>
          </div>
        )}

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

        {isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Kas Arisan</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  Rp {(summary.totalKasArisan || 0).toLocaleString('id-ID')}
                </p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                <TrendingUp className="text-purple-600 dark:text-purple-400" size={24} />
              </div>
            </div>
          </div>
        )}

        {!isPengelola && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <p className="text-lg font-medium text-gray-900 dark:text-white mt-1">Anggota Aktif</p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                <LayoutDashboard className="text-purple-600 dark:text-purple-400" size={24} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grafik untuk Pengelola */}
      {isPengelola && (
        <>
          {/* Filter Tahun */}
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm">
              <Calendar size={16} className="text-gray-500" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-transparent text-gray-700 dark:text-gray-300 text-sm focus:outline-none"
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Tren Simpanan & Pinjaman */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" />
                Tren Keuangan {selectedYear}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="bulan" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="setor" stroke="#10b981" name="Setoran" strokeWidth={2} />
                  <Line type="monotone" dataKey="tarik" stroke="#f97316" name="Penarikan" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Komposisi Keuangan */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <PieChart size={18} className="text-purple-500" />
                Komposisi Keuangan
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 5 Anggota dengan Saldo Tertinggi */}
          {chartData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users size={18} className="text-green-500" />
                Top 5 Anggota dengan Saldo Tertinggi
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} />
                  <Bar dataKey="simpanan" fill="#10b981" name="Saldo Simpanan" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Pesan jika belum ada data */}
      {isPengelola && summary.totalAnggota === 0 && (
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            📌 Belum ada data. Silakan tambahkan anggota terlebih dahulu di menu Kelola Anggota.
          </p>
        </div>
      )}

      {!isPengelola && (summary.simpananSaya === 0 && summary.pinjamanSaya === 0) && (
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            📌 Selamat datang! Anda belum memiliki transaksi. Silakan setor saldo di menu Simpanan untuk memulai.
          </p>
        </div>
      )}
    </div>
  );
}