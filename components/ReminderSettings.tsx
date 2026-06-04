'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getReminderSettings, saveReminderSettings } from '@/lib/reminderService';
import type { ReminderSettings } from '@/lib/reminderService';
import { Bell, Mail, Phone, Save } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function ReminderSettingsComponent() {
  const { user, userData } = useAuth();
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: true,
    hariSebelum: 3,
  });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const isPengelola = userData?.role === 'pengelola';

  useEffect(() => {
    if (user && isPengelola) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    const saved = await getReminderSettings(user.uid);
    setSettings(saved);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await saveReminderSettings(user.uid, settings);
      toast.success('Pengaturan reminder disimpan');
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const handleTestReminder = async () => {
    setSending(true);
    try {
      const response = await fetch('/api/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'check' }),
      });
      const data = await response.json();
      toast.success(`Ditemukan ${data.count} tagihan yang akan jatuh tempo`);
    } catch (error) {
      toast.error('Gagal mengecek reminder');
    } finally {
      setSending(false);
    }
  };

  if (!isPengelola) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 dark:text-yellow-200">⚠️ Hanya pengelola yang dapat mengatur reminder.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center gap-2 mb-4">
        <Bell size={24} className="text-blue-600" />
        <h2 className="text-xl font-semibold">Pengaturan Reminder</h2>
      </div>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Aktifkan Reminder</p>
            <p className="text-sm text-gray-500">Kirim notifikasi untuk tagihan yang akan jatuh tempo</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div>
          <label className="block font-medium mb-1">Hari Sebelum Jatuh Tempo</label>
          <select
            value={settings.hariSebelum}
            onChange={(e) => setSettings({ ...settings, hariSebelum: parseInt(e.target.value) })}
            className="px-3 py-2 border rounded-lg dark:bg-gray-700"
          >
            <option value={1}>1 hari sebelum</option>
            <option value={2}>2 hari sebelum</option>
            <option value={3}>3 hari sebelum</option>
            <option value={5}>5 hari sebelum</option>
            <option value={7}>7 hari sebelum</option>
          </select>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-medium mb-3 flex items-center gap-2"><Mail size={16} /> Email Reminder</h3>
          <p className="text-sm text-gray-500 mb-2">
            Reminder akan dikirim ke email anggota yang terdaftar.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              💡 Untuk mengaktifkan email reminder, daftar di EmailJS dan isi environment variables:
              NEXT_PUBLIC_EMAILJS_SERVICE_ID, NEXT_PUBLIC_EMAILJS_TEMPLATE_ID, NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
            </p>
          </div>
        </div>

        <div className="pt-2 border-t">
          <h3 className="font-medium mb-3 flex items-center gap-2"><Phone size={16} /> WhatsApp Reminder (Premium)</h3>
          <p className="text-sm text-gray-500 mb-2">
            Reminder via WhatsApp (memerlukan API seperti Fonnte/WaGateway).
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              💡 Untuk mengaktifkan WhatsApp reminder, daftar di Fonnte dan isi NEXT_PUBLIC_FONNTE_API_KEY
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Save size={16} />
            {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
          <button
            onClick={handleTestReminder}
            disabled={sending}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {sending ? 'Memeriksa...' : 'Cek Tagihan Jatuh Tempo'}
          </button>
        </div>
      </div>
    </div>
  );
}