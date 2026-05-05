import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, where } from '../firebase';
import '../Dashboard.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Query Firestore for matching username and password
      const uQ = query(
        collection(db, 'users'), 
        where('username', '==', username), 
        where('password', '==', password),
        where('status', '==', 'active')
      );
      
      const snap = await getDocs(uQ);

      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const userData = userDoc.data();
        
        // Store Session Info
        sessionStorage.setItem('hexamess-user-id', userDoc.id);
        sessionStorage.setItem('hexamess-user-name', userData.name);
        sessionStorage.setItem('hexamess-user-role', userData.role);
        
        if (userData.role === 'manager') {
          sessionStorage.setItem('hexamess-admin', 'true');
          navigate('/admin');
        } else {
          sessionStorage.removeItem('hexamess-admin');
          navigate('/member');
        }
      } else {
        setError('ইউজারনেম বা পাসওয়ার্ড সঠিক নয় অথবা একাউন্টটি সচল নয়।');
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
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            width: '60px', height: '60px',
            background: 'linear-gradient(135deg, #00D1FF, #0077FF)',
            borderRadius: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: 'bold',
            fontSize: '2rem', boxShadow: '0 0 20px rgba(0, 209, 255, 0.4)',
            margin: '0 auto 1.25rem auto'
          }}>
            H
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>হেক্সামেস লগইন</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>প্রফেশনাল মেস ম্যানেজমেন্ট সিস্টেম</p>
        </div>

        {error && (
          <div className="alert-danger" style={{ marginBottom: '1.5rem' }}>
            <span>!</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>ইউজারনেম</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="আপনার ইউজারনেম দিন" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label>পাসওয়ার্ড</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-electric" disabled={loading}>
            {loading ? 'লগইন হচ্ছে...' : 'লগইন করুন'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
