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
  saldo?: number;
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

  // Ambil daftar anggota + saldo (tanpa hook di dalam map)
  const fetchAnggotaWithSaldo = async () => {
    if (!isPengelola) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const anggotaList = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        nama: doc.data().nama,
        email: doc.data().email,
        saldo: 0,
      }));

      // Ambil saldo untuk semua anggota
      for (const a of anggotaList) {
        const saldoRef = doc(db, 'saldo', a.uid);
        const saldoSnap = await getDoc(saldoRef);
        a.saldo = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;
      }
      
      setAnggota(anggotaList);
      if (anggotaList.length > 0 && !selectedAnggota) {
        setSelectedAnggota(anggotaList[0].uid);
      }
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data anggota');
    }
  };

  // Ambil saldo dan transaksi (untuk anggota yang dipilih)
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
      fetchAnggotaWithSaldo();
    }
  }, [user]);

  useEffect(() => {
    if ((isPengelola && anggota.length > 0) || !isPengelola) {
      fetchData();
    }
  }, [filterUser, anggota, selectedAnggota]);

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

      if (saldoSnap.exists()) {
        batch.update(saldoRef, { jumlah: newSaldo });
      } else {
        batch.set(saldoRef, { jumlah: newSaldo, userId: targetUserId });
      }

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
      fetchAnggotaWithSaldo();
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

    if (!selectedAnggota) {
      toast.error('Pilih anggota terlebih dahulu');
      return;
    }

    const anggotaTarget = anggota.find(a => a.uid === selectedAnggota);
    if (!anggotaTarget) {
      toast.error('Anggota tidak ditemukan');
      return;
    }

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
      batch.update(saldoRef, { jumlah: newSaldo });

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
      fetchAnggotaWithSaldo();
      fetchData();
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
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-1">Saldo Anda</p>
              <p className="text-3xl font-bold">Rp {saldo.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full"><Wallet size={32} /></div>
          </div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">📌 Untuk melakukan setor atau tarik saldo, silakan hubungi pengelola.</p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-4"><History size={20} className="text-gray-500" /><h2 className="text-lg font-semibold">Riwayat Transaksi</h2><button onClick={fetchData} className="ml-auto p-1 text-gray-500 hover:text-gray-700"><RefreshCw size={16} /></button></div>
          {loading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div> : transaksi.length === 0 ? <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl"><p className="text-gray-500">Belum ada transaksi</p></div> : <div className="space-y-2">{transaksi.map((t) => (<div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"><div className="flex items-center gap-3"><div className={`p-2 rounded-full ${t.jenis === 'setor' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>{t.jenis === 'setor' ? <ArrowUpCircle size={18} className="text-green-600" /> : <ArrowDownCircle size={18} className="text-orange-600" />}</div><div><p className="font-medium">{t.jenis === 'setor' ? 'Setor Saldo' : 'Tarik Saldo'}</p>{t.keterangan && <p className="text-xs text-gray-400">{t.keterangan}</p>}<p className="text-xs text-gray-400">{t.timestamp.toLocaleDateString('id-ID')}</p></div></div><div className="text-right"><p className={`font-semibold ${t.jenis === 'setor' ? 'text-green-600' : 'text-orange-600'}`}>{t.jenis === 'setor' ? '+' : '-'} Rp {t.jumlah.toLocaleString('id-ID')}</p><p className="text-xs text-gray-400">Saldo: Rp {t.saldoSetelah.toLocaleString('id-ID')}</p></div></div>))}</div>}
        </div>
      </div>
    );
  }

  // Tampilan untuk pengelola (full akses)
  return (
    <div className="p-6">
      <Toaster position="top-right" />
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">Simpanan</h1><button onClick={() => { fetchAnggotaWithSaldo(); fetchData(); }}><RefreshCw size={18} /></button></div>
      <div className="mb-4 flex items-center gap-3 flex-wrap"><Users size={18} /><label className="text-sm">Filter Anggota:</label><select value={filterUser} onChange={(e) => { setFilterUser(e.target.value); if (e.target.value !== 'all') setSelectedAnggota(e.target.value); }} className="px-3 py-1.5 border rounded-lg"><option value="all">Semua Anggota (Ringkasan)</option>{anggota.map(a => <option key={a.uid} value={a.uid}>{a.nama}</option>)}</select></div>
      {filterUser === 'all' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left">No</th><th>Nama</th><th className="text-right">Saldo</th><th className="text-center">Aksi</th></tr></thead><tbody>{anggota.map((a, idx) => (<tr key={a.uid}><td className="px-6 py-4">{idx+1}</td><td className="font-medium">{a.nama}</td><td className="text-right text-green-600">Rp {(a.saldo || 0).toLocaleString('id-ID')}</td><td className="text-center"><button onClick={() => { setSelectedAnggota(a.uid); setFilterUser(a.uid); }} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg">Pilih</button></td></tr>))}</tbody></table></div></div>
      ) : (
        <>
          <button onClick={() => setFilterUser('all')} className="mb-4 text-blue-600">← Kembali ke daftar anggota</button>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 mb-6 text-white"><p className="text-blue-100">Saldo {anggota.find(a => a.uid === filterUser)?.nama}</p><p className="text-3xl font-bold">Rp {saldo.toLocaleString('id-ID')}</p></div>
          <div className="flex gap-3 mb-6"><button onClick={() => setModalOpen('setor')} className="flex-1 py-3 bg-green-600 text-white rounded-xl">Setor Saldo</button><button onClick={() => setModalOpen('tarik')} className="flex-1 py-3 bg-orange-600 text-white rounded-xl">Tarik Saldo</button></div>
          <h2 className="text-lg font-semibold mb-4">Riwayat Transaksi</h2>
          {transaksi.map(t => (<div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl mb-2"><div><p className="font-medium">{t.jenis === 'setor' ? 'Setor' : 'Tarik'}</p><p className="text-xs text-gray-400">{t.timestamp.toLocaleDateString('id-ID')}</p></div><p className={`font-semibold ${t.jenis === 'setor' ? 'text-green-600' : 'text-orange-600'}`}>{t.jenis === 'setor' ? '+' : '-'} Rp {t.jumlah.toLocaleString('id-ID')}</p></div>))}
        </>
      )}
      {modalOpen === 'setor' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md"><h2 className="text-xl font-semibold mb-4">Setor Saldo</h2><p className="text-sm mb-4">Untuk: <strong>{anggota.find(a => a.uid === filterUser)?.nama}</strong></p><input type="number" placeholder="Jumlah" value={jumlah} onChange={(e) => setJumlah(e.target.value)} className="w-full px-3 py-2 border rounded-lg mb-4" /><input type="text" placeholder="Keterangan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="w-full px-3 py-2 border rounded-lg mb-4" /><div className="flex gap-3"><button onClick={() => setModalOpen(null)} className="flex-1 py-2 border rounded-lg">Batal</button><button onClick={handleSetor} disabled={submitting} className="flex-1 py-2 bg-green-600 text-white rounded-lg">{submitting ? 'Memproses...' : 'Setor'}</button></div></div></div>)}
      {modalOpen === 'tarik' && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md"><h2 className="text-xl font-semibold mb-4">Tarik Saldo</h2><p className="text-sm mb-4">Untuk: <strong>{anggota.find(a => a.uid === filterUser)?.nama}</strong><br/>Saldo: <strong className="text-green-600">Rp {saldo.toLocaleString('id-ID')}</strong></p><input type="number" placeholder="Jumlah" value={jumlah} onChange={(e) => setJumlah(e.target.value)} className="w-full px-3 py-2 border rounded-lg mb-4" /><input type="text" placeholder="Keterangan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="w-full px-3 py-2 border rounded-lg mb-4" /><div className="flex gap-3"><button onClick={() => setModalOpen(null)} className="flex-1 py-2 border rounded-lg">Batal</button><button onClick={handleTarik} disabled={submitting} className="flex-1 py-2 bg-orange-600 text-white rounded-lg">{submitting ? 'Memproses...' : 'Tarik'}</button></div></div></div>)}
    </div>
  );
}