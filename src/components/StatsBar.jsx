const StatsBar = () => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '1.5rem',
      marginBottom: '1rem'
    }}>
      {/* Card 1: Live Meal Rate */}
      <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--accent-orange)', filter: 'blur(50px)', opacity: '0.15', borderRadius: '50%' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>লাইভ মিল রেট</h3>
          <span className="live-icon"></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--accent-orange)' }}>৳৭৮.৫০</span>
        </div>
      </div>

      {/* Card 2: Mess Fund */}
      <div className="card">
        <div style={{ marginBottom: '0.5rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>মেস ফান্ড</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: '700' }}>৳১৫,২০০</span>
        </div>
      </div>

      {/* Card 3: User Balance */}
      <div className="card" style={{ borderBottom: '3px solid var(--accent-green)' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>আপনার ব্যালেন্স</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-green)' }}>৳১,২০০</span>
        </div>
      </div>

      {/* Card 4: Total Meals */}
      <div className="card">
        <div style={{ marginBottom: '0.5rem' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>চলতি মাসের মোট মিল</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-blue)' }}>১৮০.৫</span>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
