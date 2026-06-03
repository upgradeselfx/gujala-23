'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/firebase/client';
import { useAuth } from '@/context/AuthContext';
import { Bell, X } from 'lucide-react';

export default function Notification() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'pengumuman'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(data);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="relative">
      <button onClick={() => setShow(!show)} className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
        <Bell size={20} />
        {notifications.length > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>}
      </button>
      {show && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border z-50">
          <div className="flex justify-between items-center p-3 border-b">
            <h4 className="font-semibold">Notifikasi</h4>
            <button onClick={() => setShow(false)}><X size={16} /></button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-3 text-gray-500 text-sm">Belum ada notifikasi</p>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="p-3 border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                  <p className="font-medium text-sm">{notif.judul}</p>
                  <p className="text-xs text-gray-500 mt-1">{notif.createdAt?.toDate().toLocaleDateString('id-ID')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}