import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ userName = 'ব্যবহারকারী', userRole = 'সদস্য', photoURL = '' }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedTheme = localStorage.getItem('hexamess-theme');
    if (savedTheme === 'light') {
      setTimeout(() => setIsDarkMode(false), 0);
      document.body.classList.add('light-mode');
    }
  }, []);

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

  const handleLogout = () => {
    localStorage.removeItem('hexa_user');
    localStorage.clear();
    navigate('/');
  };

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem 1.5rem',
      background: 'var(--surface-color)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      minHeight: 'var(--nav-height)'
    }}>
      {/* Left: Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'linear-gradient(135deg, var(--accent-blue), #0055ff)',
          borderRadius: '10px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#fff', fontWeight: 'bold',
          fontSize: '1.25rem', boxShadow: '0 0 15px rgba(0, 209, 255, 0.4)'
        }}>
          H
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
          HexaMess
        </h1>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          style={{
            background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            width: '40px', height: '40px',
            borderRadius: '12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem',
            transition: 'all 0.2s ease'
          }}
          className="theme-toggle-btn"
          aria-label="Toggle Theme"
        >
          {isDarkMode ? '🌙' : '☀️'}
        </button>

        {/* User Info */}
        <div 
          onClick={() => navigate(userRole === 'ম্যানেজার' ? '/admin/profile' : '/member/profile')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
        >
          <div style={{ textAlign: 'right', display: 'block' }} className="nav-user-text">
            <p style={{ fontWeight: '600', fontSize: '0.95rem', lineHeight: '1.2', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
              {userName} {userRole === 'ম্যানেজার' && <span style={{ color:'#FFD700', textShadow:'0 0 5px rgba(255,215,0,0.5)', fontSize:'1rem' }}>👑</span>}
            </p>
            <p style={{ color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase' }}>{userRole}</p>
          </div>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'var(--surface-hover)',
            backgroundImage: photoURL ? `url("${photoURL}")` : `url("https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}&backgroundColor=b6e3f4")`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            border: '2px solid var(--accent-blue)',
            boxShadow: '0 0 10px rgba(0, 209, 255, 0.2)'
          }} />
        </div>

        {/* Mobile Logout (Desktop uses Sidebar) */}
        <button 
          onClick={handleLogout}
          className="btn-mobile-logout"
          style={{
            display: 'none',
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--accent-red)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '0.5rem',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer'
          }}
        >
          🚪
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 480px) {
          .nav-user-text { display: none !important; }
          .btn-mobile-logout { display: block !important; }
        }
      `}} />
    </nav>
  );
};

export default Navbar;
