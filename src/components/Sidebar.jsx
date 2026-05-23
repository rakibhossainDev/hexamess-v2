import { NavLink, useNavigate } from 'react-router-dom';

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
    { name: 'মিল হিসেব', path: '/dashboard/meals', icon: '🍽️' },
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
    </aside>
  );
};

export default Sidebar;
