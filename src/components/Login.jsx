import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, where } from '../firebase';
import '../Dashboard.css';

const Login = () => {
  const [activeTab, setActiveTab] = useState('member'); // 'member' or 'manager'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('hexamess-theme') !== 'light');
  const navigate = useNavigate();

  useEffect(() => {
    if (!isDarkMode) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    if (nextTheme) {
      document.body.classList.remove('light-mode');
      localStorage.setItem('hexamess-theme', 'dark');
    } else {
      document.body.classList.add('light-mode');
      localStorage.setItem('hexamess-theme', 'light');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (activeTab === 'manager') {
        // Manager Login: Hardcoded for now as per plan
        if (username === 'admin' && password === '112233') {
          localStorage.setItem('hexamess-user-id', 'admin-id');
          localStorage.setItem('hexamess-user-name', 'মেস ম্যানেজার');
          localStorage.setItem('hexamess-user-role', 'manager');
          localStorage.setItem('hexamess-admin', 'true');
          navigate('/admin');
        } else {
          setError('ম্যানেজার ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।');
        }
      } else {
        // Member Login: Firestore lookup
        const uQ = query(
          collection(db, 'users'), 
          where('username', '==', username), 
          where('password', '==', password)
        );
        
        const snap = await getDocs(uQ);

        if (!snap.empty) {
          const userDoc = snap.docs[0];
          const userData = userDoc.data();
          
          if (userData.status === 'inactive') {
            setError('আপনার একাউন্টটি বর্তমানে নিষ্ক্রিয়। ম্যানেজারের সাথে যোগাযোগ করুন।');
            return;
          }

          // Store Session Info
          localStorage.setItem('hexamess-user-id', userDoc.id);
          localStorage.setItem('hexamess-user-name', userData.name);
          localStorage.setItem('hexamess-user-role', userData.role);
          
          if (userData.role === 'manager') {
            localStorage.setItem('hexamess-admin', 'true');
            navigate('/admin');
          } else {
            localStorage.removeItem('hexamess-admin');
            navigate('/member');
          }
        } else {
          setError('সদস্য ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।');
        }
      }
    } catch (err) {
      console.error(err);
      setError('লগইন প্রক্রিয়ায় সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Theme Toggle in Login */}
        <button 
          onClick={toggleTheme}
          style={{
            position: 'absolute', top: '1.5rem', right: '1.5rem',
            background: 'var(--surface-hover)', border: '1px solid var(--border-color)',
            color: 'var(--text-primary)', width: '40px', height: '40px',
            borderRadius: '12px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
          }}
        >
          {isDarkMode ? '🌙' : '☀️'}
        </button>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            width: '60px', height: '60px',
            background: 'linear-gradient(135deg, var(--accent-blue), #0077FF)',
            borderRadius: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: 'bold',
            fontSize: '2rem', boxShadow: '0 0 20px rgba(0, 209, 255, 0.4)',
            margin: '0 auto 1.25rem auto'
          }}>
            H
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>হেক্সামেস (HexaMess)</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>প্রফেশনাল মেস ম্যানেজমেন্ট সিস্টেম</p>
        </div>

        {/* Dual Login Tabs */}
        <div style={{ 
          display: 'flex', background: 'var(--surface-hover)', 
          padding: '0.4rem', borderRadius: '12px', marginBottom: '2rem' 
        }}>
          <button 
            onClick={() => { setActiveTab('member'); setError(''); }}
            style={{ 
              flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'member' ? 'var(--surface-color)' : 'transparent',
              color: activeTab === 'member' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            সদস্য লগইন
          </button>
          <button 
            onClick={() => { setActiveTab('manager'); setError(''); }}
            style={{ 
              flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none',
              background: activeTab === 'manager' ? 'var(--surface-color)' : 'transparent',
              color: activeTab === 'manager' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            ম্যানেজার লগইন
          </button>
        </div>

        {error && (
          <div className="alert-danger" style={{ marginBottom: '1.5rem', animation: 'shake 0.4s' }}>
            <span>!</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>{activeTab === 'manager' ? 'ম্যানেজার ইউজারনেম' : 'সদস্য ইউজারনেম'}</label>
            <input 
              type="text" className="form-control" 
              placeholder="আপনার ইউজারনেম দিন" value={username}
              onChange={(e) => setUsername(e.target.value)} required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label>পাসওয়ার্ড</label>
            <input 
              type="password" className="form-control" 
              placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          <button type="submit" className="btn-electric" disabled={loading}>
            {loading ? 'লগইন হচ্ছে...' : (activeTab === 'manager' ? 'ম্যানেজার হিসেবে প্রবেশ করুন' : 'সদস্য হিসেবে প্রবেশ করুন')}
          </button>
        </form>

        <p style={{ marginTop: '2rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          পাসওয়ার্ড ভুলে গেলে ম্যানেজারের সাথে যোগাযোগ করুন।
        </p>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}} />
    </div>
  );
};

export default Login;
