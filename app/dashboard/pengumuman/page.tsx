// app/dashboard/pengumuman/page.tsx
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
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { Megaphone, Plus, Pencil, Trash2, RefreshCw, Calendar, User } from 'lucide-react';

type Pengumuman = {
  id: string;
  judul: string;
  isi: string;
  kategori?: string;
  createdAt: Date;
  createdBy: string;
};

export default function PengumumanPage() {
  const { user, userData } = useAuth();
  const [pengumuman, setPengumuman] = useState<Pengumuman[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState<'tambah' | 'edit' | null>(null);
  const [selectedPengumuman, setSelectedPengumuman] = useState<Pengumuman | null>(null);
  const [formData, setFormData] = useState({
    judul: '',
    isi: '',
    kategori: 'umum',
  });

  const isPengelola = userData?.role === 'pengelola';

  // Ambil semua pengumuman (urut dari terbaru)
  const fetchPengumuman = async () => {
    setLoading(true);
    try {
      const pengumumanQuery = query(
        collection(db, 'pengumuman'),
        orderBy('createdAt', 'desc')
      );
      const pengumumanSnapshot = await getDocs(pengumumanQuery);
      const data = pengumumanSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Pengumuman[];
      setPengumuman(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat pengumuman');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPengumuman();
  }, []);

  // Tambah pengumuman (hanya pengelola)
  const handleTambah = async () => {
    if (!formData.judul.trim() || !formData.isi.trim()) {
      toast.error('Judul dan isi pengumuman harus diisi');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'pengumuman'), {
        judul: formData.judul,
        isi: formData.isi,
        kategori: formData.kategori,
        createdAt: Timestamp.now(),
        createdBy: userData?.nama || 'Pengelola',
      });

      toast.success('Pengumuman berhasil ditambahkan');
      setModalOpen(null);
      setFormData({ judul: '', isi: '', kategori: 'umum' });
      fetchPengumuman();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menambahkan pengumuman');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit pengumuman (hanya pengelola)
  const handleEdit = async () => {
    if (!selectedPengumuman) return;
    if (!formData.judul.trim() || !formData.isi.trim()) {
      toast.error('Judul dan isi pengumuman harus diisi');
      return;
    }

    setSubmitting(true);
    try {
      const pengumumanRef = doc(db, 'pengumuman', selectedPengumuman.id);
      await updateDoc(pengumumanRef, {
        judul: formData.judul,
        isi: formData.isi,
        kategori: formData.kategori,
        updatedAt: Timestamp.now(),
      });

      toast.success('Pengumuman berhasil diupdate');
      setModalOpen(null);
      setSelectedPengumuman(null);
      setFormData({ judul: '', isi: '', kategori: 'umum' });
      fetchPengumuman();
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengupdate pengumuman');
    } finally {
      setSubmitting(false);
    }
  };

  // Hapus pengumuman (hanya pengelola)
  const handleHapus = async (pengumuman: Pengumuman) => {
    if (!confirm(`Yakin ingin menghapus pengumuman "${pengumuman.judul}"?`)) return;

    try {
      await deleteDoc(doc(db, 'pengumuman', pengumuman.id));
      toast.success('Pengumuman berhasil dihapus');
      fetchPengumuman();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus pengumuman');
    }
  };

  // Format tanggal
  const formatTanggal = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) return null;

  return (
    <div className="p-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengumuman</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Informasi dan pengumuman terbaru untuk anggota
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPengumuman}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          {isPengelola && (
            <button
              onClick={() => {
                setFormData({ judul: '', isi: '', kategori: 'umum' });
                setModalOpen('tambah');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Plus size={18} />
              Buat Pengumuman
            </button>
          )}
        </div>
      </div>

      {/* Daftar Pengumuman */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : pengumuman.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Megaphone size={48} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Belum ada pengumuman</p>
          {isPengelola && (
            <button
              onClick={() => {
                setFormData({ judul: '', isi: '', kategori: 'umum' });
                setModalOpen('tambah');
              }}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Buat Pengumuman Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {pengumuman.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone size={16} className="text-blue-500" />
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                        {item.judul}
                      </h3>
                      {item.kategori && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          {item.kategori}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatTanggal(item.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {item.createdBy}
                      </span>
                    </div>
                  </div>
                  {isPengelola && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedPengumuman(item);
                          setFormData({
                            judul: item.judul,
                            isi: item.isi,
                            kategori: item.kategori || 'umum',
                          });
                          setModalOpen('edit');
                        }}
                        className="p-1.5 text-gray-500 hover:text-blue-600 transition"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleHapus(item)}
                        className="p-1.5 text-gray-500 hover:text-red-600 transition"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {item.isi}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah/Edit Pengumuman */}
      {(modalOpen === 'tambah' || modalOpen === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {modalOpen === 'tambah' ? 'Buat Pengumuman Baru' : 'Edit Pengumuman'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Judul <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.judul}
                  onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  placeholder="Masukkan judul pengumuman"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Kategori
                </label>
                <select
                  value={formData.kategori}
                  onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                >
                  <option value="umum">Umum</option>
                  <option value="penting">Penting</option>
                  <option value="pengumuman">Pengumuman</option>
                  <option value="arisan">Arisan</option>
                  <option value="cash">Cash Bulanan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Isi Pengumuman <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.isi}
                  onChange={(e) => setFormData({ ...formData, isi: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  placeholder="Tulis isi pengumuman di sini..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setModalOpen(null);
                  setSelectedPengumuman(null);
                  setFormData({ judul: '', isi: '', kategori: 'umum' });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                Batal
              </button>
              <button
                onClick={modalOpen === 'tambah' ? handleTambah : handleEdit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}