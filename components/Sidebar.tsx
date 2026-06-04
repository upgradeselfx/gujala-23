'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Calendar } from 'lucide-react';
import { Bell } from 'lucide-react';
import { History } from 'lucide-react';
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
  UserCircle,
  Sparkles
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
  { name: 'Log Aktivitas', href: '/dashboard/log-aktivitas', icon: <History size={20} />, roles: ['anggota', 'pengelola'] },
  { name: 'Reminder', href: '/dashboard/reminder', icon: <Bell size={20} />, roles: ['pengelola'] },
  { name: 'Laporan Tahunan', href: '/dashboard/laporan-tahunan', icon: <Calendar size={20} />, roles: ['pengelola'] },
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
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
      setIsDark(true);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const filteredMenu = menuItems.filter(item => item.roles.includes(role as 'anggota' | 'pengelola'));

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen sticky top-0 shadow-xl transition-all duration-300">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Sparkles size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            GUJALA 23
          </h1>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 shadow-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-[1.02] hover:shadow-md'
              }`}
            >
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </div>
              <span className="text-sm font-medium flex-1">{item.name}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Dark Mode Toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 hover:scale-[1.02] group"
        >
          <div className={`transition-transform duration-300 group-hover:scale-110 ${isDark ? 'rotate-12' : ''}`}>
            {isDark ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-blue-500" />}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isDark ? 'Mode Terang' : 'Mode Gelap'}
          </span>
        </button>
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-300 hover:scale-[1.02] group"
        >
          <LogOut size={20} className="transition-transform duration-300 group-hover:translate-x-1" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}