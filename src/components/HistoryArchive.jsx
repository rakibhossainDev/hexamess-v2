import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { db, collection, getDocs, doc, getDoc } from '../firebase';
import { getMonthLabel } from '../utils/monthUtils';

const HistoryArchive = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [months, setMonths] = useState([]);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userRole] = useState(localStorage.getItem('hexamess-user-role') || 'member');

  const loadMonthData = async (monthId) => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'history_archive', monthId));
      if (snap.exists()) {
        setHistoryData({ id: snap.id, ...snap.data() });
      } else {
        setHistoryData(null);
      }
    } catch (err) { 
      console.error(err); 
      setHistoryData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const fetchAvailableMonths = async () => {
      try {
        const snap = await getDocs(collection(db, 'history_archive'));
        const uniqueMonths = snap.docs.map(d => d.id).sort().reverse();
        setMonths(uniqueMonths);
        if (uniqueMonths.length > 0) {
          setSelectedMonth(uniqueMonths[0]);
          loadMonthData(uniqueMonths[0]);
        }
      } catch (err) { console.error(err); }
    };
    fetchAvailableMonths();
  }, []);

  return (
    <div className="app-layout">
      <main className="main-content" style={{ padding: '0 0 80px 0' }}>
        <Navbar userName={localStorage.getItem('hexamess-user-name')} userRole={userRole === 'manager' ? 'ম্যানেজার' : 'সদস্য'} />
        
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>📅 হিস্টরি আর্কাইভ</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>মাস:</label>
              <select 
                className="form-control" 
                style={{ width: 'auto' }}
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); loadMonthData(e.target.value); }}
              >
                {months.length === 0 && <option value="">কোনো রেকর্ড নেই</option>}
                {months.map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>লোড হচ্ছে...</div>
          ) : historyData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Summary Cards */}
              <div className="stats-grid">
                <div className="card glass-card" style={{ 
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))',
                  borderTop:'4px solid var(--accent-orange)' 
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>💰 মোট বাজার খরচ</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-orange)' }}>৳{historyData.summary.total_market.toLocaleString()}</p>
                </div>
                <div className="card glass-card" style={{ 
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.02))',
                  borderTop:'4px solid var(--accent-red)' 
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>🏠 মোট ফিক্সড বিল</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-red)' }}>৳{historyData.summary.total_fixed.toLocaleString()}</p>
                </div>
                <div className="card glass-card" style={{ 
                  background: 'linear-gradient(135deg, rgba(0,209,255,0.1), rgba(0,209,255,0.02))',
                  borderTop:'4px solid var(--accent-blue)' 
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>🍽️ মোট মিল</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{historyData.summary.total_meals}</p>
                </div>
                <div className="card glass-card" style={{ 
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))',
                  borderTop:'4px solid var(--accent-green)' 
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>📉 ফাইনাল মিল রেট</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-green)' }}>৳{historyData.summary.meal_rate}</p>
                </div>
              </div>

              {/* Member Report */}
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>📊 মেম্বার ক্লোজিং ব্যালেন্স</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>নাম</th>
                        <th style={{ textAlign: 'right' }}>জমা</th>
                        <th style={{ textAlign: 'center' }}>মিল</th>
                        <th style={{ textAlign: 'right' }}>ব্যালেন্স</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.members.map(user => (
                        <tr key={user.id}>
                          <td style={{ fontWeight:'500' }}>{user.name}</td>
                          <td style={{ textAlign: 'right' }}>৳{user.total_deposit || 0}</td>
                          <td style={{ textAlign: 'center' }}>{user.total_meals || 0}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: user.current_balance < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                            ৳{user.current_balance || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expense List */}
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem' }}>🛒 বাজার বিবরণ</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>তারিখ</th>
                        <th>আইটেম</th>
                        <th>বাজারকারী</th>
                        <th style={{ textAlign: 'right' }}>খরচ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.expenses.map((exp, idx) => (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-secondary)', fontSize:'0.875rem' }}>{exp.date}</td>
                          <td>
                            <div style={{ fontWeight:'600' }}>{exp.itemName || exp.details}</div>
                            {exp.quantity && <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{exp.quantity}</div>}
                          </td>
                          <td>{exp.shopper_name}</td>
                          <td style={{ textAlign: 'right', fontWeight:'600' }}>৳{exp.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color:'var(--text-secondary)', marginBottom:'1rem' }}>কোনো আর্কাইভ ডাটা পাওয়া যায়নি।</p>
              <p style={{ fontSize:'0.875rem' }}>ম্যানেজার যখন নতুন মাস শুরু করবেন, তখন চলতি মাসের ডাটা এখানে সংরক্ষিত হবে।</p>
            </div>
          )}
        </div>
      </main>
      <BottomNav isManager={userRole === 'manager'} />
    </div>
  );
};

export default HistoryArchive;
