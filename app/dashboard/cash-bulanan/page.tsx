// app/dashboard/cash-bulanan/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { CalendarDays, CheckCircle, XCircle, RefreshCw, Settings, Save } from 'lucide-react';

type Anggota = {
  uid: string;
  nama: string;
  email: string;
  noTel: string;
  alamat: string;
};

type CashBulanan = {
  userId: string;
  userNama: string;
  bulan: number;
  tahun: number;
  jumlah: number;
  statusBayar: 'lunas' | 'belum';
  tanggalBayar?: Date;
};

export default function CashBulananPage() {
  const { user, userData } = useAuth();
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [cashData, setCashData] = useState<{ [key: string]: CashBulanan }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  const [besaranCash, setBesaranCash] = useState(50000);
  const [showSettings, setShowSettings] = useState(false);

  const isPengelola = userData?.role === 'pengelola';

  // Ambil daftar anggota
  const fetchAnggota = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        nama: doc.data().nama,
        email: doc.data().email,
        noTel: doc.data().noTel || '',
        alamat: doc.data().alamat || ''
      }));
      setAnggota(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data anggota');
    }
  };

  // Ambil data cash untuk bulan dan tahun yang dipilih
  const fetchCashData = async () => {
    if (!anggota.length) return;
    setLoading(true);
    try {
      const cashQuery = query(
        collection(db, 'cash_bulanan'),
        where('bulan', '==', selectedBulan),
        where('tahun', '==', selectedTahun)
      );
      const cashSnapshot = await getDocs(cashQuery);
      
      const cashMap: { [key: string]: CashBulanan } = {};
      cashSnapshot.forEach(doc => {
        const data = doc.data();
        cashMap[data.userId] = {
          userId: data.userId,
          userNama: data.userNama,
          bulan: data.bulan,
          tahun: data.tahun,
          jumlah: data.jumlah,
          statusBayar: data.statusBayar,
          tanggalBayar: data.tanggalBayar?.toDate(),
        };
      });

      // Jika belum ada data untuk anggota, buat default (belum bayar)
      for (const a of anggota) {
        if (!cashMap[a.uid]) {
          cashMap[a.uid] = {
            userId: a.uid,
            userNama: a.nama,
            bulan: selectedBulan,
            tahun: selectedTahun,
            jumlah: besaranCash,
            statusBayar: 'belum',
          };
        }
      }
      
      setCashData(cashMap);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data cash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnggota();
  }, []);

  useEffect(() => {
    if (anggota.length > 0) {
      fetchCashData();
    }
  }, [anggota, selectedBulan, selectedTahun]);

  // Pengelola: update besaran cash dan simpan ke semua anggota
  const handleUpdateBesaran = async () => {
    if (!isPengelola) return;
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      for (const a of anggota) {
        const cashRef = doc(db, 'cash_bulanan', `${a.uid}_${selectedBulan}_${selectedTahun}`);
        batch.set(cashRef, {
          userId: a.uid,
          userNama: a.nama,
          bulan: selectedBulan,
          tahun: selectedTahun,
          jumlah: besaranCash,
          statusBayar: cashData[a.uid]?.statusBayar === 'lunas' ? 'lunas' : 'belum',
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }
      
      await batch.commit();
      toast.success(`Besaran cash bulan ${selectedBulan}/${selectedTahun} diperbarui menjadi Rp ${besaranCash.toLocaleString('id-ID')}`);
      fetchCashData();
      setShowSettings(false);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengupdate besaran cash');
    } finally {
      setSubmitting(false);
    }
  };

  // Pengelola: toggle status bayar untuk anggota tertentu
  const handleToggleBayar = async (userId: string, currentStatus: 'lunas' | 'belum') => {
  if (!isPengelola) return;
  
  const newStatus = currentStatus === 'lunas' ? 'belum' : 'lunas';
  const anggotaTarget = anggota.find(a => a.uid === userId);
  if (!anggotaTarget) return;

  setSubmitting(true);
  try {
    const batch = writeBatch(db);
    const cashRef = doc(db, 'cash_bulanan', `${userId}_${selectedBulan}_${selectedTahun}`);

    if (newStatus === 'lunas') {
      // Potong saldo anggota
      const saldoRef = doc(db, 'saldo', userId);
      const saldoSnap = await getDoc(saldoRef);
      const saldoSekarang = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;

      if (saldoSekarang < besaranCash) {
        toast.error(`Saldo ${anggotaTarget.nama} tidak cukup (Rp ${saldoSekarang.toLocaleString('id-ID')})`);
        setSubmitting(false);
        return;
      }

      const newSaldo = saldoSekarang - besaranCash;
      batch.update(saldoRef, { jumlah: newSaldo });

      // Catat transaksi
      const transaksiRef = doc(collection(db, 'transaksi_simpanan'));
      batch.set(transaksiRef, {
        userId: userId,
        userNama: anggotaTarget.nama,
        jenis: 'tarik',
        jumlah: besaranCash,
        keterangan: `Pembayaran cash bulanan ${getNamaBulan(selectedBulan)} ${selectedTahun} (oleh pengelola)`,
        timestamp: Timestamp.now(),
        saldoSetelah: newSaldo,
      });
    } else {
      // Jika batal lunas, kita tidak bisa mengembalikan saldo (biar manual)
      toast.error('Pembatalan lunas tidak mengembalikan saldo. Atur manual jika perlu.');
    }

    batch.set(cashRef, {
      statusBayar: newStatus,
      tanggalBayar: newStatus === 'lunas' ? Timestamp.now() : null,
    }, { merge: true });

    await batch.commit();
    toast.success(`Status bayar ${newStatus === 'lunas' ? 'lunas' : 'belum'} untuk ${anggotaTarget.nama}`);
    fetchData();
  } catch (error) {
    console.error(error);
    toast.error('Gagal mengupdate status bayar');
  } finally {
    setSubmitting(false);
  }
};

  // Anggota: bayar cash sendiri
const handleBayarSendiri = async () => {
  if (isPengelola || !user) return;
  const current = cashData[user.uid];
  if (!current) return;
  if (current.statusBayar === 'lunas') {
    toast.error('Anda sudah membayar cash bulan ini');
    return;
  }

  // Cek saldo cukup?
  const saldoRef = doc(db, 'saldo', user.uid);
  const saldoSnap = await getDoc(saldoRef);
  const saldoSekarang = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;

  if (saldoSekarang < besaranCash) {
    toast.error(`Saldo tidak cukup. Saldo Anda Rp ${saldoSekarang.toLocaleString('id-ID')}, butuh Rp ${besaranCash.toLocaleString('id-ID')}`);
    return;
  }

  setSubmitting(true);
  try {
    const batch = writeBatch(db);

    // 1. Potong saldo
    const newSaldo = saldoSekarang - besaranCash;
    batch.update(saldoRef, { jumlah: newSaldo });

    // 2. Catat transaksi tarik
    const transaksiRef = doc(collection(db, 'transaksi_simpanan'));
    batch.set(transaksiRef, {
      userId: user.uid,
      userNama: userData?.nama,
      jenis: 'tarik',
      jumlah: besaranCash,
      keterangan: `Pembayaran cash bulanan ${getNamaBulan(selectedBulan)} ${selectedTahun}`,
      timestamp: Timestamp.now(),
      saldoSetelah: newSaldo,
    });

    // 3. Update status cash
    const cashRef = doc(db, 'cash_bulanan', `${user.uid}_${selectedBulan}_${selectedTahun}`);
    batch.set(cashRef, {
      userId: user.uid,
      userNama: userData?.nama,
      bulan: selectedBulan,
      tahun: selectedTahun,
      jumlah: besaranCash,
      statusBayar: 'lunas',
      tanggalBayar: Timestamp.now(),
    }, { merge: true });

    await batch.commit();

    toast.success(`Pembayaran cash bulan ${selectedBulan}/${selectedTahun} berhasil!`);
    fetchData();
  } catch (error) {
    console.error(error);
    toast.error('Gagal melakukan pembayaran');
  } finally {
    setSubmitting(false);
  }
};

  // Generate bulan
  const bulanList = [
    { value: 1, nama: 'Januari' },
    { value: 2, nama: 'Februari' },
    { value: 3, nama: 'Maret' },
    { value: 4, nama: 'April' },
    { value: 5, nama: 'Mei' },
    { value: 6, nama: 'Juni' },
    { value: 7, nama: 'Juli' },
    { value: 8, nama: 'Agustus' },
    { value: 9, nama: 'September' },
    { value: 10, nama: 'Oktober' },
    { value: 11, nama: 'November' },
    { value: 12, nama: 'Desember' },
  ];

  const tahunList = [2024, 2025, 2026, 2027, 2028];

  if (!user) return null;

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cash Bulanan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola iuran kas bulanan anggota
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchAnggota();
              fetchCashData();
            }}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          {isPengelola && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
            >
              <Settings size={18} />
              Atur Besaran
            </button>
          )}
        </div>
      </div>

      {/* Filter Periode */}
      <div className="flex gap-3 mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Bulan</label>
          <select
            value={selectedBulan}
            onChange={(e) => setSelectedBulan(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            {bulanList.map(b => (
              <option key={b.value} value={b.value}>{b.nama}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Tahun</label>
          <select
            value={selectedTahun}
            onChange={(e) => setSelectedTahun(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            {tahunList.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {!isPengelola && (
          <div className="flex items-end">
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Besaran Cash: <strong>Rp {besaranCash.toLocaleString('id-ID')}</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Panel (Pengelola) */}
      {showSettings && isPengelola && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Atur Besaran Cash</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Besaran Cash (Rp)</label>
              <input
                type="number"
                value={besaranCash}
                onChange={(e) => setBesaranCash(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                placeholder="Misal: 50000"
              />
            </div>
            <button
              onClick={handleUpdateBesaran}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Save size={16} />
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* Ringkasan */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Anggota</p>
          <p className="text-2xl font-bold">{anggota.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Sudah Bayar</p>
          <p className="text-2xl font-bold text-green-600">
            {Object.values(cashData).filter(c => c.statusBayar === 'lunas').length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Belum Bayar</p>
          <p className="text-2xl font-bold text-orange-600">
            {Object.values(cashData).filter(c => c.statusBayar === 'belum').length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Terkumpul</p>
          <p className="text-2xl font-bold text-blue-600">
            Rp {(
              Object.values(cashData)
                .filter(c => c.statusBayar === 'lunas')
                .reduce((sum, c) => sum + c.jumlah, 0)
            ).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Tabel Cash Anggota */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : anggota.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500">Belum ada data anggota</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Besaran</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {anggota.map((a, idx) => {
                  const cash = cashData[a.uid];
                  const isPaid = cash?.statusBayar === 'lunas';
                  return (
                    <tr key={a.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{a.nama}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        Rp {cash?.jumlah?.toLocaleString('id-ID') || besaranCash.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            <CheckCircle size={12} /> Lunas
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                            <XCircle size={12} /> Belum
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isPengelola ? (
                          <button
                            onClick={() => handleToggleBayar(a.uid, isPaid ? 'lunas' : 'belum')}
                            disabled={submitting}
                            className={`px-3 py-1.5 rounded-lg text-sm ${
                              isPaid
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {isPaid ? 'Batalkan' : 'Tandai Lunas'}
                          </button>
                        ) : user?.uid === a.uid && !isPaid ? (
                          <button
                            onClick={handleBayarSendiri}
                            disabled={submitting}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                          >
                            Bayar Sekarang
                          </button>
                        ) : user?.uid === a.uid && isPaid ? (
                          <span className="text-sm text-green-600">✓ Sudah Bayar</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}