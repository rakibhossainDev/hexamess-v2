import { useState } from 'react';
import { db, collection, getDocs, query, where } from '../firebase';
import { MONTH_OPTIONS, getYearOptions, getMonthLabel } from '../utils/monthUtils';

const HistoryScreen = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [archive, setArchive] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [fixedCosts, setFixedCosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const yearOptions = getYearOptions();

  const handleSearch = async () => {
    if (!selectedMonth || !selectedYear) return;
    setLoading(true); setSearched(true);
    const monthId = `${selectedYear}-${selectedMonth}`;
    try {
      // Try archive first
      const archSnap = await getDocs(collection(db, 'archives'));
      const archDoc = archSnap.docs.find(d => d.id === monthId);
      if (archDoc) { setArchive({ id: archDoc.id, ...archDoc.data() }); }
      else { setArchive(null); }
      // Fetch expenses for month
      const eSnap = await getDocs(query(collection(db, 'expenses'), where('month_id', '==', monthId), where('status', '==', 'approved')));
      setExpenses(eSnap.docs.map(d => ({ id:d.id, ...d.data() })));
      // Fixed costs
      const fSnap = await getDocs(query(collection(db, 'fixed_costs'), where('month_id', '==', monthId)));
      setFixedCosts(fSnap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const monthId = selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth}` : '';
  const totalMarket = expenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalFixed = fixedCosts.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const totalDeposits = archive ? archive.total_deposits || 0 : 0;
  const totalMeals = archive ? archive.total_meals || 0 : 0;
  const mealRate = totalMeals > 0 ? (totalMarket / totalMeals).toFixed(2) : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <h2>📅 হিস্টরি প্রিভিউ</h2>

      {/* Filter Bar */}
      <div className="card" style={{ display:'flex', alignItems:'end', gap:'1rem', flexWrap:'wrap' }}>
        <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:'150px' }}>
          <label>মাস</label>
          <select className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            <option value="">নির্বাচন করুন</option>
            {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:'120px' }}>
          <label>বছর</label>
          <select className="form-control" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            <option value="">নির্বাচন করুন</option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" style={{ padding:'0.875rem 2rem' }} onClick={handleSearch} disabled={!selectedMonth || !selectedYear}>
          🔍 অনুসন্ধান
        </button>
      </div>

      {loading && <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>লোড হচ্ছে...</p>}

      {searched && !loading && (
        <>
          {/* Summary Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'1rem' }}>
            <SummaryCard label="মোট বাজার খরচ" value={`৳${totalMarket.toLocaleString()}`} color="var(--accent-orange)" />
            <SummaryCard label="মোট ফিক্সড খরচ" value={`৳${totalFixed.toLocaleString()}`} color="var(--accent-red)" />
            <SummaryCard label="মোট ডিপোজিট" value={`৳${totalDeposits.toLocaleString()}`} color="var(--accent-green)" />
            <SummaryCard label="মোট মিল" value={totalMeals} color="var(--accent-blue)" />
            <SummaryCard label="মিল রেট" value={`৳${mealRate}`} color="var(--accent-orange)" glow />
          </div>

          {/* Member Breakdown */}
          {archive && archive.members && (
            <div className="card">
              <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-blue)' }}>
                সদস্য সারাংশ — {getMonthLabel(monthId)}
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>নাম</th>
                      <th style={{ textAlign:'right' }}>ডিপোজিট</th>
                      <th style={{ textAlign:'center' }}>মিল</th>
                      <th style={{ textAlign:'right' }}>মিল খরচ</th>
                      <th style={{ textAlign:'right' }}>ফিক্সড শেয়ার</th>
                      <th style={{ textAlign:'right' }}>ব্যালেন্স</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archive.members.map((m, i) => {
                      const mealCost = (Number(m.total_meals) || 0) * Number(mealRate);
                      const fixedShare = totalFixed / (archive.members.length || 1);
                      const bal = m.current_balance || 0;
                      const isNeg = bal < 0;
                      return (
                        <tr key={i} className={isNeg ? 'row-danger' : ''}>
                          <td style={{ fontWeight:'500' }}>{m.name}
                            {m.role === 'manager' && <span className="badge badge-manager" style={{ marginLeft:'0.5rem' }}>👑</span>}
                          </td>
                          <td style={{ textAlign:'right' }}>৳{(m.total_deposit||0).toLocaleString()}</td>
                          <td style={{ textAlign:'center', color:'var(--accent-blue)', fontWeight:'600' }}>{m.total_meals||0}</td>
                          <td style={{ textAlign:'right' }}>৳{mealCost.toFixed(0)}</td>
                          <td style={{ textAlign:'right' }}>৳{fixedShare.toFixed(0)}</td>
                          <td style={{ textAlign:'right', fontWeight:'600', color: isNeg ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{bal.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!archive && expenses.length === 0 && fixedCosts.length === 0 && (
            <div className="card" style={{ textAlign:'center', padding:'3rem' }}>
              <p style={{ fontSize:'1.25rem', marginBottom:'0.5rem' }}>📭</p>
              <p style={{ color:'var(--text-secondary)' }}>এই মাসের কোনো ডাটা পাওয়া যায়নি।</p>
            </div>
          )}

          {/* Fixed Costs Breakdown */}
          {fixedCosts.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-red)' }}>ফিক্সড খরচ বিবরণ</h3>
              <div className="table-container">
                <table>
                  <thead><tr><th>ক্যাটাগরি</th><th style={{ textAlign:'right' }}>পরিমাণ</th><th style={{ textAlign:'right' }}>জনপ্রতি</th></tr></thead>
                  <tbody>
                    {fixedCosts.map(f => (
                      <tr key={f.id}>
                        <td><span className="badge-category">{f.category || f.type}</span></td>
                        <td style={{ textAlign:'right' }}>৳{(f.amount||0).toLocaleString()}</td>
                        <td style={{ textAlign:'right', color:'var(--text-secondary)' }}>৳{((f.amount||0)/6).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, color, glow }) => (
  <div className={glow ? 'glass-card' : 'card'} style={{ position:'relative', overflow:'hidden' }}>
    {glow && <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'80px', height:'80px', background:color, filter:'blur(40px)', opacity:'0.15', borderRadius:'50%' }} />}
    <p style={{ color:'var(--text-secondary)', fontSize:'0.8rem', fontWeight:'500', marginBottom:'0.375rem' }}>{label}</p>
    <p style={{ fontSize:'1.5rem', fontWeight:'700', color }}>{value}</p>
  </div>
);

export default HistoryScreen;
