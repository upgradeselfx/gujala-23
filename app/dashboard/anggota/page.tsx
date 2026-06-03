// app/dashboard/anggota/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, auth as firebaseAuth } from '@/app/firebase/client';
import { collection, getDocs, doc, deleteDoc, updateDoc, addDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import AnggotaForm from '@/components/AnggotaForm';

type Anggota = {
  uid: string;
  nama: string;
  email: string;
  noTel: string;
  alamat: string;
  role: string;
  createdAt: string;
};

export default function KelolaAnggotaPage() {
  const { userData } = useAuth();
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnggota, setEditingAnggota] = useState<Anggota | null>(null);

  // Cek akses (hanya pengelola)
  if (userData?.role !== 'pengelola') {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            ⚠️ Akses ditolak. Hanya pengelola yang dapat mengakses halaman ini.
          </p>
        </div>
      </div>
    );
  }

  const fetchAnggota = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const data = querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as Anggota[];
      setAnggota(data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data anggota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnggota();
  }, []);

  const handleTambah = async (data: { nama: string; email: string; noTel: string; alamat: string; password: string }) => {
  try {
    // Buat akun di Firebase Auth dengan password dari form
    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.password);
    const uid = userCredential.user.uid;

    // Simpan ke Firestore
    await setDoc(doc(db, 'users', uid), {
      uid,
      nama: data.nama,
      email: data.email,
      noTel: data.noTel,
      alamat: data.alamat,
      role: 'anggota',
      createdAt: new Date().toISOString()
    });

    toast.success('Anggota berhasil ditambahkan');
    fetchAnggota();
  } catch (error: any) {
    console.error(error);
    if (error.code === 'auth/email-already-in-use') {
      toast.error('Email sudah terdaftar');
    } else if (error.code === 'auth/weak-password') {
      toast.error('Password terlalu lemah (minimal 6 karakter)');
    } else {
      toast.error('Gagal menambahkan anggota');
    }
    throw error;
  }
};

  const handleEdit = async (data: { nama: string; email: string; noTel: string; alamat: string }) => {
    if (!editingAnggota) return;
    try {
      const userRef = doc(db, 'users', editingAnggota.uid);
      await updateDoc(userRef, {
        nama: data.nama,
        noTel: data.noTel,
        alamat: data.alamat,
      });
      toast.success('Anggota berhasil diupdate');
      fetchAnggota();
      setEditingAnggota(null);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengupdate anggota');
      throw error;
    }
  };

  const handleHapus = async (anggota: Anggota) => {
    if (!confirm(`Yakin ingin menghapus ${anggota.nama}?`)) return;
    try {
      // Hapus dari Firestore
      await deleteDoc(doc(db, 'users', anggota.uid));
      
      // Hapus dari Firebase Auth (perlu admin SDK, tapi skip dulu karena ribet)
      // Untuk sementara, akun Auth tetap ada. Nanti bisa dihapus manual dari console.
      
      toast.success('Anggota berhasil dihapus');
      fetchAnggota();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus anggota');
    }
  };

  return (
    <div className="p-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kelola Anggota</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tambah, edit, atau hapus data anggota</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAnggota}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus size={18} />
            Tambah Anggota
          </button>
        </div>
      </div>

      {/* Tabel Anggota */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : anggota.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Belum ada anggota. Klik "Tambah Anggota" untuk menambahkan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nama</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">No. Telepon</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Alamat</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {anggota.map((item) => (
                  <tr key={item.uid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{item.nama}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.noTel || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.alamat || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingAnggota(item);
                            setModalOpen(true);
                          }}
                          className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleHapus(item)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Hapus"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      <AnggotaForm
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAnggota(null);
        }}
        onSubmit={editingAnggota ? handleEdit : handleTambah}
        initialData={editingAnggota ? {
          nama: editingAnggota.nama,
          email: editingAnggota.email,
          noTel: editingAnggota.noTel,
          alamat: editingAnggota.alamat
        } : null}
        title={editingAnggota ? 'Edit Anggota' : 'Tambah Anggota'}
      />
    </div>
  );
}