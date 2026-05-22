import { NavLink, useNavigate } from 'react-router-dom';

const Sidebar = ({ isManager = false }) => {
  const navigate = useNavigate();

  const adminItems = [
    { name: 'ড্যাশবোর্ড', path: '/admin', icon: '📊', end: true },
    { name: 'মিল ম্যানেজমেন্ট', path: '/admin/meals', icon: '🍽️' },
    { name: 'বাজার ম্যানেজার', path: '/admin/market', icon: '💰' },
    { name: 'বাজার ও খরচ', path: '/admin/expenses', icon: '🛒' },
    { name: 'মেম্বার লিস্ট', path: '/admin/members', icon: '👥' },
    { name: 'হিস্টরি', path: '/admin/history', icon: '📅' },
    { name: 'সেটিংস', path: '/admin/settings', icon: '⚙️' },
    { name: 'প্রোফাইল', path: '/admin/profile', icon: '👤' },
  ];

  const memberItems = [
    { name: 'ড্যাশবোর্ড', path: '/dashboard', icon: '📊', end: true },
    { name: 'মিল হিসেব', path: '/dashboard/meals', icon: '🍽️' },
    { name: 'বাজার এন্ট্রি', path: '/dashboard/market', icon: '🛒' },
    { name: 'হিস্টরি প্রিভিউ', path: '/dashboard/history', icon: '📅' },
    { name: 'প্রোফাইল', path: '/dashboard/profile', icon: '👤' },
  ];

  const menuItems = isManager ? adminItems : memberItems;

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700' }}>
          মেনু অপশন
        </h2>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
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
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
        <button
          onClick={handleLogout}
          className="btn"
          style={{
            width: '100%', fontSize: '0.9rem',
            background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)',
            border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer'
          }}
        >
          🚪 লগআউট
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
