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
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { HandCoins, Plus, RefreshCw, CheckCircle, Clock, XCircle } from 'lucide-react';

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
  ditolakPada?: Date;
  alasanTolak?: string;
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
  const [modalOpen, setModalOpen] = useState<'ajukan' | 'bayar' | 'setujui' | 'tolak' | null>(null);
  const [selectedPinjaman, setSelectedPinjaman] = useState<Pinjaman | null>(null);
  const [formData, setFormData] = useState({ jumlah: '', tenor: '' });
  const [bayarOption, setBayarOption] = useState<'1' | '2' | '3' | '4' | 'lunas'>('1');
  const [alasanTolak, setAlasanTolak] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const isPengelola = userData?.role === 'pengelola';

  const fetchAnggota = async () => {
    if (!isPengelola) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data = querySnapshot.docs.map(doc => ({ uid: doc.id, nama: doc.data().nama, email: doc.data().email }));
      setAnggota(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchPinjaman = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let pinjamanQuery;
      if (isPengelola) {
        pinjamanQuery = query(collection(db, 'pinjaman'), orderBy('diajukanPada', 'desc'));
      } else {
        pinjamanQuery = query(collection(db, 'pinjaman'), where('userId', '==', user.uid), orderBy('diajukanPada', 'desc'));
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
          ditolakPada: p.ditolakPada?.toDate(),
          alasanTolak: p.alasanTolak,
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

  const hitungTotal = (jumlah: number, tenor: number) => {
    const bunga = jumlah * 0.05;
    const total = jumlah + bunga;
    const angsuranPerBulan = total / tenor;
    return { total, angsuranPerBulan, bunga };
  };

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

  const handleSetujui = async () => {
    if (!selectedPinjaman) return;
    setSubmitting(true);
    try {
      const pinjamanRef = doc(db, 'pinjaman', selectedPinjaman.id);
      await updateDoc(pinjamanRef, { status: 'aktif', disetujuiPada: Timestamp.now() });
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

  const handleTolak = async () => {
    if (!selectedPinjaman) return;
    
    if (!confirm(`Yakin ingin menolak pinjaman ${selectedPinjaman.userNama}?`)) return;
    
    setSubmitting(true);
    try {
      const pinjamanRef = doc(db, 'pinjaman', selectedPinjaman.id);
      await updateDoc(pinjamanRef, {
        status: 'ditolak',
        sisa: 0,
        ditolakPada: Timestamp.now(),
        alasanTolak: alasanTolak || 'Tidak disetujui oleh pengelola',
      });
      toast.success('Pinjaman ditolak');
      setModalOpen(null);
      setSelectedPinjaman(null);
      setAlasanTolak('');
      fetchPinjaman();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menolak pinjaman');
    } finally {
      setSubmitting(false);
    }
  };

  // ========== PEMBAYARAN ANGSURAN OLEH PENGELOLA ==========
  const handleBayar = async () => {
    if (!selectedPinjaman) return;
    
    let bayarNum = 0;
    let bulanDibayar = '';
    
    if (bayarOption === 'lunas') {
      bayarNum = selectedPinjaman.sisa;
      bulanDibayar = 'Lunas';
    } else {
      const bulan = parseInt(bayarOption);
      bayarNum = selectedPinjaman.angsuranPerBulan * bulan;
      bulanDibayar = `${bulan} bulan`;
    }
    
    if (bayarNum > selectedPinjaman.sisa) {
      toast.error(`Jumlah bayar melebihi sisa pinjaman (Sisa: Rp ${selectedPinjaman.sisa.toLocaleString('id-ID')})`);
      return;
    }

    setSubmitting(true);
    try {
      const pinjamanRef = doc(db, 'pinjaman', selectedPinjaman.id);
      let newSisa = selectedPinjaman.sisa - bayarNum;
      const updateData: any = { sisa: newSisa };
      
      if (newSisa === 0) {
        updateData.status = 'lunas';
        updateData.lunasPada = Timestamp.now();
      }
      
      await updateDoc(pinjamanRef, updateData);
      
      await addDoc(collection(db, 'transaksi_pinjaman'), {
        pinjamanId: selectedPinjaman.id,
        userId: selectedPinjaman.userId,
        userNama: selectedPinjaman.userNama,
        jumlah: bayarNum,
        bulanDibayar: bulanDibayar,
        sisaSetelah: newSisa,
        timestamp: Timestamp.now(),
        dibayarOleh: userData?.nama || 'Pengelola',
      });
      
      toast.success(newSisa === 0 ? '🎉 Pinjaman lunas! 🎉' : `✅ Pembayaran ${bulanDibayar} berhasil`);
      setModalOpen(null);
      setSelectedPinjaman(null);
      setBayarOption('1');
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
      case 'pending': return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock size={12} /> Menunggu</span>;
      case 'aktif': return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"><CheckCircle size={12} /> Aktif</span>;
      case 'lunas': return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle size={12} /> Lunas</span>;
      case 'ditolak': return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 flex items-center gap-1"><XCircle size={12} /> Ditolak</span>;
      default: return null;
    }
  };

  const filteredPinjaman = filterStatus === 'all' ? pinjaman : pinjaman.filter(p => p.status === filterStatus);

  // Cek apakah opsi pembayaran valid
  const isPaymentValid = () => {
    if (!selectedPinjaman) return false;
    if (bayarOption === 'lunas') return true;
    const bulan = parseInt(bayarOption);
    const totalBayar = selectedPinjaman.angsuranPerBulan * bulan;
    return selectedPinjaman.sisa >= totalBayar;
  };

  if (!user) return null;

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pinjaman</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isPengelola ? 'Kelola pinjaman anggota' : 'Ajukan pinjaman dan pantau status'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchPinjaman} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw size={18} />
          </button>
          {!isPengelola && (
            <button onClick={() => setModalOpen('ajukan')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus size={18} /> Ajukan Pinjaman
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'pending', 'aktif', 'lunas', 'ditolak'].map((status) => (
          <button key={status} onClick={() => setFilterStatus(status)} className={`px-3 py-1.5 text-sm rounded-lg transition ${
            filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}>
            {status === 'all' ? 'Semua' : status === 'pending' ? 'Menunggu' : status === 'aktif' ? 'Aktif' : status === 'lunas' ? 'Lunas' : 'Ditolak'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : filteredPinjaman.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <HandCoins size={48} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">Belum ada data pinjaman</p>
          {!isPengelola && (
            <button onClick={() => setModalOpen('ajukan')} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Ajukan Pinjaman</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPinjaman.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  {isPengelola && <p className="text-sm text-gray-500">{p.userNama}</p>}
                  <p className="text-lg font-semibold">Rp {p.jumlah.toLocaleString('id-ID')}</p>
                  <p className="text-xs text-gray-400">Tenor: {p.tenor} bulan | Angsuran: Rp {p.angsuranPerBulan.toLocaleString('id-ID')}/bulan</p>
                  {p.status === 'ditolak' && p.alasanTolak && <p className="text-xs text-red-500 mt-1">Alasan: {p.alasanTolak}</p>}
                </div>
                {getStatusBadge(p.status)}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                <div><p className="text-gray-500">Total + Bunga</p><p className="font-medium">Rp {p.total.toLocaleString('id-ID')}</p></div>
                <div><p className="text-gray-500">Sisa</p><p className={`font-medium ${p.sisa > 0 && p.status !== 'ditolak' ? 'text-orange-600' : 'text-green-600'}`}>{p.status === 'ditolak' ? 'Ditolak' : `Rp ${p.sisa.toLocaleString('id-ID')}`}</p></div>
                <div><p className="text-gray-500">Diajukan</p><p className="text-sm">{p.diajukanPada.toLocaleDateString('id-ID')}</p></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {isPengelola && p.status === 'pending' && (
                  <>
                    <button onClick={() => { setSelectedPinjaman(p); setModalOpen('setujui'); }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Setujui</button>
                    <button onClick={() => { setSelectedPinjaman(p); setModalOpen('tolak'); setAlasanTolak(''); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Tolak</button>
                  </>
                )}
                {isPengelola && p.status === 'aktif' && (
                  <button onClick={() => { setSelectedPinjaman(p); setModalOpen('bayar'); setBayarOption('1'); }} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    Catat Pembayaran
                  </button>
                )}
                {!isPengelola && p.status === 'aktif' && (
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock size={14} />
                    Sisa Rp {p.sisa.toLocaleString('id-ID')} | Angsuran Rp {p.angsuranPerBulan.toLocaleString('id-ID')}/bulan
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ajukan Pinjaman (Anggota) */}
      {modalOpen === 'ajukan' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Ajukan Pinjaman</h2>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg"><p className="text-sm">Bunga flat 5% dari jumlah pinjaman</p></div>
            <div className="space-y-4">
              <input type="number" placeholder="Jumlah Pinjaman (Rp)" value={formData.jumlah} onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="number" placeholder="Tenor (Bulan) 1-36" value={formData.tenor} onChange={(e) => setFormData({ ...formData, tenor: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(null)} className="flex-1 px-4 py-2 border rounded-lg">Batal</button>
              <button onClick={handleAjukan} disabled={submitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{submitting ? 'Memproses...' : 'Ajukan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Setujui Pinjaman (Pengelola) */}
      {modalOpen === 'setujui' && selectedPinjaman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Setujui Pinjaman</h2>
            <div className="space-y-2 mb-4">
              <p><strong>Peminjam:</strong> {selectedPinjaman.userNama}</p>
              <p><strong>Jumlah:</strong> Rp {selectedPinjaman.jumlah.toLocaleString('id-ID')}</p>
              <p><strong>Tenor:</strong> {selectedPinjaman.tenor} bulan</p>
              <p><strong>Angsuran per bulan:</strong> Rp {selectedPinjaman.angsuranPerBulan.toLocaleString('id-ID')}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalOpen(null)} className="flex-1 px-4 py-2 border rounded-lg">Batal</button>
              <button onClick={handleSetujui} disabled={submitting} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg">Setujui</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak Pinjaman (Pengelola) */}
      {modalOpen === 'tolak' && selectedPinjaman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Tolak Pinjaman</h2>
            <textarea placeholder="Alasan penolakan (opsional)" value={alasanTolak} onChange={(e) => setAlasanTolak(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setModalOpen(null)} className="flex-1 px-4 py-2 border rounded-lg">Batal</button>
              <button onClick={handleTolak} disabled={submitting} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Tolak</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Catat Pembayaran (Pengelola) */}
      {modalOpen === 'bayar' && selectedPinjaman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Catat Pembayaran Angsuran</h2>
            <div className="space-y-3 mb-4">
              <p><strong>Peminjam:</strong> {selectedPinjaman.userNama}</p>
              <p><strong>Sisa pinjaman:</strong> Rp {selectedPinjaman.sisa.toLocaleString('id-ID')}</p>
              <p><strong>Angsuran per bulan:</strong> Rp {selectedPinjaman.angsuranPerBulan.toLocaleString('id-ID')}</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Pilih opsi pembayaran:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBayarOption('1')}
                  className={`py-2 px-3 rounded-lg border ${
                    bayarOption === '1' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  1 Bulan<br/>
                  <span className="text-xs">Rp {selectedPinjaman.angsuranPerBulan.toLocaleString('id-ID')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBayarOption('2')}
                  className={`py-2 px-3 rounded-lg border ${
                    bayarOption === '2' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  2 Bulan<br/>
                  <span className="text-xs">Rp {(selectedPinjaman.angsuranPerBulan * 2).toLocaleString('id-ID')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBayarOption('3')}
                  className={`py-2 px-3 rounded-lg border ${
                    bayarOption === '3' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  3 Bulan<br/>
                  <span className="text-xs">Rp {(selectedPinjaman.angsuranPerBulan * 3).toLocaleString('id-ID')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBayarOption('4')}
                  className={`py-2 px-3 rounded-lg border ${
                    bayarOption === '4' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Langsung Lunas<br/>
                  <span className="text-xs">Rp {selectedPinjaman.sisa.toLocaleString('id-ID')}</span>
                </button>
              </div>
            </div>

            {!isPaymentValid() && selectedPinjaman && bayarOption !== 'lunas' && (() => {
              const bulan = parseInt(bayarOption);
              const totalBayar = selectedPinjaman.angsuranPerBulan * bulan;
              if (selectedPinjaman.sisa < totalBayar) {
                return (
                  <div className="p-2 bg-red-50 text-red-600 text-sm rounded-lg mb-4">
                    ⚠️ Sisa pinjaman tidak mencukupi untuk pembayaran {bulan} bulan
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setModalOpen(null)} className="flex-1 px-4 py-2 border rounded-lg">Batal</button>
              <button 
                onClick={handleBayar} 
                disabled={submitting || !isPaymentValid()} 
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Catat Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}