'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/firebase/client';
import { useAuth } from '@/context/AuthContext';
import { Bell, X, Megaphone } from 'lucide-react';

export default function Notification() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'pengumuman'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
      setNotifications(data);
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const newCount = data.filter((n: any) => n.createdAt > yesterday).length;
      setUnreadCount(newCount);
    });
    
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="relative">
      <button
        onClick={() => setShow(!show)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-110"
      >
        <Bell size={20} className="text-gray-700 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {show && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white">Notifikasi</h4>
            <button
              onClick={() => setShow(false)}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              <X size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                <Megaphone size={32} className="mx-auto mb-2 opacity-50" />
                Belum ada notifikasi
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  onClick={() => setShow(false)}
                >
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {notif.judul}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                    {notif.isi?.substring(0, 80)}...
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {notif.createdAt?.toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <a
                href="/dashboard/pengumuman"
                className="block text-center text-xs text-blue-600 dark:text-blue-400 py-1 hover:underline"
              >
                Lihat semua pengumuman
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}