// app/dashboard/pinjaman/page.tsx
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
  updateDoc,
  doc,
  getDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { HandCoins, Plus, Eye, RefreshCw, CheckCircle, Clock } from 'lucide-react';

type Pinjaman = {
  id: string;
  userId: string;
  userNama: string;
  jumlah: number;
  tenor: number;
  bunga: number;
  total: number;
  angsuranPerBulan: number;
  sisa: number;
  status: 'pending' | 'aktif' | 'lunas' | 'ditolak';
  diajukanPada: Date;
  disetujuiPada?: Date;
  lunasPada?: Date;
};

type Anggota = {
  uid: string;
  nama: string;
  email: string;
};

export default function PinjamanPage() {
  const { user, userData } = useAuth();
  const [pinjaman, setPinjaman] = useState<Pinjaman[]>([]);
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState<'ajukan' | 'bayar' | 'setujui' | null>(null);
  const [selectedPinjaman, setSelectedPinjaman] = useState<Pinjaman | null>(null);
  const [formData, setFormData] = useState({
    jumlah: '',
    tenor: '',
  });
  const [bayarAmount, setBayarAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const isPengelola = userData?.role === 'pengelola';

  // Ambil daftar anggota (untuk pengelola)
  const fetchAnggota = async () => {
    if (!isPengelola) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        nama: doc.data().nama,
        email: doc.data().email
      }));
      setAnggota(data);
    } catch (error) {
      console.error(error);
    }
  };

  // Ambil data pinjaman
  const fetchPinjaman = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let pinjamanQuery;
      if (isPengelola) {
        pinjamanQuery = query(
          collection(db, 'pinjaman'),
          orderBy('diajukanPada', 'desc')
        );
      } else {
        pinjamanQuery = query(
          collection(db, 'pinjaman'),
          where('userId', '==', user.uid),
          orderBy('diajukanPada', 'desc')
        );
      }

      const pinjamanSnap = await getDocs(pinjamanQuery);
      const data: Pinjaman[] = [];
      
      for (const docSnap of pinjamanSnap.docs) {
        const p = docSnap.data();
        let userNama = p.userNama || '';
        if (isPengelola && !userNama) {
          const userDoc = await getDoc(doc(db, 'users', p.userId));
          userNama = userDoc.exists() ? userDoc.data().nama : p.userId;
        }
        data.push({
          id: docSnap.id,
          userId: p.userId,
          userNama: userNama,
          jumlah: p.jumlah,
          tenor: p.tenor,
          bunga: p.bunga,
          total: p.total,
          angsuranPerBulan: p.angsuranPerBulan,
          sisa: p.sisa,
          status: p.status,
          diajukanPada: p.diajukanPada?.toDate() || new Date(),
          disetujuiPada: p.disetujuiPada?.toDate(),
          lunasPada: p.lunasPada?.toDate(),
        });
      }
      setPinjaman(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data pinjaman');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnggota();
      fetchPinjaman();
    }
  }, [user]);

  // Hitung total pinjaman dengan bunga flat 5%
  const hitungTotal = (jumlah: number, tenor: number) => {
    const bunga = jumlah * 0.05; // 5% flat //(0.010 <-- 10%)
    const total = jumlah + bunga;
    const angsuranPerBulan = total / tenor;
    return { total, angsuranPerBulan, bunga };
  };

  // Ajukan pinjaman
  const handleAjukan = async () => {
    const jumlahNum = parseInt(formData.jumlah);
    const tenorNum = parseInt(formData.tenor);

    if (isNaN(jumlahNum) || jumlahNum <= 0) {
      toast.error('Masukkan jumlah pinjaman yang valid');
      return;
    }
    if (isNaN(tenorNum) || tenorNum < 1 || tenorNum > 36) {
      toast.error('Tenor harus antara 1-36 bulan');
      return;
    }

    setSubmitting(true);
    try {
      const { total, angsuranPerBulan, bunga } = hitungTotal(jumlahNum, tenorNum);

      await addDoc(collection(db, 'pinjaman'), {
        userId: user!.uid,
        userNama: userData?.nama || '',
        jumlah: jumlahNum,
        tenor: tenorNum,
        bunga: bunga,
        total: total,
        angsuranPerBulan: angsuranPerBulan,
        sisa: total,
        status: 'pending',
        diajukanPada: Timestamp.now(),
      });

      toast.success('Pinjaman berhasil diajukan! Menunggu persetujuan pengelola.');
      setModalOpen(null);
      setFormData({ jumlah: '', tenor: '' });
      fetchPinjaman();
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengajukan pinjaman');
    } finally {
      setSubmitting(false);
    }
  };

  // Setujui pinjaman (hanya pengelola)
  const handleSetujui = async () => {
    if (!selectedPinjaman) return;
    setSubmitting(true);
    try {
      const pinjamanRef = doc(db, 'pinjaman', selectedPinjaman.id);
      await updateDoc(pinjamanRef, {
        status: 'aktif',
        disetujuiPada: Timestamp.now(),
      });

      toast.success('Pinjaman disetujui');
      setModalOpen(null);
      setSelectedPinjaman(null);
      fetchPinjaman();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyetujui pinjaman');
    } finally {
      setSubmitting(false);
    }
  };

  // Bayar angsuran
  const handleBayar = async () => {
    if (!selectedPinjaman) return;
    const bayarNum = parseInt(bayarAmount);
    if (isNaN(bayarNum) || bayarNum <= 0) {
      toast.error('Masukkan jumlah bayar yang valid');
      return;
    }

    setSubmitting(true);
    try {
      const pinjamanRef = doc(db, 'pinjaman', selectedPinjaman.id);
      let newSisa = selectedPinjaman.sisa - bayarNum;

      if (newSisa < 0) {
        toast.error('Jumlah bayar melebihi sisa pinjaman');
        setSubmitting(false);
        return;
      }

      const updateData: any = {
        sisa: newSisa,
      };

      if (newSisa === 0) {
        updateData.status = 'lunas';
        updateData.lunasPada = Timestamp.now();
      }

      await updateDoc(pinjamanRef, updateData);

      // Catat transaksi pembayaran
      await addDoc(collection(db, 'transaksi_pinjaman'), {
        pinjamanId: selectedPinjaman.id,
        userId: selectedPinjaman.userId,
        userNama: selectedPinjaman.userNama,
        jumlah: bayarNum,
        sisaSetelah: newSisa,
        timestamp: Timestamp.now(),
      });

      toast.success(newSisa === 0 ? 'Pinjaman lunas! 🎉' : 'Pembayaran berhasil');
      setModalOpen(null);
      setSelectedPinjaman(null);
      setBayarAmount('');
      fetchPinjaman();
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Menunggu</span>;
      case 'aktif':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Aktif</span>;
      case 'lunas':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Lunas</span>;
      case 'ditolak':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Ditolak</span>;
      default:
        return null;
    }
  };

  const filteredPinjaman = filterStatus === 'all' 
    ? pinjaman 
    : pinjaman.filter(p => p.status === filterStatus);

  if (!user) return null;

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pinjaman</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Ajukan pinjaman, bayar angsuran, atau kelola pinjaman anggota
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPinjaman}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          {!isPengelola && (
            <button
              onClick={() => setModalOpen('ajukan')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Plus size={18} />
              Ajukan Pinjaman
            </button>
          )}
        </div>
      </div>

      {/* Filter Status */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'aktif', 'lunas'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${
              filterStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? 'Semua' : status === 'pending' ? 'Menunggu' : status === 'aktif' ? 'Aktif' : 'Lunas'}
          </button>
        ))}
      </div>

      {/* Daftar Pinjaman */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredPinjaman.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <HandCoins size={48} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Belum ada data pinjaman</p>
          {!isPengelola && (
            <button
              onClick={() => setModalOpen('ajukan')}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ajukan Pinjaman
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPinjaman.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  {isPengelola && (
                    <p className="text-sm text-gray-500">{p.userNama}</p>
                  )}
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    Rp {p.jumlah.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-400">
                    Tenor: {p.tenor} bulan | Angsuran: Rp {p.angsuranPerBulan.toLocaleString('id-ID')}/bulan
                  </p>
                </div>
                {getStatusBadge(p.status)}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                <div>
                  <p className="text-gray-500">Total + Bunga</p>
                  <p className="font-medium">Rp {p.total.toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-gray-500">Sisa</p>
                  <p className={`font-medium ${p.sisa > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    Rp {p.sisa.toLocaleString('id-ID')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Diajukan</p>
                  <p className="text-sm">{p.diajukanPada.toLocaleDateString('id-ID')}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {isPengelola && p.status === 'pending' && (
                  <button
                    onClick={() => {
                      setSelectedPinjaman(p);
                      setModalOpen('setujui');
                    }}
                    className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    Setujui
                  </button>
                )}
                {p.status === 'aktif' && (
                  <button
                    onClick={() => {
                      setSelectedPinjaman(p);
                      setModalOpen('bayar');
                      setBayarAmount('');
                    }}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Bayar Angsuran
                  </button>
                )}
                {p.status === 'aktif' && !isPengelola && (
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock size={14} />
                    Sisa Rp {p.sisa.toLocaleString('id-ID')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ajukan Pinjaman */}
      {modalOpen === 'ajukan' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Ajukan Pinjaman</h2>
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">Bunga flat 5% dari jumlah pinjaman</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Jumlah Pinjaman (Rp)
                </label>
                <input
                  type="number"
                  value={formData.jumlah}
                  onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  placeholder="Misal: 1000000"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tenor (Bulan)
                </label>
                <input
                  type="number"
                  value={formData.tenor}
                  onChange={(e) => setFormData({ ...formData, tenor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  placeholder="1 - 36 bulan"
                />
              </div>
              {formData.jumlah && formData.tenor && (
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm">Total yang harus dibayar: <strong>Rp {(parseInt(formData.jumlah) * 1.05).toLocaleString('id-ID')}</strong></p>
                  <p className="text-xs text-gray-500">Angsuran per bulan: Rp {(parseInt(formData.jumlah) * 1.05 / parseInt(formData.tenor)).toLocaleString('id-ID')}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalOpen(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleAjukan}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Ajukan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Setujui Pinjaman (Pengelola) */}
      {modalOpen === 'setujui' && selectedPinjaman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Setujui Pinjaman</h2>
            <div className="space-y-3 mb-6">
              <p><strong>Peminjam:</strong> {selectedPinjaman.userNama}</p>
              <p><strong>Jumlah:</strong> Rp {selectedPinjaman.jumlah.toLocaleString('id-ID')}</p>
              <p><strong>Tenor:</strong> {selectedPinjaman.tenor} bulan</p>
              <p><strong>Total + Bunga (5%):</strong> Rp {selectedPinjaman.total.toLocaleString('id-ID')}</p>
              <p><strong>Angsuran per bulan:</strong> Rp {selectedPinjaman.angsuranPerBulan.toLocaleString('id-ID')}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setModalOpen(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleSetujui}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Setujui'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bayar Angsuran */}
      {modalOpen === 'bayar' && selectedPinjaman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Bayar Angsuran</h2>
            <div className="space-y-3 mb-4">
              <p><strong>Sisa pinjaman:</strong> Rp {selectedPinjaman.sisa.toLocaleString('id-ID')}</p>
              <p><strong>Angsuran per bulan (rekomendasi):</strong> Rp {selectedPinjaman.angsuranPerBulan.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Jumlah Bayar (Rp)
              </label>
              <input
                type="number"
                value={bayarAmount}
                onChange={(e) => setBayarAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                placeholder="Masukkan jumlah"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalOpen(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleBayar}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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