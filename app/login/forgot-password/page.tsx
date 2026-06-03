'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/app/firebase/client';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      toast.success('Email reset password telah dikirim');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        toast.error('Email tidak ditemukan');
      } else {
        toast.error('Gagal mengirim email reset');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <Toaster position="top-right" />
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center">Lupa Password</h2>
        {!sent ? (
          <form onSubmit={handleReset} className="space-y-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Masukkan email Anda, kami akan mengirimkan link reset password.</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" required />
            <button type="submit" disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Mengirim...' : 'Kirim Email Reset'}</button>
            <Link href="/login" className="block text-center text-sm text-blue-600">Kembali ke Login</Link>
          </form>
        ) : (
          <div className="text-center">
            <p className="text-green-600 mb-4">Email reset password telah dikirim ke {email}</p>
            <Link href="/login" className="block mt-4 text-blue-600">Kembali ke Login</Link>
          </div>
        )}
      </div>
    </div>
  );
}