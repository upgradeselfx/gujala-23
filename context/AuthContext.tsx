'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/app/firebase/client';
import { setCookie, deleteCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type UserData = {
  uid: string;
  email: string;
  nama: string;
  noTel: string;
  role: 'anggota' | 'pengelola';
};

type AuthContextType = {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  register: (email: string, password: string, nama: string, noTel: string, adminCode: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Session Timeout: Auto logout setelah 1 jam tidak aktif
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (user) {
      // Auto logout setelah 1 jam (3600000 ms)
      timeoutId = setTimeout(() => {
        signOut(auth);
        toast.success('Sesi Anda telah berakhir. Silakan login kembali.');
        router.push('/login');
      }, 3600000);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Ambil data dari Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          setUserData(data);
          // Simpan role ke cookie untuk proteksi route
          setCookie('userRole', data.role);
        }
      } else {
        setUserData(null);
        deleteCookie('userRole');
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const register = async (email: string, password: string, nama: string, noTel: string, adminCode: string) => {
    // Cek apakah kode admin cocok (ambil dari environment variable)
    const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_SECRET_CODE || 'KeBaB23';
    const isAdmin = adminCode === ADMIN_CODE;
    const role = isAdmin ? 'pengelola' : 'anggota';
    
    console.log('Admin code entered:', adminCode);
    console.log('Expected code:', ADMIN_CODE);
    console.log('Is admin?', isAdmin);
    console.log('Role assigned:', role);

    // Buat akun di Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    // Simpan data ke Firestore
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      nama,
      noTel,
      role,
      createdAt: new Date().toISOString()
    });
    
    router.push('/dashboard');
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    router.push('/dashboard');
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}