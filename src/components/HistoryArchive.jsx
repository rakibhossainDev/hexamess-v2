import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { db, collection, getDocs, query, where } from '../firebase';
import { getMonthLabel } from '../utils/monthUtils';

const HistoryArchive = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [months, setMonths] = useState([]);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userRole] = useState(sessionStorage.getItem('hexamess-user-role') || 'member');

  const loadMonthData = async (monthId) => {
    setLoading(true);
    try {
      const qExp = query(collection(db, 'expenses'), where('month_id', '==', monthId), where('status', '==', 'approved'));
      const qBills = query(collection(db, 'fixed_costs'), where('month_id', '==', monthId));
      const qMeals = query(collection(db, 'meals'), where('month_id', '==', monthId));
      const qUsers = collection(db, 'users'); 

      const [expSnap, billSnap, mealSnap, userSnap] = await Promise.all([
        getDocs(qExp), getDocs(qBills), getDocs(qMeals), getDocs(qUsers)
      ]);

      const expenses = expSnap.docs.map(d => d.data());
      const bills = billSnap.docs.map(d => d.data());
      const meals = mealSnap.docs.map(d => d.data());
      const users = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const totalMarket = expenses.reduce((s, e) => s + (Number(e.cost)||0), 0);
      const totalFixed = bills.reduce((s, b) => s + (Number(b.amount)||0), 0);
      const totalMeals = meals.reduce((s, m) => {
        return s + (m.breakfast?0.5:0) + (m.lunch?1:0) + (m.dinner?1:0);
      }, 0);

      const mealRate = totalMeals === 0 ? 0 : (totalMarket / totalMeals).toFixed(2);

      setHistoryData({
        totalMarket, totalFixed, totalMeals, mealRate,
        expenses, bills, users,
        monthLabel: getMonthLabel(monthId)
      });
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchAvailableMonths = async () => {
    try {
      await getDocs(collection(db, 'config'));
      const expSnap = await getDocs(collection(db, 'expenses'));
      const uniqueMonths = [...new Set(expSnap.docs.map(d => d.data().month_id))].sort().reverse();
      setMonths(uniqueMonths);
      if (uniqueMonths.length > 0) {
        setSelectedMonth(uniqueMonths[0]);
        loadMonthData(uniqueMonths[0]);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAvailableMonths();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-layout">
      <main className="main-content" style={{ padding: '0 0 80px 0' }}>
        <Navbar userName={sessionStorage.getItem('hexamess-user-name')} userRole={userRole === 'manager' ? 'ম্যানেজার' : 'সদস্য'} />
        
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>📅 মাসিক আর্কাইভ</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>মাস নির্বাচন করুন:</label>
              <select 
                className="form-control" 
                style={{ width: 'auto' }}
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); loadMonthData(e.target.value); }}
              >
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
                <div className="card">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>মোট বাজার খরচ</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-orange)' }}>৳{historyData.totalMarket.toLocaleString()}</p>
                </div>
                <div className="card">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>মোট ফিক্সড বিল</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-red)' }}>৳{historyData.totalFixed.toLocaleString()}</p>
                </div>
                <div className="card">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>মোট মিল</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-blue)' }}>{historyData.totalMeals}</p>
                </div>
                <div className="card">
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>ফাইনাল মিল রেট</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-green)' }}>৳{historyData.mealRate}</p>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem' }}>📊 মেম্বার রিপোর্ট</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>নাম</th>
                        <th style={{ textAlign: 'right' }}>ডিপোজিট</th>
                        <th style={{ textAlign: 'center' }}>মিল</th>
                        <th style={{ textAlign: 'right' }}>বাজার খরচ</th>
                        <th style={{ textAlign: 'right' }}>ব্যালেন্স</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.users.map(user => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td style={{ textAlign: 'right' }}>৳{user.total_deposit || 0}</td>
                          <td style={{ textAlign: 'center' }}>{user.total_meals || 0}</td>
                          <td style={{ textAlign: 'right' }}>৳{(user.total_meals * historyData.mealRate).toFixed(0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>৳{user.current_balance || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expense List */}
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem' }}>🛒 বাজার লিস্ট (অনুমোদিত)</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>তারিখ</th>
                        <th>বিবরণ</th>
                        <th>বাজারকারী</th>
                        <th style={{ textAlign: 'right' }}>খরচ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.expenses.map((exp, idx) => (
                        <tr key={idx}>
                          <td>{exp.date}</td>
                          <td>{exp.details}</td>
                          <td>{exp.shopper_name}</td>
                          <td style={{ textAlign: 'right' }}>৳{exp.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              কোনো ডাটা পাওয়া যায়নি।
            </div>
          )}
        </div>
      </main>
      <BottomNav isManager={userRole === 'manager'} />
    </div>
  );
};

export default HistoryArchive;
