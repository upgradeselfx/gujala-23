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
  setDoc,
  Timestamp,
  writeBatch,
  orderBy,
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { CalendarDays, CheckCircle, XCircle, RefreshCw, Settings, Save, Users, Wallet } from 'lucide-react';

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
  metode?: 'potong_saldo' | 'manual';
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
  const [modalOpen, setModalOpen] = useState<{ userId: string; nama: string } | null>(null);
  const [metodeBayar, setMetodeBayar] = useState<'potong_saldo' | 'manual'>('potong_saldo');

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
          metode: data.metode,
        };
      });

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
  }, [anggota, selectedBulan, selectedTahun, besaranCash]);

  // Pengelola: update besaran cash
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

  // Pengelola: bayar cash untuk anggota (potong saldo)
  const handleBayarViaSaldo = async (userId: string, userNama: string) => {
    setSubmitting(true);
    try {
      // Cek saldo anggota
      const saldoRef = doc(db, 'saldo', userId);
      const saldoSnap = await getDoc(saldoRef);
      const saldoSekarang = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;

      if (saldoSekarang < besaranCash) {
        toast.error(`Saldo ${userNama} tidak cukup (Rp ${saldoSekarang.toLocaleString('id-ID')}). Butuh Rp ${besaranCash.toLocaleString('id-ID')}`);
        setSubmitting(false);
        return;
      }

      const batch = writeBatch(db);

      // Potong saldo
      const newSaldo = saldoSekarang - besaranCash;
      batch.update(saldoRef, { jumlah: newSaldo });

      // Catat transaksi simpanan (tarik)
      const transaksiRef = doc(collection(db, 'transaksi_simpanan'));
      batch.set(transaksiRef, {
        userId: userId,
        userNama: userNama,
        jenis: 'tarik',
        jumlah: besaranCash,
        keterangan: `Pembayaran cash bulanan ${getNamaBulan(selectedBulan)} ${selectedTahun}`,
        timestamp: Timestamp.now(),
        saldoSetelah: newSaldo,
      });

      // Update status cash
      const cashRef = doc(db, 'cash_bulanan', `${userId}_${selectedBulan}_${selectedTahun}`);
      batch.set(cashRef, {
        userId,
        userNama,
        bulan: selectedBulan,
        tahun: selectedTahun,
        jumlah: besaranCash,
        statusBayar: 'lunas',
        tanggalBayar: Timestamp.now(),
        metode: 'potong_saldo',
      }, { merge: true });

      await batch.commit();

      toast.success(`Pembayaran cash ${userNama} berhasil (potong saldo)`);
      fetchCashData();
      setModalOpen(null);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  // Pengelola: bayar cash untuk anggota (manual, tanpa potong saldo)
  const handleBayarManual = async (userId: string, userNama: string) => {
    setSubmitting(true);
    try {
      const cashRef = doc(db, 'cash_bulanan', `${userId}_${selectedBulan}_${selectedTahun}`);
      await setDoc(cashRef, {
        userId,
        userNama,
        bulan: selectedBulan,
        tahun: selectedTahun,
        jumlah: besaranCash,
        statusBayar: 'lunas',
        tanggalBayar: Timestamp.now(),
        metode: 'manual',
      }, { merge: true });

      toast.success(`Pembayaran cash ${userNama} berhasil (manual)`);
      fetchCashData();
      setModalOpen(null);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  // Batalkan status lunas
  const handleBatalkanLunas = async (userId: string, userNama: string) => {
    if (!confirm(`Batalkan status lunas untuk ${userNama}?`)) return;
    
    setSubmitting(true);
    try {
      const cashRef = doc(db, 'cash_bulanan', `${userId}_${selectedBulan}_${selectedTahun}`);
      await setDoc(cashRef, {
        statusBayar: 'belum',
        tanggalBayar: null,
      }, { merge: true });

      toast.success(`Status lunas untuk ${userNama} dibatalkan`);
      fetchCashData();
    } catch (error) {
      console.error(error);
      toast.error('Gagal membatalkan status lunas');
    } finally {
      setSubmitting(false);
    }
  };

  const getNamaBulan = (bulan: number) => {
    const bulanList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return bulanList[bulan - 1];
  };

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

  // Tampilan untuk anggota (hanya lihat)
  if (!isPengelola) {
    const userCash = cashData[user.uid];
    const isPaid = userCash?.statusBayar === 'lunas';
    
    return (
      <div className="p-6">
        <Toaster position="top-right" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cash Bulanan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Lihat kewajiban cash bulanan Anda</p>
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
              {bulanList.map(b => <option key={b.value} value={b.value}>{b.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Tahun</label>
            <select
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            >
              {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Status Cash */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Status Cash Bulanan</h2>
            <button onClick={fetchCashData} className="p-1 text-gray-500 hover:text-gray-700">
              <RefreshCw size={16} />
            </button>
          </div>
          
          <div className="text-center py-6">
            <div className="mb-4">
              <p className="text-gray-500">Besaran Cash</p>
              <p className="text-2xl font-bold text-blue-600">Rp {besaranCash.toLocaleString('id-ID')}</p>
            </div>
            <div className="mb-4">
              <p className="text-gray-500">Status</p>
              {isPaid ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-800">
                  <CheckCircle size={20} />
                  <span className="font-semibold">SUDAH LUNAS</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 text-red-800">
                  <XCircle size={20} />
                  <span className="font-semibold">BELUM LUNAS</span>
                </div>
              )}
            </div>
            {userCash?.tanggalBayar && (
              <p className="text-sm text-gray-500">
                Dibayar pada: {userCash.tanggalBayar.toLocaleDateString('id-ID')}
              </p>
            )}
            {userCash?.metode && (
              <p className="text-sm text-gray-500 mt-1">
                Metode: {userCash.metode === 'potong_saldo' ? 'Potong Saldo' : 'Manual'}
              </p>
            )}
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              📌 Untuk melakukan pembayaran cash bulanan, silakan hubungi pengelola.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan untuk pengelola (full akses)
  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cash Bulanan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola iuran kas bulanan anggota</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { fetchAnggota(); fetchCashData(); }} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2">
            <Settings size={18} />
            Atur Besaran
          </button>
        </div>
      </div>

      {/* Filter Periode */}
      <div className="flex gap-3 mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Bulan</label>
          <select value={selectedBulan} onChange={(e) => setSelectedBulan(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700">
            {bulanList.map(b => <option key={b.value} value={b.value}>{b.nama}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Tahun</label>
          <select value={selectedTahun} onChange={(e) => setSelectedTahun(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700">
            {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Atur Besaran Cash</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Besaran Cash (Rp)</label>
              <input type="number" value={besaranCash} onChange={(e) => setBesaranCash(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700" />
            </div>
            <button onClick={handleUpdateBesaran} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Save size={16} /> Simpan
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
          <p className="text-2xl font-bold text-green-600">{Object.values(cashData).filter(c => c.statusBayar === 'lunas').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Belum Bayar</p>
          <p className="text-2xl font-bold text-orange-600">{Object.values(cashData).filter(c => c.statusBayar === 'belum').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Terkumpul</p>
          <p className="text-2xl font-bold text-blue-600">
            Rp {Object.values(cashData).filter(c => c.statusBayar === 'lunas').reduce((sum, c) => sum + c.jumlah, 0).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Tabel Anggota */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : anggota.length === 0 ? (
          <div className="text-center py-12"><CalendarDays size={48} className="mx-auto text-gray-400 mb-3" /><p className="text-gray-500">Belum ada data anggota</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
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
                      <td className="px-6 py-4 text-sm text-right">Rp {cash?.jumlah?.toLocaleString('id-ID') || besaranCash.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-center">
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
                        {isPaid ? (
                          <button
                            onClick={() => handleBatalkanLunas(a.uid, a.nama)}
                            disabled={submitting}
                            className="px-3 py-1.5 rounded-lg text-sm bg-orange-100 text-orange-700 hover:bg-orange-200"
                          >
                            Batalkan
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setModalOpen({ userId: a.uid, nama: a.nama });
                              setMetodeBayar('potong_saldo');
                            }}
                            disabled={submitting}
                            className="px-3 py-1.5 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700"
                          >
                            Bayar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Pilihan Metode Pembayaran */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Pembayaran Cash</h2>
            <p className="text-sm text-gray-600 mb-4">
              Anggota: <strong>{modalOpen.nama}</strong><br/>
              Besaran: <strong>Rp {besaranCash.toLocaleString('id-ID')}</strong>
            </p>

            <div className="space-y-3 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Metode Pembayaran:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMetodeBayar('potong_saldo')}
                  className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 ${
                    metodeBayar === 'potong_saldo' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <Wallet size={16} />
                  Potong Saldo
                </button>
                <button
                  onClick={() => setMetodeBayar('manual')}
                  className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 ${
                    metodeBayar === 'manual' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <CalendarDays size={16} />
                  Manual (Tunai)
                </button>
              </div>
            </div>

            {metodeBayar === 'potong_saldo' && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Akan memotong saldo anggota sebesar Rp {besaranCash.toLocaleString('id-ID')}
                </p>
              </div>
            )}

            {metodeBayar === 'manual' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  📝 Pembayaran manual (tunai/transfer) - saldo anggota tidak akan terpotong
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModalOpen(null)} className="flex-1 px-4 py-2 border rounded-lg">Batal</button>
              <button
                onClick={async () => {
                  if (metodeBayar === 'potong_saldo') {
                    await handleBayarViaSaldo(modalOpen.userId, modalOpen.nama);
                  } else {
                    await handleBayarManual(modalOpen.userId, modalOpen.nama);
                  }
                }}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Bayar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}