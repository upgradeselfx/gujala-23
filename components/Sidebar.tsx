'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  HandCoins, 
  CalendarDays, 
  Trophy, 
  Megaphone, 
  FileText,
  LogOut,
  Moon,
  Sun,
  UserCircle
} from 'lucide-react';

type MenuItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  roles: ('anggota' | 'pengelola')[];
};

const menuItems: MenuItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['anggota', 'pengelola'] },
  { name: 'Kelola Anggota', href: '/dashboard/anggota', icon: <Users size={20} />, roles: ['pengelola'] },
  { name: 'Simpanan', href: '/dashboard/simpanan', icon: <Wallet size={20} />, roles: ['anggota', 'pengelola'] },
  { name: 'Pinjaman', href: '/dashboard/pinjaman', icon: <HandCoins size={20} />, roles: ['anggota', 'pengelola'] },
  { name: 'Cash Bulanan', href: '/dashboard/cash-bulanan', icon: <CalendarDays size={20} />, roles: ['anggota', 'pengelola'] },
  { name: 'Arisan', href: '/dashboard/arisan', icon: <Trophy size={20} />, roles: ['anggota', 'pengelola'] },
  { name: 'Pengumuman', href: '/dashboard/pengumuman', icon: <Megaphone size={20} />, roles: ['anggota', 'pengelola'] },
  { name: 'Laporan', href: '/dashboard/laporan', icon: <FileText size={20} />, roles: ['anggota', 'pengelola'] },
  { name: 'Profil', href: '/dashboard/profil', icon: <UserCircle size={20} />, roles: ['anggota', 'pengelola'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { userData, logout } = useAuth();
  const role = userData?.role || 'anggota';

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      setIsDark(true);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const filteredMenu = menuItems.filter(item => item.roles.includes(role as 'anggota' | 'pengelola'));

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-blue-600">GUJALA 23</h1>
        <p className="text-xs text-gray-500 mt-1">
          {role === 'pengelola' ? 'Pengelola' : 'Anggota'}
        </p>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredMenu.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Dark Mode Toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          <span className="text-sm font-medium">{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
        </button>
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}