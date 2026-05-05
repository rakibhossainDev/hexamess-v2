const Header = ({ userName = 'মোঃ রাকিব হোসেন', userRole = 'Admin/Manager' }) => {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: 'linear-gradient(135deg, var(--accent-blue), #0055ff)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '1.5rem',
          boxShadow: '0 0 15px rgba(0, 209, 255, 0.3)'
        }}>
          H
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.02em' }}>
          হেক্সামেস <span style={{ color: 'var(--text-secondary)', fontWeight: '400', fontSize: '1.25rem' }}>(HexaMess)</span>
        </h1>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-color)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)' }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: '600', fontSize: '1rem' }}>{userName}</p>
          <p style={{ color: 'var(--accent-blue)', fontSize: '0.75rem', fontWeight: '500', textTransform: 'uppercase' }}>{userRole}</p>
        </div>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#ddd',
          backgroundImage: `url("https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}&backgroundColor=b6e3f4")`,
          backgroundSize: 'cover',
          border: '2px solid var(--accent-blue)'
        }}></div>
      </div>
    </header>
  );
};

export default Header;
