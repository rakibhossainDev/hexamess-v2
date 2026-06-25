import { NavLink, useNavigate } from 'react-router-dom';

const THEMES = [
  { name: 'Red', color: '#dc2626' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Green', color: '#10b981' },
  { name: 'Purple', color: '#8b5cf6' },
  { name: 'Orange', color: '#f97316' }
];

const changeTheme = (color) => {
  document.documentElement.style.setProperty('--primary-color', color);
  localStorage.setItem('hexamess-primary-color', color);
};

const Sidebar = ({ isManager = false }) => {
  const navigate = useNavigate();

  const adminItems = [
    { name: 'ড্যাশবোর্ড', path: '/admin', icon: '📊', end: true },
    { name: 'মিল ম্যানেজমেন্ট', path: '/admin/meals', icon: '🍽️' },
    { name: 'বাজার ম্যানেজার', path: '/admin/market', icon: '💰' },
    { name: 'ফিক্সড খরচ', path: '/admin/expenses', icon: '🏠' },
    { name: 'টাকা জমা', path: '/admin/deposits', icon: '💸' },
    { name: 'মেম্বার লিস্ট', path: '/admin/members', icon: '👥' },
    { name: 'হিস্ট্রি', path: '/admin/history', icon: '📅' },
    { name: 'সেটিংস', path: '/admin/settings', icon: '⚙️' },
    { name: 'প্রোফাইল', path: '/admin/profile', icon: '👤' },
  ];

  const memberItems = [
    { name: 'ড্যাশবোর্ড', path: '/dashboard', icon: '📊', end: true },
    { name: 'মিল ম্যানেজমেন্ট', path: '/dashboard/meals', icon: '🍽️' },
    { name: 'বাজার ম্যানেজার', path: '/dashboard/market', icon: '💰' },
    { name: 'ফিক্সড খরচ', path: '/dashboard/expenses', icon: '🏠' },
    { name: 'টাকা জমা', path: '/dashboard/deposits', icon: '💸' },
    { name: 'হিস্টরি প্রিভিউ', path: '/dashboard/history', icon: '📅' },
    { name: 'প্রোফাইল', path: '/dashboard/profile', icon: '👤' },
  ];

  const menuItems = isManager ? adminItems : memberItems;

  const handleLogout = () => {
    localStorage.removeItem('hexa_user');
    localStorage.clear();
    navigate('/login');
  };

  return (
    <aside className="sidebar" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700' }}>
          মেনু অপশন
        </h2>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {menuItems.map((item, index) => (
          <NavLink
            key={index}
            to={item.path}
            end={item.end || false}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
          >
            <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
            <span>{item.name}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="sidebar-link"
          style={{
            background: 'none',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: "'Hind Siliguri', sans-serif",
            color: 'var(--accent-red)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>🚪</span>
          <span>লগআউট</span>
        </button>
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>থিম কালার</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {THEMES.map((theme) => (
            <button
              key={theme.name}
              onClick={() => changeTheme(theme.color)}
              style={{
                width: '24px', height: '24px', borderRadius: '50%', backgroundColor: theme.color,
                border: '2px solid var(--surface-color)', cursor: 'pointer',
                boxShadow: '0 0 5px rgba(0,0,0,0.3)'
              }}
              title={theme.name}
              aria-label={`Switch to ${theme.name} theme`}
            />
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
