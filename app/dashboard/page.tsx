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
  doc,
  getDoc,
  Timestamp,
  writeBatch,
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
  keterangan?: string;
};

export default function SimpananPage() {
  const { user, userData } = useAuth();
  const [saldo, setSaldo] = useState(0);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState<'setor' | 'tarik' | null>(null);
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPengelola = userData?.role === 'pengelola';

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Ambil saldo
      const saldoRef = doc(db, 'saldo', user.uid);
      const saldoSnap = await getDoc(saldoRef);
      const currentSaldo = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;
      setSaldo(currentSaldo);

      // Ambil transaksi
      const transaksiQuery = query(
        collection(db, 'transaksi_simpanan'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
      const transaksiSnap = await getDocs(transaksiQuery);
      const data: Transaksi[] = [];
      transaksiSnap.forEach(docSnap => {
        const t = docSnap.data();
        data.push({
          id: docSnap.id,
          userId: t.userId,
          userNama: t.userNama || userData?.nama || '',
          jenis: t.jenis,
          jumlah: t.jumlah,
          timestamp: t.timestamp?.toDate() || new Date(),
          saldoSetelah: t.saldoSetelah,
          keterangan: t.keterangan,
        });
      });
      setTransaksi(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSetor = async () => {
    if (!isPengelola) {
      toast.error('Hanya pengelola yang dapat melakukan setor saldo');
      return;
    }
    
    const jumlahNum = parseInt(jumlah);
    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }

    setSubmitting(true);
    try {
      const saldoRef = doc(db, 'saldo', user.uid);
      const saldoSnap = await getDoc(saldoRef);
      const currentSaldo = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;
      const newSaldo = currentSaldo + jumlahNum;

      const batch = writeBatch(db);
      if (saldoSnap.exists()) {
        batch.update(saldoRef, { jumlah: newSaldo });
      } else {
        batch.set(saldoRef, { jumlah: newSaldo, userId: user.uid });
      }

      const transaksiRef = doc(collection(db, 'transaksi_simpanan'));
      batch.set(transaksiRef, {
        userId: user.uid,
        userNama: userData?.nama || '',
        jenis: 'setor',
        jumlah: jumlahNum,
        timestamp: Timestamp.now(),
        saldoSetelah: newSaldo,
        keterangan: keterangan || `Setor oleh ${userData?.nama}`,
      });

      await batch.commit();

      toast.success(`Setor saldo Rp ${jumlahNum.toLocaleString('id-ID')} berhasil!`);
      setJumlah('');
      setKeterangan('');
      setModalOpen(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses setor saldo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTarik = async () => {
    if (!isPengelola) {
      toast.error('Hanya pengelola yang dapat melakukan tarik saldo');
      return;
    }
    
    const jumlahNum = parseInt(jumlah);
    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }

    if (jumlahNum > saldo) {
      toast.error('Saldo tidak mencukupi');
      return;
    }

    setSubmitting(true);
    try {
      const saldoRef = doc(db, 'saldo', user.uid);
      const newSaldo = saldo - jumlahNum;

      const batch = writeBatch(db);
      batch.update(saldoRef, { jumlah: newSaldo });

      const transaksiRef = doc(collection(db, 'transaksi_simpanan'));
      batch.set(transaksiRef, {
        userId: user.uid,
        userNama: userData?.nama || '',
        jenis: 'tarik',
        jumlah: jumlahNum,
        timestamp: Timestamp.now(),
        saldoSetelah: newSaldo,
        keterangan: keterangan || `Tarik oleh ${userData?.nama}`,
      });

      await batch.commit();

      toast.success(`Tarik saldo Rp ${jumlahNum.toLocaleString('id-ID')} berhasil!`);
      setJumlah('');
      setKeterangan('');
      setModalOpen(null);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses tarik saldo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Simpanan</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola setoran dan penarikan saldo</p>
      </div>

      {/* Card Saldo */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm mb-1">Saldo Anda</p>
            <p className="text-3xl font-bold">Rp {saldo.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-white/20 p-3 rounded-full">
            <Wallet size={32} />
          </div>
        </div>
      </div>

      {/* Tombol Aksi (hanya untuk pengelola) */}
      {isPengelola && (
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
      )}

      {/* Info untuk anggota biasa */}
      {!isPengelola && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            📌 Untuk melakukan setor atau tarik saldo, silakan hubungi pengelola.
          </p>
        </div>
      )}

      {/* Riwayat Transaksi */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <History size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Riwayat Transaksi</h2>
          <button onClick={fetchData} className="ml-auto p-1 text-gray-500 hover:text-gray-700">
            <RefreshCw size={16} />
          </button>
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
              <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${t.jenis === 'setor' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                    {t.jenis === 'setor' ? <ArrowUpCircle size={18} className="text-green-600" /> : <ArrowDownCircle size={18} className="text-orange-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t.jenis === 'setor' ? 'Setor Saldo' : 'Tarik Saldo'}
                    </p>
                    {t.keterangan && <p className="text-xs text-gray-400">{t.keterangan}</p>}
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

      {/* Modal Setor */}
      {modalOpen === 'setor' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Setor Saldo</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jumlah (Rp)</label>
                <input
                  type="number"
                  value={jumlah}
                  onChange={(e) => setJumlah(e.target.value)}
                  placeholder="Masukkan jumlah"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Misal: Setoran awal"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(null)} className="flex-1 px-4 py-2 border rounded-lg">Batal</button>
              <button onClick={handleSetor} disabled={submitting} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">
                {submitting ? 'Memproses...' : 'Setor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tarik */}
      {modalOpen === 'tarik' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Tarik Saldo</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Saldo saat ini: <strong className="text-green-600">Rp {saldo.toLocaleString('id-ID')}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jumlah (Rp)</label>
                <input
                  type="number"
                  value={jumlah}
                  onChange={(e) => setJumlah(e.target.value)}
                  placeholder="Masukkan jumlah"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Misal: Penarikan tunai"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(null)} className="flex-1 px-4 py-2 border rounded-lg">Batal</button>
              <button onClick={handleTarik} disabled={submitting} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg disabled:opacity-50">
                {submitting ? 'Memproses...' : 'Tarik'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}