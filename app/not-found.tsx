'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white">404</h1>
        <h2 className="text-2xl font-semibold mt-4">Halaman Tidak Ditemukan</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Maaf, halaman yang Anda cari tidak ada.</p>
        <Link href="/" className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}