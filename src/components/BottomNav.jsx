import { NavLink } from 'react-router-dom';

const BottomNav = ({ isManager = false }) => {
  const menuItems = isManager ? [
    { name: 'ড্যাশবোর্ড', path: '/admin', icon: '📊', end: true },
    { name: 'মিল', path: '/admin/meals', icon: '🍽️' },
    { name: 'বাজার', path: '/admin/market', icon: '💰' },
    { name: 'মেম্বার', path: '/admin/members', icon: '👥' },
    { name: 'প্রোফাইল', path: '/admin/profile', icon: '👤' },
  ] : [
    { name: 'ড্যাশবোর্ড', path: '/dashboard', icon: '📊', end: true },
    { name: 'মিল', path: '/dashboard/meals', icon: '🍽️' },
    { name: 'বাজার', path: '/dashboard/market', icon: '🛒' },
    { name: 'প্রোফাইল', path: '/dashboard/profile', icon: '👤' },
  ];

  return (
    <nav className="bottom-nav">
      {menuItems.map((item, index) => (
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
    </nav>
  );
};

export default BottomNav;
