// app/dashboard/profil/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/firebase/client';
import toast, { Toaster } from 'react-hot-toast';
import { User, Mail, Phone, MapPin, KeyRound } from 'lucide-react';

export default function ProfilPage() {
  const { user, userData, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingProfil, setEditingProfil] = useState(false);
  const [formData, setFormData] = useState({
    nama: userData?.nama || '',
    noTel: userData?.noTel || '',
    alamat: userData?.alamat || '',
  });

  if (!user) return null;

  // Update profil (nama, noTel, alamat)
  const handleUpdateProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        nama: formData.nama,
        noTel: formData.noTel,
        alamat: formData.alamat,
      });
      toast.success('Profil berhasil diperbarui');
      setEditingProfil(false);
      // Refresh halaman setelah 1 detik
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memperbarui profil');
    } finally {
      setLoading(false);
    }
  };

  // Ganti password
  const handleGantiPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      toast.error('Password baru tidak cocok');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success('Password berhasil diubah! Silakan login ulang.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => logout(), 2000);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Password lama salah');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password terlalu lemah, minimal 6 karakter');
      } else {
        toast.error('Gagal mengubah password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Toaster position="top-right" />
      
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Profil Saya</h1>

      {/* Informasi Profil */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User size={20} /> Informasi Akun
          </h2>
          {!editingProfil && (
            <button
              onClick={() => setEditingProfil(true)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit Profil
            </button>
          )}
        </div>

        {!editingProfil ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <User size={18} className="text-gray-500" />
              <div><p className="text-sm text-gray-500">Nama Lengkap</p><p className="font-medium">{userData?.nama || '-'}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Mail size={18} className="text-gray-500" />
              <div><p className="text-sm text-gray-500">Email</p><p className="font-medium">{user.email}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Phone size={18} className="text-gray-500" />
              <div><p className="text-sm text-gray-500">Nomor Telepon</p><p className="font-medium">{userData?.noTel || '-'}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <MapPin size={18} className="text-gray-500" />
              <div><p className="text-sm text-gray-500">Alamat</p><p className="font-medium">{userData?.alamat || '-'}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <KeyRound size={18} className="text-gray-500" />
              <div><p className="text-sm text-gray-500">Role</p><p className="font-medium capitalize">{userData?.role || 'anggota'}</p></div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdateProfil} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
              <input type="text" value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nomor Telepon</label>
              <input type="tel" value={formData.noTel} onChange={(e) => setFormData({ ...formData, noTel: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alamat</label>
              <textarea value={formData.alamat} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditingProfil(false)} className="px-4 py-2 border rounded-lg">Batal</button>
              <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        )}
      </div>

      {/* Form Ganti Password */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><KeyRound size={20} /> Ganti Password</h2>
        <form onSubmit={handleGantiPassword} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Password Lama</label><input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" required /></div>
          <div><label className="block text-sm font-medium mb-1">Password Baru (min 6 karakter)</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" required /></div>
          <div><label className="block text-sm font-medium mb-1">Konfirmasi Password Baru</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" required /></div>
          <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Memproses...' : 'Ganti Password'}</button>
        </form>
        <p className="text-xs text-gray-500 mt-3">*Setelah ganti password, Anda akan logout dan harus login ulang.</p>
      </div>
    </div>
  );
}