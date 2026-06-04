'use client';

import ReminderSettings from '@/components/ReminderSettings';
import { Bell } from 'lucide-react';

export default function ReminderPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Bell size={24} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reminder Pembayaran</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Pengaturan notifikasi pengingat tagihan untuk anggota
          </p>
        </div>
      </div>
      
      <ReminderSettings />
    </div>
  );
}