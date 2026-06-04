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
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { Wallet, ArrowUpCircle, ArrowDownCircle, History, RefreshCw, Users } from 'lucide-react';

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

type Anggota = {
  uid: string;
  nama: string;
  email: string;
};

export default function SimpananPage() {
  const { user, userData } = useAuth();
  const [saldo, setSaldo] = useState(0);
  const [transaksi, setTransaksi] = useState<Transaksi[]>([]);
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState<'setor' | 'tarik' | null>(null);
  const [selectedAnggota, setSelectedAnggota] = useState<string>('');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterUser, setFilterUser] = useState<string>('all');

  const isPengelola = userData?.role === 'pengelola';

  // Ambil daftar anggota (untuk pengelola)
  const fetchAnggota = async () => {
    if (!isPengelola) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        nama: doc.data().nama,
        email: doc.data().email,
      }));
      setAnggota(data);
      if (data.length > 0 && !selectedAnggota) {
        setSelectedAnggota(data[0].uid);
      }
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data anggota');
    }
  };

  // Ambil saldo dan transaksi
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let targetUserId: string;
      let targetNama: string = '';
      
      if (isPengelola && filterUser !== 'all') {
        targetUserId = filterUser;
        const anggotaTarget = anggota.find(a => a.uid === filterUser);
        targetNama = anggotaTarget?.nama || '';
      } else if (isPengelola && filterUser === 'all') {
        // Jika filter semua, tampilkan ringkasan semua anggota
        setSaldo(0);
        setTransaksi([]);
        setLoading(false);
        return;
      } else {
        targetUserId = user.uid;
        targetNama = userData?.nama || '';
      }

      if (!isPengelola || filterUser !== 'all') {
        // Ambil saldo
        const saldoRef = doc(db, 'saldo', targetUserId);
        const saldoSnap = await getDoc(saldoRef);
        const currentSaldo = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;
        setSaldo(currentSaldo);

        // Ambil transaksi
        const transaksiQuery = query(
          collection(db, 'transaksi_simpanan'),
          where('userId', '==', targetUserId),
          orderBy('timestamp', 'desc')
        );
        const transaksiSnap = await getDocs(transaksiQuery);
        const data: Transaksi[] = [];
        transaksiSnap.forEach(docSnap => {
          const t = docSnap.data();
          data.push({
            id: docSnap.id,
            userId: t.userId,
            userNama: t.userNama || targetNama,
            jenis: t.jenis,
            jumlah: t.jumlah,
            timestamp: t.timestamp?.toDate() || new Date(),
            saldoSetelah: t.saldoSetelah,
            keterangan: t.keterangan,
          });
        });
        setTransaksi(data);
      }
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
    }
  }, [user]);

  useEffect(() => {
    if ((isPengelola && anggota.length > 0) || !isPengelola) {
      fetchData();
    }
  }, [filterUser, anggota, selectedAnggota]);

  // Setor saldo (hanya pengelola)
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

    if (!selectedAnggota) {
      toast.error('Pilih anggota terlebih dahulu');
      return;
    }

    const anggotaTarget = anggota.find(a => a.uid === selectedAnggota);
    if (!anggotaTarget) {
      toast.error('Anggota tidak ditemukan');
      return;
    }

    setSubmitting(true);
    try {
      const targetUserId = selectedAnggota;
      const saldoRef = doc(db, 'saldo', targetUserId);
      const saldoSnap = await getDoc(saldoRef);
      let currentSaldo = 0;
      if (saldoSnap.exists()) {
        currentSaldo = saldoSnap.data().jumlah || 0;
      }

      const newSaldo = currentSaldo + jumlahNum;

      const batch = writeBatch(db);

      // Update saldo
      if (saldoSnap.exists()) {
        batch.update(saldoRef, { jumlah: newSaldo });
      } else {
        batch.set(saldoRef, { jumlah: newSaldo, userId: targetUserId });
      }

      // Catat transaksi
      const transaksiRef = doc(collection(db, 'transaksi_simpanan'));
      batch.set(transaksiRef, {
        userId: targetUserId,
        userNama: anggotaTarget.nama,
        jenis: 'setor',
        jumlah: jumlahNum,
        timestamp: Timestamp.now(),
        saldoSetelah: newSaldo,
        keterangan: keterangan || `Setor oleh ${userData?.nama}`,
        dibuatOleh: userData?.nama,
      });

      await batch.commit();

      toast.success(`Setor saldo Rp ${jumlahNum.toLocaleString('id-ID')} untuk ${anggotaTarget.nama} berhasil!`);
      setJumlah('');
      setKeterangan('');
      setModalOpen(null);
      fetchData();
      fetchAnggota();
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses setor saldo');
    } finally {
      setSubmitting(false);
    }
  };

  // Tarik saldo (hanya pengelola)
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

    if (!selectedAnggota) {
      toast.error('Pilih anggota terlebih dahulu');
      return;
    }

    const anggotaTarget = anggota.find(a => a.uid === selectedAnggota);
    if (!anggotaTarget) {
      toast.error('Anggota tidak ditemukan');
      return;
    }

    // Ambil saldo saat ini
    const saldoRef = doc(db, 'saldo', selectedAnggota);
    const saldoSnap = await getDoc(saldoRef);
    const currentSaldo = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;

    if (currentSaldo < jumlahNum) {
      toast.error(`Saldo ${anggotaTarget.nama} tidak mencukupi (Saldo: Rp ${currentSaldo.toLocaleString('id-ID')})`);
      return;
    }

    setSubmitting(true);
    try {
      const newSaldo = currentSaldo - jumlahNum;

      const batch = writeBatch(db);

      // Update saldo
      batch.update(saldoRef, { jumlah: newSaldo });

      // Catat transaksi
      const transaksiRef = doc(collection(db, 'transaksi_simpanan'));
      batch.set(transaksiRef, {
        userId: selectedAnggota,
        userNama: anggotaTarget.nama,
        jenis: 'tarik',
        jumlah: jumlahNum,
        timestamp: Timestamp.now(),
        saldoSetelah: newSaldo,
        keterangan: keterangan || `Tarik oleh ${userData?.nama}`,
        dibuatOleh: userData?.nama,
      });

      await batch.commit();

      toast.success(`Tarik saldo Rp ${jumlahNum.toLocaleString('id-ID')} untuk ${anggotaTarget.nama} berhasil!`);
      setJumlah('');
      setKeterangan('');
      setModalOpen(null);
      fetchData();
      fetchAnggota();
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses tarik saldo');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  // Tampilan untuk anggota (hanya lihat)
  if (!isPengelola) {
    return (
      <div className="p-6">
        <Toaster position="top-right" />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Simpanan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Lihat saldo dan riwayat transaksi Anda</p>
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

        {/* Informasi untuk anggota */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            📌 Untuk melakukan setor atau tarik saldo, silakan hubungi pengelola.
          </p>
        </div>

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
                      <p className="text-xs text-gray-400">{t.timestamp.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
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
      </div>
    );
  }

  // Tampilan untuk pengelola (full akses)
  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Simpanan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola setoran dan penarikan saldo anggota</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Filter Anggota */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-gray-500" />
          <label className="text-sm text-gray-600">Filter Anggota:</label>
        </div>
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg dark:bg-gray-700"
        >
          <option value="all">Semua Anggota (Ringkasan)</option>
          {anggota.map((a) => (
            <option key={a.uid} value={a.uid}>{a.nama}</option>
          ))}
        </select>
      </div>

      {filterUser === 'all' ? (
        // Ringkasan semua anggota
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Anggota</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center">Memuat...</td></tr>
                ) : anggota.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Belum ada anggota</td></tr>
                ) : (
                  anggota.map((a, idx) => {
                    const [saldoAnggota, setSaldoAnggota] = useState(0);
                    useEffect(() => {
                      const fetchSaldo = async () => {
                        const saldoRef = doc(db, 'saldo', a.uid);
                        const saldoSnap = await getDoc(saldoRef);
                        setSaldoAnggota(saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0);
                      };
                      fetchSaldo();
                    }, [a.uid]);
                    return (
                      <tr key={a.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{a.nama}</td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-green-600">
                          Rp {saldoAnggota.toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedAnggota(a.uid);
                              setFilterUser(a.uid);
                            }}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Pilih
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Detail saldo dan transaksi anggota terpilih
        <>
          {/* Tombol Kembali */}
          <button
            onClick={() => setFilterUser('all')}
            className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            ← Kembali ke daftar anggota
          </button>

          {/* Card Saldo */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">
                  Saldo {anggota.find(a => a.uid === filterUser)?.nama}
                </p>
                <p className="text-3xl font-bold">Rp {saldo.toLocaleString('id-ID')}</p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Wallet size={32} />
              </div>
            </div>
          </div>

          {/* Tombol Aksi untuk Pengelola */}
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
                        <p className="text-xs text-gray-400">{t.timestamp.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
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
        </>
      )}

      {/* Modal Setor */}
      {modalOpen === 'setor' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Setor Saldo</h2>
            <p className="text-sm text-gray-600 mb-4">
              Untuk: <strong>{anggota.find(a => a.uid === filterUser)?.nama}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (Opsional)</label>
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
            <p className="text-sm text-gray-600 mb-4">
              Untuk: <strong>{anggota.find(a => a.uid === filterUser)?.nama}</strong>
              <br/>
              Saldo saat ini: <strong className="text-green-600">Rp {saldo.toLocaleString('id-ID')}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah (Rp)</label>
                <input
                  type="number"
                  value={jumlah}
                  onChange={(e) => setJumlah(e.target.value)}
                  placeholder="Masukkan jumlah"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (Opsional)</label>
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