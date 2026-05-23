import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, where } from '../utils/firebase';
import '../Dashboard.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
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
      const lowerUsername = username.toLowerCase();

      // Manager bypass check
      if (lowerUsername === 'manager' && password === '123456') {
        const managerSession = { id: 'manager', username: 'manager', role: 'manager', name: 'মেস ম্যানেজার' };
        localStorage.setItem('hexa_user', JSON.stringify(managerSession));
        localStorage.setItem('hexamess-user-id', 'manager');
        localStorage.setItem('hexamess-user-role', 'manager');
        localStorage.setItem('hexamess-user-name', 'মেস ম্যানেজার');
        navigate('/admin');
        return;
      }

      // Query the 'users' collection in Firestore by username
      const uQ = query(
        collection(db, 'users'), 
        where('username', '==', lowerUsername)
      );
      
      const snap = await getDocs(uQ);

      if (snap.empty) {
        alert("ইউজারনেম বা পাসওয়ার্ড সঠিক নয়!");
        setError("ইউজারনেম বা পাসওয়ার্ড সঠিক নয়!");
        setLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      if (userData.status === 'inactive') {
        setError('আপনার একাউন্টটি বর্তমানে নিষ্ক্রিয়। ম্যানেজারের সাথে যোগাযোগ করুন।');
        setLoading(false);
        return;
      }

      // Direct comparison of the 'password' field from Firestore
      if (userData.password === password) {
        const userRole = lowerUsername === 'manager' ? 'manager' : 'member';
        const fullUserData = { id: userDoc.id, ...userData, role: userRole };

        // Save complete user info as hexa_user
        localStorage.setItem('hexa_user', JSON.stringify(fullUserData));

        // Maintain legacy keys for 100% backward compatibility
        localStorage.setItem('hexamess-user-id', userDoc.id);
        localStorage.setItem('hexamess-user-role', userRole);
        localStorage.setItem('hexamess-user-name', userData.name || '');

        // Redirect strictly based on username
        if (lowerUsername === 'manager') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        alert("ইউজারনেম বা পাসওয়ার্ড সঠিক নয়!");
        setError("ইউজারনেম বা পাসওয়ার্ড সঠিক নয়!");
      }

    } catch (err) {
      console.error("Direct Auth Error:", err);
      alert("ইউজারনেম বা পাসওয়ার্ড সঠিক নয়!");
      setError("ইউজারনেম বা পাসওয়ার্ড সঠিক নয়!");
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = (e) => {
    e.preventDefault();
    setRecoverySent(true);
    // Simulating sending to super-admin
    setTimeout(() => {
      setShowRecovery(false);
      setRecoverySent(false);
      setError('পাসওয়ার্ড পুনরুদ্ধারের অনুরোধ rakibhossain2k25@gmail.com ঠিকানায় পাঠানো হয়েছে।');
    }, 2000);
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

        {error && (
          <div className="alert-danger" style={{ marginBottom: '1.5rem', animation: 'shake 0.4s' }}>
            <span>!</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>ইউজারনেম</label>
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
            {loading ? 'লগইন হচ্ছে...' : 'প্রবেশ করুন'}
          </button>
        </form>

        <div style={{ marginTop:'1.5rem', textAlign:'right' }}>
          <button 
            onClick={() => setShowRecovery(true)}
            style={{ background:'none', border:'none', color:'var(--accent-blue)', fontSize:'0.8125rem', cursor:'pointer', textDecoration:'underline' }}
          >
            পাসওয়ার্ড ভুলে গেছেন?
          </button>
        </div>

        {showRecovery && (
          <div className="recovery-overlay" style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:'1.5rem'
          }}>
            <div className="card" style={{ maxWidth:'400px', width:'100%', textAlign:'center' }}>
              <h3 style={{ marginBottom:'1rem' }}>পাসওয়ার্ড পুনরুদ্ধার</h3>
              <p style={{ fontSize:'0.875rem', color:'var(--text-secondary)', marginBottom:'1.5rem' }}>
                ম্যানেজার একাউন্টের পাসওয়ার্ড উদ্ধারের জন্য একটি রিকোয়েস্ট সুপার-এডমিন (rakibhossain2k25@gmail.com) এর কাছে পাঠানো হবে।
              </p>
              {!recoverySent ? (
                <div style={{ display:'flex', gap:'1rem' }}>
                  <button className="btn btn-primary" style={{ flex:1 }} onClick={handleRecovery}>অনুরোধ পাঠান</button>
                  <button className="btn" style={{ flex:1 }} onClick={() => setShowRecovery(false)}>বাতিল</button>
                </div>
              ) : (
                <p style={{ color:'var(--accent-green)', fontWeight:'600' }}>প্রক্রিয়াকরণ হচ্ছে...</p>
              )}
            </div>
          </div>
        )}

        <p style={{ marginTop: '2rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          সদস্যরা পাসওয়ার্ড ভুলে গেলে ম্যানেজারের সাথে যোগাযোগ করুন।
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
