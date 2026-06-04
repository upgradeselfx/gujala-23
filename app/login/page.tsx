'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/app/firebase/client';
import { logActivity } from '@/lib/activityLogger';
import toast, { Toaster } from 'react-hot-toast';

const sanitizeInput = (input: string) => {
  return input.replace(/[<>]/g, '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  const getRemainingAttempts = () => {
    if (blockedUntil && Date.now() < blockedUntil) return 0;
    return 5 - loginAttempts;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanEmail = sanitizeInput(email);
    const cleanPassword = sanitizeInput(password);
    
    if (blockedUntil && Date.now() < blockedUntil) {
      const waitSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
      setError(`⛔ Terlalu banyak percobaan. Coba lagi setelah ${waitSeconds} detik.`);
      return;
    }

    if (blockedUntil && Date.now() >= blockedUntil) {
      setBlockedUntil(null);
      setLoginAttempts(0);
    }

    setLoading(true);

    try {
      await login(cleanEmail, cleanPassword);
      
      setLoginAttempts(0);
      setBlockedUntil(null);
      
      const user = firebaseAuth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userRole = userDoc.exists() ? userDoc.data().role : 'anggota';
        await logActivity(
          user.uid,
          user.email?.split('@')[0] || 'User',
          userRole,
          'login',
          `Login berhasil menggunakan email ${cleanEmail}`
        );
      }
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      const remaining = 5 - newAttempts;
      
      if (newAttempts >= 5) {
        setBlockedUntil(Date.now() + 60 * 1000);
        setLoginAttempts(0);
        setError('⛔ Terlalu banyak percobaan. Coba lagi setelah 1 menit.');
      } else {
        if (err.code === 'auth/user-not-found') {
          setError(`❌ Email tidak ditemukan. Kesempatan tersisa: ${remaining}`);
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          setError(`❌ Password salah. Kesempatan tersisa: ${remaining}`);
        } else if (err.code === 'auth/invalid-email') {
          setError('❌ Email tidak valid');
        } else {
          setError(`❌ Gagal login. Coba lagi. Kesempatan tersisa: ${remaining}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const remainingAttempts = getRemainingAttempts();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <Toaster position="top-right" />
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">GUJALA 23</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Silakan login ke akun Anda</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 sm:text-sm"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {!blockedUntil && loginAttempts > 0 && loginAttempts < 5 && (
            <div className="text-sm text-center text-orange-600 dark:text-orange-400">
              ⚠️ Kesempatan tersisa: {remainingAttempts}
            </div>
          )}

          {blockedUntil && Date.now() < blockedUntil && (
            <div className="text-sm text-center text-red-600 dark:text-red-400">
              ⛔ Akun diblokir sementara. Coba lagi setelah 1 menit.
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || (blockedUntil && Date.now() < blockedUntil)}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Memuat...' : 'Login'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <Link href="/register" className="text-sm text-blue-600 hover:text-blue-500">Belum punya akun? Daftar</Link>
            <Link href="/login/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">Lupa password?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}