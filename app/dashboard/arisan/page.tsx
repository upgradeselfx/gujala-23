// app/dashboard/arisan/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/app/firebase/client';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  Timestamp,
  writeBatch,
  where
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { Trophy, Plus, Crown, Gift, History, RefreshCw, Users, CheckCircle } from 'lucide-react';
type Anggota = {
  uid: string;
  nama: string;
  email: string;
  saldo?: number;
};

type SesiArisan = {
  id: string;
  periode: string; // format: "Januari 2025"
  bulan: number;
  tahun: number;
  pemenangId: string;
  pemenangNama: string;
  jumlahPotongan: number;
  status: 'selesai' | 'berlangsung';
  createdAt: Date;
  pengumumanId?: string;
};

export default function ArisanPage() {
  const { user, userData } = useAuth();
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [sesiArisan, setSesiArisan] = useState<SesiArisan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState<'buat' | 'detail' | null>(null);
  const [selectedSesi, setSelectedSesi] = useState<SesiArisan | null>(null);
  const [formData, setFormData] = useState({
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
    jumlahPotongan: 50000,
  });
  const [pemenangTerpilih, setPemenangTerpilih] = useState<string>('');

  const isPengelola = userData?.role === 'pengelola';

  // Ambil daftar anggota beserta saldo dari simpanan
  const fetchAnggotaWithSaldo = async () => {
    try {
      const anggotaSnapshot = await getDocs(collection(db, 'users'));
      const anggotaList = anggotaSnapshot.docs.map(doc => ({
        uid: doc.id,
        nama: doc.data().nama,
        email: doc.data().email,
      }));

      // Ambil saldo setiap anggota
      const anggotaWithSaldo: Anggota[] = [];
      for (const a of anggotaList) {
        const saldoRef = doc(db, 'saldo', a.uid);
        const saldoSnap = await getDoc(saldoRef);
        const saldo = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;
        anggotaWithSaldo.push({ ...a, saldo });
      }
      setAnggota(anggotaWithSaldo);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data anggota');
    }
  };

  // Ambil riwayat arisan
  const fetchSesiArisan = async () => {
    try {
      const arisanQuery = query(
        collection(db, 'arisan_sesi'),
        orderBy('tahun', 'desc'),
        orderBy('bulan', 'desc')
      );
      const arisanSnapshot = await getDocs(arisanQuery);
      const data = arisanSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as SesiArisan[];
      setSesiArisan(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat riwayat arisan');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchAnggotaWithSaldo();
      await fetchSesiArisan();
      setLoading(false);
    };
    loadData();
  }, []);

  // Generate nama bulan
  const getNamaBulan = (bulan: number) => {
    const bulanList = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return bulanList[bulan - 1];
  };

  // Cek apakah sesi untuk bulan-tahun sudah ada
  const cekSesiExist = () => {
    return sesiArisan.some(
      s => s.bulan === formData.bulan && s.tahun === formData.tahun
    );
  };

  // Pilih pemenang secara acak (atau bisa manual nanti)
  const pilihPemenangAcak = () => {
    if (anggota.length === 0) {
      toast.error('Belum ada anggota');
      return;
    }
    const anggotaAktif = anggota.filter(a => a.saldo !== undefined);
    if (anggotaAktif.length === 0) {
      toast.error('Tidak ada anggota yang memiliki saldo');
      return;
    }
    const randomIndex = Math.floor(Math.random() * anggotaAktif.length);
    const pemenang = anggotaAktif[randomIndex];
    setPemenangTerpilih(pemenang.uid);
    toast.success(`Pemenang: ${pemenang.nama}`);
  };

  // Buat sesi arisan baru
  const handleBuatSesi = async () => {
    if (!isPengelola) return;
    
    if (cekSesiExist()) {
      toast.error(`Sesi arisan untuk ${getNamaBulan(formData.bulan)} ${formData.tahun} sudah ada`);
      return;
    }

    if (!pemenangTerpilih) {
      toast.error('Pilih pemenang terlebih dahulu');
      return;
    }

    const pemenang = anggota.find(a => a.uid === pemenangTerpilih);
    if (!pemenang) {
      toast.error('Pemenang tidak ditemukan');
      return;
    }

    if ((pemenang.saldo || 0) < formData.jumlahPotongan) {
      toast.error(`Saldo ${pemenang.nama} tidak cukup untuk dipotong Rp ${formData.jumlahPotongan.toLocaleString('id-ID')}`);
      return;
    }

    setSubmitting(true);
    try {
      const batch = writeBatch(db);

      // 1. Potong saldo pemenang
      const saldoRef = doc(db, 'saldo', pemenang.uid);
      const saldoSnap = await getDoc(saldoRef);
      const currentSaldo = saldoSnap.exists() ? saldoSnap.data().jumlah || 0 : 0;
      const newSaldo = currentSaldo - formData.jumlahPotongan;
      batch.update(saldoRef, { jumlah: newSaldo });

      // 2. Catat transaksi potongan
      batch.add(collection(db, 'transaksi_simpanan'), {
        userId: pemenang.uid,
        userNama: pemenang.nama,
        jenis: 'tarik',
        jumlah: formData.jumlahPotongan,
        keterangan: `Potongan arisan ${getNamaBulan(formData.bulan)} ${formData.tahun}`,
        timestamp: Timestamp.now(),
        saldoSetelah: newSaldo,
      });

      // 3. Catat ke kas arisan
      batch.add(collection(db, 'kas_arisan'), {
        userId: pemenang.uid,
        userNama: pemenang.nama,
        bulan: formData.bulan,
        tahun: formData.tahun,
        jumlah: formData.jumlahPotongan,
        createdAt: Timestamp.now(),
      });

      // 4. Buat sesi arisan
      const periode = `${getNamaBulan(formData.bulan)} ${formData.tahun}`;
      const arisanRef = doc(collection(db, 'arisan_sesi'));
      batch.set(arisanRef, {
        periode,
        bulan: formData.bulan,
        tahun: formData.tahun,
        pemenangId: pemenang.uid,
        pemenangNama: pemenang.nama,
        jumlahPotongan: formData.jumlahPotongan,
        status: 'selesai',
        createdAt: Timestamp.now(),
      });

      // 5. Buat pengumuman otomatis
      const pengumumanRef = doc(collection(db, 'pengumuman'));
      batch.set(pengumumanRef, {
        judul: `🎉 Hasil Arisan ${periode}`,
        isi: `Selamat kepada **${pemenang.nama}** yang terpilih sebagai pemenang arisan periode ${periode} dengan potongan sebesar Rp ${formData.jumlahPotongan.toLocaleString('id-ID')}.\n\nTerima kasih kepada semua anggota yang telah berpartisipasi.`,
        kategori: 'arisan',
        createdAt: Timestamp.now(),
        createdBy: userData?.nama || 'Pengelola',
      });

      await batch.commit();

      toast.success(`Sesi arisan ${periode} berhasil dibuat! Pemenang: ${pemenang.nama}`);
      setModalOpen(null);
      setPemenangTerpilih('');
      setFormData({
        bulan: new Date().getMonth() + 1,
        tahun: new Date().getFullYear(),
        jumlahPotongan: 50000,
      });
      
      // Refresh data
      await fetchAnggotaWithSaldo();
      await fetchSesiArisan();
    } catch (error) {
      console.error(error);
      toast.error('Gagal membuat sesi arisan');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Arisan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola arisan bulanan, pilih pemenang, dan lihat riwayat
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchAnggotaWithSaldo();
              fetchSesiArisan();
            }}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          {isPengelola && (
            <button
              onClick={() => setModalOpen('buat')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              <Plus size={18} />
              Buat Sesi Arisan
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Users size={16} />
            <p className="text-sm">Total Anggota</p>
          </div>
          <p className="text-2xl font-bold">{anggota.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Trophy size={16} />
            <p className="text-sm">Total Sesi</p>
          </div>
          <p className="text-2xl font-bold">{sesiArisan.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Crown size={16} />
            <p className="text-sm">Pemenang Terakhir</p>
          </div>
          <p className="text-lg font-medium truncate">
            {sesiArisan[0]?.pemenangNama || '-'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Gift size={16} />
            <p className="text-sm">Total Kas Arisan</p>
          </div>
          <p className="text-2xl font-bold">
            Rp {(sesiArisan.reduce((sum, s) => sum + s.jumlahPotongan, 0)).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Riwayat Arisan */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <History size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Riwayat Arisan</h2>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : sesiArisan.length === 0 ? (
          <div className="text-center py-12">
            <Trophy size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500">Belum ada sesi arisan</p>
            {isPengelola && (
              <button
                onClick={() => setModalOpen('buat')}
                className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
              Buat Sesi Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sesiArisan.map((sesi) => (
              <div
                key={sesi.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                onClick={() => {
                  setSelectedSesi(sesi);
                  setModalOpen('detail');
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Crown size={16} className="text-yellow-500" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {sesi.periode}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Pemenang: <span className="font-medium text-purple-600">{sesi.pemenangNama}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      Potongan: Rp {sesi.jumlahPotongan.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      <CheckCircle size={12} /> Selesai
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Buat Sesi Arisan */}
      {modalOpen === 'buat' && isPengelola && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Buat Sesi Arisan Baru</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bulan
                  </label>
                  <select
                    value={formData.bulan}
                    onChange={(e) => setFormData({ ...formData, bulan: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  >
                    {bulanList.map(b => (
                      <option key={b.value} value={b.value}>{b.nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tahun
                  </label>
                  <select
                    value={formData.tahun}
                    onChange={(e) => setFormData({ ...formData, tahun: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  >
                    {tahunList.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Jumlah Potongan (Rp)
                </label>
                <input
                  type="number"
                  value={formData.jumlahPotongan}
                  onChange={(e) => setFormData({ ...formData, jumlahPotongan: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  placeholder="Misal: 50000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pilih Pemenang
                </label>
                {pemenangTerpilih ? (
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg mb-2">
                    <span className="text-green-700 dark:text-green-400">
                      Pemenang: {anggota.find(a => a.uid === pemenangTerpilih)?.nama}
                    </span>
                    <button
                      onClick={() => setPemenangTerpilih('')}
                      className="text-sm text-red-500"
                    >
                      Ubah
                    </button>
                  </div>
                ) : null}
                
                <select
                  value={pemenangTerpilih}
                  onChange={(e) => setPemenangTerpilih(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 mb-2"
                >
                  <option value="">-- Pilih Pemenang --</option>
                  {anggota.map(a => (
                    <option key={a.uid} value={a.uid}>
                      {a.nama} (Saldo: Rp {(a.saldo || 0).toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
                
                <button
                  type="button"
                  onClick={pilihPemenangAcak}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  🎲 Pilih Acak
                </button>
              </div>

              {pemenangTerpilih && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ Saldo pemenang akan dipotong Rp {formData.jumlahPotongan.toLocaleString('id-ID')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setModalOpen(null);
                  setPemenangTerpilih('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleBuatSesi}
                disabled={submitting || !pemenangTerpilih}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Buat Sesi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Arisan */}
      {modalOpen === 'detail' && selectedSesi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={24} className="text-yellow-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedSesi.periode}
              </h2>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <span className="text-gray-600">🏆 Pemenang</span>
                <span className="font-bold text-purple-600">{selectedSesi.pemenangNama}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-600">💰 Potongan</span>
                <span className="font-medium">Rp {selectedSesi.jumlahPotongan.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-600">📅 Tanggal</span>
                <span>{selectedSesi.createdAt.toLocaleDateString('id-ID')}</span>
              </div>
            </div>

            <button
              onClick={() => setModalOpen(null)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}