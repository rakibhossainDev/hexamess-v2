import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const BottomNav = ({ isManager = false }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('hexa_user');
    localStorage.clear();
    navigate('/login');
  };

  // Primary 4 items shown on the bar directly
  const barItems = isManager ? [
    { name: 'ড্যাশবোর্ড', path: '/admin', icon: '📊', end: true },
    { name: 'মিল', path: '/admin/meals', icon: '🍽️' },
    { name: 'বাজার', path: '/admin/market', icon: '💰' },
    { name: 'প্রোফাইল', path: '/admin/profile', icon: '👤' },
  ] : [
    { name: 'ড্যাশবোর্ড', path: '/dashboard', icon: '📊', end: true },
    { name: 'মিল', path: '/dashboard/meals', icon: '🍽️' },
    { name: 'বাজার', path: '/dashboard/market', icon: '🛒' },
    { name: 'প্রোফাইল', path: '/dashboard/profile', icon: '👤' },
  ];

  // All items inside the bottom sheet grid
  const drawerItems = isManager ? [
    { name: 'ড্যাশবোর্ড', path: '/admin', icon: '📊', end: true },
    { name: 'মিল ম্যানেজমেন্ট', path: '/admin/meals', icon: '🍽️' },
    { name: 'বাজার ম্যানেজার', path: '/admin/market', icon: '💰' },
    { name: 'ফিক্সড খরচ', path: '/admin/expenses', icon: '🏠' },
    { name: 'টাকা জমা', path: '/admin/deposits', icon: '💸' },
    { name: 'মেম্বার লিস্ট', path: '/admin/members', icon: '👥' },
    { name: 'হিস্ট্রি', path: '/admin/history', icon: '📅' },
    { name: 'সেটিংস', path: '/admin/settings', icon: '⚙️' },
    { name: 'প্রোফাইল', path: '/admin/profile', icon: '👤' },
  ] : [
    { name: 'ড্যাশবোর্ড', path: '/dashboard', icon: '📊', end: true },
    { name: 'মিল ম্যানেজমেন্ট', path: '/dashboard/meals', icon: '🍽️' },
    { name: 'বাজার ম্যানেজার', path: '/dashboard/market', icon: '💰' },
    { name: 'ফিক্সড খরচ', path: '/dashboard/expenses', icon: '🏠' },
    { name: 'টাকা জমা', path: '/dashboard/deposits', icon: '💸' },
    { name: 'হিস্টরি প্রিভিউ', path: '/dashboard/history', icon: '📅' },
    { name: 'প্রোফাইল', path: '/dashboard/profile', icon: '👤' },
  ];

  return (
    <>
      <nav className="bottom-nav">
        {barItems.map((item, index) => (
          <NavLink
            key={index}
            to={item.path}
            end={item.end || false}
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
          >
            <span>{item.icon}</span>
            <span>{item.name}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="nav-item"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span>☰</span>
          <span>আরও</span>
        </button>
      </nav>

      {/* Slide-Up Mobile Sheet Drawer */}
      <div 
        className={`mobile-drawer-overlay ${isDrawerOpen ? 'open' : ''}`} 
        onClick={() => setIsDrawerOpen(false)}
      />
      <div className={`mobile-drawer ${isDrawerOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-title">মেনু অপশন</span>
          <button className="mobile-drawer-close" onClick={() => setIsDrawerOpen(false)}>✕</button>
        </div>
        
        <div className="mobile-drawer-grid">
          {drawerItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              end={item.end || false}
              className={({ isActive }) => `mobile-drawer-item ${isActive ? 'mobile-drawer-item-active' : ''}`}
              onClick={() => setIsDrawerOpen(false)}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </NavLink>
          ))}
          
          <button
            onClick={() => {
              setIsDrawerOpen(false);
              handleLogout();
            }}
            className="mobile-drawer-item"
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              color: 'var(--accent-red)',
              cursor: 'pointer',
            }}
          >
            <span>🚪</span>
            <span>লগআউট</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default BottomNav;
