'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/app/firebase/client';
import { logActivity } from '@/lib/activityLogger';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Shield, 
  Key, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  AlertCircle,
  Zap,
  Swords,
  Flame
} from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);
  const [robotRotate, setRobotRotate] = useState(0);
  const [stars, setStars] = useState<Array<{id: number; left: number; top: number; size: number; duration: number; delay: number}>>([]);
  const [shootingStars, setShootingStars] = useState<Array<{id: number; top: number; left: number; duration: number; delay: number}>>([]);
  const { login } = useAuth();
  const router = useRouter();

  // FORCE DARK MODE - langsung ke HTML element
  useEffect(() => {
    // Tambahkan class dark ke html element
    const htmlElement = document.documentElement;
    if (!htmlElement.classList.contains('dark')) {
      htmlElement.classList.add('dark');
    }
    
    // Backup: set inline style background untuk memastikan gelap
    document.body.style.backgroundColor = '#0a0a0a';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    return () => {
      // Jangan hapus dark mode saat unmount
    };
  }, []);

  // Animasi robot bergerak
  useEffect(() => {
    const interval = setInterval(() => {
      setRobotRotate(prev => (prev + 2) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Generate stars dan shooting stars hanya di client
  useEffect(() => {
    setIsClient(true);
    
    const generatedStars = Array.from({ length: 120 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      duration: Math.random() * 8 + 3,
      delay: Math.random() * 5,
    }));
    setStars(generatedStars);

    const generatedShootingStars = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      duration: Math.random() * 2.5 + 1.5,
      delay: Math.random() * 15,
    }));
    setShootingStars(generatedShootingStars);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

  if (!isClient) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a0a0a 0%, #000000 100%)' }}>
        <div style={{ maxWidth: '400px', width: '100%', margin: '0 16px' }}>
          <div style={{ backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.6)', borderRadius: '16px', padding: '32px', border: '1px solid rgba(200,0,0,0.3)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', margin: '0 auto 16px', borderRadius: '16px', background: 'linear-gradient(135deg, #dc2626, #7f1d1d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap style={{ width: '40px', height: '40px', color: '#f87171' }} />
              </div>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold', background: 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                GUJALA 23
              </h2>
              <div style={{ marginTop: '16px', color: '#f87171' }}>Memuat Sistem...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #2a0a0a 0%, #0a0a0a 50%, #1a0505 100%)'
    }}>
      <Toaster position="top-right" />
      
      {/* Background Galaksi & Bintang Jatuh */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* Bintang-bintang */}
        {stars.map((star) => (
          <div
            key={star.id}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              backgroundColor: 'white',
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: Math.random() * 0.6 + 0.2,
              animation: `twinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
        
        {/* Nebula Merah */}
        <div style={{ position: 'absolute', top: '25%', left: '25%', width: '384px', height: '384px', background: 'rgba(220,38,38,0.15)', borderRadius: '50%', filter: 'blur(64px)', animation: 'pulse 4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '25%', right: '25%', width: '384px', height: '384px', background: 'rgba(200,0,0,0.1)', borderRadius: '50%', filter: 'blur(64px)', animation: 'pulse 4s ease-in-out infinite 1s' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '500px', height: '500px', background: 'rgba(250,100,0,0.08)', borderRadius: '50%', filter: 'blur(64px)', animation: 'pulse 4s ease-in-out infinite 2s' }} />
        
        {/* Bintang Jatuh */}
        {shootingStars.map((star) => (
          <div
            key={star.id}
            className="shooting-star"
            style={{
              position: 'absolute',
              top: `${star.top}%`,
              left: `${star.left}%`,
              animation: `shoot ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          >
            <div style={{ width: '128px', height: '2px', background: 'linear-gradient(90deg, transparent, #ef4444, transparent)' }} />
          </div>
        ))}
        
        {/* Bima Sakti effect */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.2 }}>
          <div style={{ position: 'absolute', top: '33%', left: '50%', width: '600px', height: '300px', background: 'linear-gradient(90deg, rgba(220,38,38,0.2), transparent, rgba(220,38,38,0.2))', transform: 'rotate(45deg)', filter: 'blur(64px)' }} />
          <div style={{ position: 'absolute', bottom: '33%', right: '50%', width: '600px', height: '300px', background: 'linear-gradient(270deg, rgba(220,38,38,0.2), transparent, rgba(220,38,38,0.2))', transform: 'rotate(-45deg)', filter: 'blur(64px)' }} />
        </div>
      </div>
      
      {/* Animated cursor glow effect */}
      <div
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 50,
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(220,38,38,0.2), rgba(200,0,0,0.05))',
          filter: 'blur(16px)',
          transition: 'all 0.3s ease-out',
          left: mousePosition.x - 80,
          top: mousePosition.y - 80,
        }}
      />

      {/* Main Login Card */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '448px', width: '100%', margin: '0 16px', animation: 'slideUp 0.6s ease-out' }}>
        <div style={{ 
          position: 'relative',
          backdropFilter: 'blur(20px)',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          border: '1px solid rgba(200,0,0,0.3)'
        }}>
          
          {/* Animated border gradient */}
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: 'linear-gradient(90deg, rgba(220,38,38,0.3), rgba(255,100,0,0.2), rgba(220,38,38,0.3))',
            animation: 'spin-slow 10s linear infinite',
            borderRadius: '16px',
            filter: 'blur(20px)'
          }} />
          
          <div style={{ position: 'relative', padding: '24px 32px' }}>
            {/* Logo Robot Bergerak */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{ position: 'relative', width: '96px', height: '96px', margin: '0 auto 16px' }}>
                  {/* Robot Head */}
                  <div style={{ position: 'absolute', inset: 0, animation: 'float-garang 2s ease-in-out infinite' }}>
                    <div style={{ 
                      width: '100%', 
                      height: '100%', 
                      borderRadius: '16px', 
                      background: 'linear-gradient(135deg, #991b1b, #7f1d1d, #450a0a)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 10px 25px -5px rgba(220,38,38,0.5)',
                      border: '2px solid #ef4444'
                    }}>
                      {/* Robot Face */}
                      <div>
                        {/* Robot Eyes */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#000000', animation: 'pulse-garang 1.5s ease-in-out infinite', boxShadow: '0 0 8px #ef4444' }} />
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#000000', animation: 'pulse-garang 1.5s ease-in-out infinite 0.3s', boxShadow: '0 0 8px #ef4444' }} />
                        </div>
                        {/* Robot Mouth */}
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          <div style={{ width: '6px', height: '8px', background: '#dc2626', borderRadius: '2px' }} />
                          <div style={{ width: '6px', height: '8px', background: '#dc2626', borderRadius: '2px' }} />
                          <div style={{ width: '6px', height: '8px', background: '#dc2626', borderRadius: '2px' }} />
                        </div>
                      </div>
                    </div>
                    {/* Robot Antenna */}
                    <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '16px', background: '#b91c1c' }} />
                    <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse-garang 1.5s ease-in-out infinite' }} />
                    {/* Robot Ears */}
                    <div style={{ position: 'absolute', left: '-8px', top: '50%', transform: 'translateY(-50%)', width: '8px', height: '24px', background: '#991b1b', borderRadius: '8px 0 0 8px' }} />
                    <div style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)', width: '8px', height: '24px', background: '#991b1b', borderRadius: '0 8px 8px 0' }} />
                  </div>
                  {/* Rotating ring */}
                  <div 
                    style={{
                      position: 'absolute',
                      inset: '-10px',
                      borderRadius: '50%',
                      border: '2px solid rgba(239,68,68,0.3)',
                      animation: 'spin-slow 10s linear infinite',
                      transform: `rotate(${robotRotate}deg)`
                    }}
                  />
                  <div 
                    style={{
                      position: 'absolute',
                      inset: '-20px',
                      borderRadius: '50%',
                      border: '1px solid rgba(239,68,68,0.15)',
                      animation: 'spin-slow-reverse 8s linear infinite',
                      transform: `rotate(${-robotRotate * 0.5}deg)`
                    }}
                  />
                </div>
                
                {/* Efek api */}
                <div style={{ position: 'absolute', top: '-8px', right: '-8px' }}>
                  <Flame style={{ width: '20px', height: '20px', color: '#f97316', animation: 'flicker 0.8s ease-in-out infinite' }} />
                </div>
                <div style={{ position: 'absolute', bottom: '-8px', left: '-8px' }}>
                  <Zap style={{ width: '16px', height: '16px', color: '#ef4444', animation: 'pulse-garang 1.5s ease-in-out infinite' }} />
                </div>
              </div>
              
              <h2 style={{ 
                fontSize: '32px', 
                fontWeight: 'bold', 
                background: 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginTop: '8px'
              }}>
                GUJALA 23
              </h2>
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                <Shield style={{ width: '12px', height: '12px', color: '#ef4444' }} />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{ 
                marginBottom: '24px', 
                background: 'rgba(127,29,29,0.8)', 
                border: '1px solid #b91c1c', 
                color: '#fca5a5', 
                padding: '12px 16px', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'shake 0.3s ease-in-out'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Email Field */}
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#f87171', 
                    marginBottom: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <Mail size={14} />
                    Alamat Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 44px',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(200,0,0,0.3)',
                        borderRadius: '12px',
                        color: 'white',
                        outline: 'none',
                        transition: 'all 0.3s',
                        fontSize: '16px'
                      }}
                      placeholder="email@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(200,0,0,0.3)'}
                    />
                    <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#ef444480' }} />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#f87171', 
                    marginBottom: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <Key size={14} />
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 44px 12px 44px',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(200,0,0,0.3)',
                        borderRadius: '12px',
                        color: 'white',
                        outline: 'none',
                        transition: 'all 0.3s',
                        fontSize: '16px'
                      }}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#ef4444'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(200,0,0,0.3)'}
                    />
                    <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#ef444480' }} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ 
                        position: 'absolute', 
                        right: '12px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        color: '#ef444480',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Attempts Warning */}
              {!blockedUntil && loginAttempts > 0 && loginAttempts < 5 && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  fontSize: '14px', 
                  color: '#fb923c', 
                  background: 'rgba(120,53,15,0.3)', 
                  borderRadius: '8px', 
                  padding: '8px 12px', 
                  marginTop: '20px', 
                  border: '1px solid rgba(200,100,0,0.3)' 
                }}>
                  <Shield size={14} />
                  ⚠️ Kesempatan tersisa: {remainingAttempts}
                </div>
              )}

              {blockedUntil && Date.now() < blockedUntil && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  fontSize: '14px', 
                  color: '#fca5a5', 
                  background: 'rgba(127,29,29,0.3)', 
                  borderRadius: '8px', 
                  padding: '8px 12px', 
                  marginTop: '20px', 
                  border: '1px solid rgba(200,0,0,0.3)' 
                }}>
                  <AlertCircle size={14} />
                  ⛔ Akun diblokir sementara. Coba lagi setelah 1 menit.
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (blockedUntil ? Date.now() < blockedUntil : false)}
                style={{
                  position: 'relative',
                  width: '100%',
                  padding: '12px 16px',
                  marginTop: '24px',
                  overflow: 'hidden',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #991b1b, #7f1d1d, #450a0a)',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(220,38,38,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? (
                    <>
                      <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Memasuki Sistem...
                    </>
                  ) : (
                    <>
                      <Zap size={18} />
                      Login ke GUJALA 23
                    </>
                  )}
                </span>
              </button>

              {/* Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px', textAlign: 'center' }}>
                <Link 
                  href="/register" 
                  style={{ fontSize: '14px', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
                >
                  <Swords size={14} />
                  Belum punya akun? Daftar
                </Link>
                <Link 
                  href="/login/forgot-password" 
                  style={{ fontSize: '14px', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
                >
                  <Key size={14} />
                  Lupa password?
                </Link>
              </div>
            </form>
          </div>
        </div>
        
        {/* Credit */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: 'rgba(220,38,38,0.4)' }}>
          <p>© 2026 GUJALA 23</p>
        </div>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
        
        @keyframes shoot {
          0% {
            transform: translateX(0) translateY(0) rotate(35deg);
            opacity: 0;
          }
          10% { opacity: 1; }
          20% {
            transform: translateX(-300px) translateY(300px) rotate(35deg);
            opacity: 1;
          }
          100% {
            transform: translateX(-550px) translateY(550px) rotate(35deg);
            opacity: 0;
          }
        }
        
        @keyframes float-garang {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-5px) rotate(3deg); }
          75% { transform: translateY(5px) rotate(-3deg); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        
        @keyframes pulse-garang {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        
        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          25% { opacity: 0.6; transform: scale(0.9); }
          75% { opacity: 0.9; transform: scale(1.1); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        
        .shooting-star {
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}