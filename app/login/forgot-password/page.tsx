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
    if (!email) {
      toast.error('Masukkan email Anda');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setSent(true);
      toast.success('Email reset password telah dikirim');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/user-not-found') {
        toast.error('Email tidak terdaftar');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Email tidak valid');
      } else {
        toast.error('Gagal mengirim email reset. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <Toaster position="top-right" />
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Lupa Password</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Masukkan email Anda, kami akan mengirimkan link reset password
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="email@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Mengirim...' : 'Kirim Email Reset'}
            </button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-blue-600 hover:underline">
                Kembali ke Login
              </Link>
            </div>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200">
                ✅ Email reset password telah dikirim ke <strong>{email}</strong>
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cek inbox atau folder spam Anda. Link reset hanya berlaku 1 jam.
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Kembali ke Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}