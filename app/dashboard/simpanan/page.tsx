// app/dashboard/simpanan/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  getDoc,
  doc,
  updateDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { Wallet, ArrowUpCircle, ArrowDownCircle, History, RefreshCw } from 'lucide-react';

type Transaksi = {
  id: string;
  userId: string;
  userNama: string;
  jenis: 'setor' | 'tarik';
  jumlah: number;
  timestamp: Date;
  saldoSetelah: number;
};

export default function SimpananPage() {
  const { user, userData } = useAuth();
  const [saldo, setSaldo] = useState(0);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState<'setor' | 'tarik' | null>(null);
  const [jumlah, setJumlah] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [daftarAnggota, setDaftarAnggota] = useState<{ uid: string; nama: string }[]>([]);

  const isPengelola = userData?.role === 'pengelola';

  // Ambil daftar anggota (untuk filter pengelola)
  const fetchAnggota = async () => {
    if (!isPengelola) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        nama: doc.data().nama
      }));
      setDaftarAnggota(data);
    } catch (error) {
      console.error(error);
    }
  };

  // Ambil saldo dan transaksi
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Ambil saldo dari collection 'saldo' (atau hitung dari transaksi)
      const saldoRef = doc(db, 'saldo', isPengelola && filterUser !== 'all' ? filterUser : user.uid);
      const saldoSnap = await getDoc(saldoRef);
      let currentSaldo = 0;
      if (saldoSnap.exists()) {
        currentSaldo = saldoSnap.data().jumlah || 0;
      }
      setSaldo(currentSaldo);

      // 2. Ambil transaksi
      let transaksiQuery;
      if (isPengelola && filterUser !== 'all') {
        transaksiQuery = query(
          collection(db, 'transaksi_simpanan'),
          where('userId', '==', filterUser),
          orderBy('timestamp', 'desc')
        );
      } else if (isPengelola && filterUser === 'all') {
        transaksiQuery = query(
          collection(db, 'transaksi_simpanan'),
          orderBy('timestamp', 'desc')
        );
      } else {
        transaksiQuery = query(
          collection(db, 'transaksi_simpanan'),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc')
        );
      }

      const transaksiSnap = await getDocs(transaksiQuery);
      const data: Transaksi[] = [];
      for (const docSnap of transaksiSnap.docs) {
        const t = docSnap.data();
        // Ambil nama user untuk tampilan pengelola
        let userNama = t.userNama || '';
        if (isPengelola && !userNama) {
          const userDoc = await getDoc(doc(db, 'users', t.userId));
          userNama = userDoc.exists() ? userDoc.data().nama : t.userId;
        }
        data.push({
          id: docSnap.id,
          userId: t.userId,
          userNama: userNama,
          jenis: t.jenis,
          jumlah: t.jumlah,
          timestamp: t.timestamp?.toDate() || new Date(),
          saldoSetelah: t.saldoSetelah,
        });
      }
      setTransaksi(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnggota();
      fetchData();
    }
  }, [user, filterUser]);

  const handleSetorTarik = async (jenis: 'setor' | 'tarik') => {
  const jumlahNum = parseInt(jumlah);
  if (isNaN(jumlahNum) || jumlahNum <= 0) {
    toast.error('Masukkan jumlah yang valid');
    return;
  }

  if (jenis === 'tarik' && jumlahNum > saldo) {
    toast.error('Saldo tidak mencukupi');
    return;
  }

  setSubmitting(true);
  try {
    const targetUserId = isPengelola && filterUser !== 'all' ? filterUser : user!.uid;
    const saldoRef = doc(db, 'saldo', targetUserId);
    const saldoSnap = await getDoc(saldoRef);
    let currentSaldo = 0;
    if (saldoSnap.exists()) {
      currentSaldo = saldoSnap.data().jumlah || 0;
    }

    let newSaldo = currentSaldo;
    if (jenis === 'setor') {
      newSaldo = currentSaldo + jumlahNum;
    } else {
      newSaldo = currentSaldo - jumlahNum;
    }

    // Gunakan batch untuk atomic operation
    const batch = writeBatch(db);

    // Update saldo
    if (saldoSnap.exists()) {
      batch.update(saldoRef, { jumlah: newSaldo });
    } else {
      batch.set(saldoRef, { jumlah: newSaldo, userId: targetUserId });
    }

    // Catat transaksi - PERBAIKAN: pake batch.set + doc reference, bukan batch.add
    const userNama = isPengelola && filterUser !== 'all' 
      ? daftarAnggota.find(a => a.uid === filterUser)?.nama || ''
      : userData?.nama || '';

    const transaksiRef = doc(collection(db, 'transaksi_simpanan'));
    batch.set(transaksiRef, {
      userId: targetUserId,
      userNama: userNama,
      jenis: jenis,
      jumlah: jumlahNum,
      timestamp: Timestamp.now(),
      saldoSetelah: newSaldo,
    });

    await batch.commit();

    toast.success(`${jenis === 'setor' ? 'Setor' : 'Tarik'} saldo berhasil!`);
    setJumlah('');
    setModalOpen(null);
    fetchData();
  } catch (error) {
    console.error(error);
    toast.error('Gagal memproses transaksi');
  } finally {
    setSubmitting(false);
  }
};

  if (!user) return null;

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Simpanan</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Kelola setoran dan penarikan saldo
        </p>
      </div>

      {/* Filter untuk pengelola */}
      {isPengelola && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-400">Filter Anggota:</label>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
          >
            <option value="all">Semua Anggota</option>
            {daftarAnggota.map((a) => (
              <option key={a.uid} value={a.uid}>{a.nama}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      )}

      {/* Card Saldo */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm mb-1">
              {isPengelola && filterUser !== 'all' 
                ? `Saldo ${daftarAnggota.find(a => a.uid === filterUser)?.nama || ''}`
                : 'Saldo Anda'}
            </p>
            <p className="text-3xl font-bold">Rp {saldo.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-white/20 p-3 rounded-full">
            <Wallet size={32} />
          </div>
        </div>
      </div>

      {/* Tombol Aksi */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setModalOpen('setor')}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2"
        >
          <ArrowUpCircle size={20} />
          Setor Saldo
        </button>
        <button
          onClick={() => setModalOpen('tarik')}
          className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition flex items-center justify-center gap-2"
        >
          <ArrowDownCircle size={20} />
          Tarik Saldo
        </button>
      </div>

      {/* Riwayat Transaksi */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <History size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Riwayat Transaksi</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : transaksi.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-gray-500 dark:text-gray-400">Belum ada transaksi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transaksi.map((t) => (
              <div
                key={t.id}
                className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${t.jenis === 'setor' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                    {t.jenis === 'setor' ? <ArrowUpCircle size={18} className="text-green-600" /> : <ArrowDownCircle size={18} className="text-orange-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t.jenis === 'setor' ? 'Setor' : 'Tarik'} Saldo
                    </p>
                    {isPengelola && t.userNama && (
                      <p className="text-xs text-gray-500">{t.userNama}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {t.timestamp.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${t.jenis === 'setor' ? 'text-green-600' : 'text-orange-600'}`}>
                    {t.jenis === 'setor' ? '+' : '-'} Rp {t.jumlah.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-400">Saldo: Rp {t.saldoSetelah.toLocaleString('id-ID')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Setor/Tarik */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {modalOpen === 'setor' ? 'Setor Saldo' : 'Tarik Saldo'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {modalOpen === 'setor' 
                ? 'Masukkan jumlah yang akan disetorkan' 
                : `Saldo saat ini: Rp ${saldo.toLocaleString('id-ID')}`}
            </p>
            <input
              type="number"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              placeholder="Masukkan jumlah (Rp)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 dark:bg-gray-700 dark:text-white"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalOpen(null);
                  setJumlah('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                Batal
              </button>
              <button
                onClick={() => handleSetorTarik(modalOpen)}
                disabled={submitting}
                className={`flex-1 px-4 py-2 rounded-lg text-white ${modalOpen === 'setor' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} disabled:opacity-50`}
              >
                {submitting ? 'Memproses...' : (modalOpen === 'setor' ? 'Setor' : 'Tarik')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}