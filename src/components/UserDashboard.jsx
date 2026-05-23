import { useState, useEffect, useMemo } from 'react';
import { db, doc, onSnapshot, collection, query, where } from '../utils/firebase';
import { getTodayDateString, getTodayDisplay } from '../utils/monthUtils';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const UserDashboard = () => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('hexa_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Debug Log
  console.log("Logged In User Details:", currentUser);

  const [config, setConfig] = useState(null);
  const [todayMeals, setTodayMeals] = useState({});
  const [mealLogs, setMealLogs] = useState([]);
  const { toasts, showToast, removeToast } = useToast();

  const userId = currentUser?.id || localStorage.getItem('hexamess-user-id');
  const today = getTodayDateString();

  // Unified monthYear key (e.g. "05-2026")
  const monthId = useMemo(() => {
    if (!today) return '';
    const [y, m, d] = today.split('-');
    return `${m}-${y}`;
  }, [today]);

  // Load config & user
  useEffect(() => {
    if (!db || !userId) return;
    const unsubUser = onSnapshot(doc(db, 'users', userId), snap => {
      if (snap.exists()) {
        const uData = { id: snap.id, ...snap.data() };
        setCurrentUser(uData);
        localStorage.setItem('hexa_user', JSON.stringify(uData));
      }
    });
    const unsubConfig = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { unsubUser(); unsubConfig(); };
  }, [userId]);

  const [myFixedExpenses, setMyFixedExpenses] = useState([]);
  const [myDeposits, setMyDeposits] = useState([]);
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const [totalBazarAmount, setTotalBazarAmount] = useState(0);
  const [userMonthTotalMeals, setUserMonthTotalMeals] = useState(0);

  useEffect(() => {
    if (!db || !config || !currentUser || !monthId) return;
    const mid = config.current_month_id;

    // Create proper formatted date (DD-MM-YYYY) for search alignment
    const [y, m, d] = today.split('-');
    const formattedDate = `${d}-${m}-${y}`;

    // Listen to current member's today meals
    const unsubToday = onSnapshot(collection(db, 'daily_meals'), snap => {
      const match = snap.docs.find(docSnap => {
        const data = docSnap.data();
        if (data.date !== formattedDate) return false;
        return data.memberId === currentUser.id || 
               data.user_id === currentUser.id || 
               data.memberId === currentUser.username || 
               data.user_id === currentUser.username ||
               data.username === currentUser.username ||
               data.userName === currentUser.name;
      });
      setTodayMeals(match ? match.data() : {});
    });

    // Recent logs
    const qLogs = query(collection(db, 'daily_meals'), where('memberId', '==', currentUser.id));
    const unsubLogs = onSnapshot(qLogs, snap => {
      const logs = snap.docs
        .map(dSnap => ({ id: dSnap.id, ...dSnap.data() }))
        .filter(data => {
          return data.memberId === currentUser.id || 
                 data.user_id === currentUser.id || 
                 data.memberId === currentUser.username || 
                 data.user_id === currentUser.username ||
                 data.username === currentUser.username ||
                 data.userName === currentUser.name;
        });
      logs.sort((a, b) => b.date.localeCompare(a.date));
      setMealLogs(logs.slice(0, 10));
    });

    // Listen to personal fixed expenses strictly querying by unique Firestore Document ID
    const qFixed = query(collection(db, 'fixed_expenses'), where('memberId', '==', currentUser.id));
    const unsubFixed = onSnapshot(qFixed, snap => {
      const filtered = snap.docs.filter(dSnap => {
        const data = dSnap.data();
        return data.memberId === currentUser.id || data.memberId === currentUser.username;
      });
      setMyFixedExpenses(filtered.map(dSnap => dSnap.data()));
    });

    // Listen to personal deposits strictly querying by unique Firestore Document ID
    const qDeposits = query(collection(db, 'deposits'), where('memberId', '==', currentUser.id));
    const unsubDeposits = onSnapshot(qDeposits, snap => {
      const filtered = snap.docs.filter(dSnap => {
        const data = dSnap.data();
        return data.memberId === currentUser.id || data.memberId === currentUser.username;
      });
      setMyDeposits(filtered.map(dSnap => dSnap.data()));
    });

    // Monthly Bazar amount for the current month
    const qBazar = query(collection(db, 'bazar_records'), where('monthYear', '==', monthId));
    const unsubBazar = onSnapshot(qBazar, snap => {
      const sum = snap.docs.reduce((s, dSnap) => s + Number(dSnap.data().amount || 0), 0);
      setTotalBazarAmount(sum);
    });

    // Monthly Daily meals for the current month (Global + User filtering)
    const qMealsGlobal = query(collection(db, 'daily_meals'), where('monthYear', '==', monthId));
    const unsubMealsGlobal = onSnapshot(qMealsGlobal, snap => {
      const sumAll = snap.docs.reduce((s, dSnap) => s + Number(dSnap.data().count || 0), 0);
      setMonthTotalMeals(sumAll);
    });

    const qMealsPersonal = query(collection(db, 'daily_meals'), where('memberId', '==', currentUser.id));
    const unsubMealsPersonal = onSnapshot(qMealsPersonal, snap => {
      const sumUser = snap.docs.reduce((s, dSnap) => {
        const data = dSnap.data();
        if (data.monthYear !== monthId) return s;
        if (data.memberId === currentUser.id || 
            data.user_id === currentUser.id || 
            data.memberId === currentUser.username || 
            data.user_id === currentUser.username) {
          return s + Number(data.count || 0);
        }
        return s;
      }, 0);
      setUserMonthTotalMeals(sumUser);
    });

    return () => {
      unsubToday();
      unsubLogs();
      unsubFixed();
      unsubDeposits();
      unsubBazar();
      unsubMealsGlobal();
      unsubMealsPersonal();
    };
  }, [config, currentUser, today, monthId]);

  const liveMealRate = useMemo(() => {
    if (monthTotalMeals === 0) return 0;
    return (totalBazarAmount / monthTotalMeals).toFixed(2);
  }, [totalBazarAmount, monthTotalMeals]);

  const currentTotalMeals = userMonthTotalMeals; // Logged in user's meals for the current month

  const totalDeposit = useMemo(() => {
    return myDeposits.reduce((sum, dSnap) => sum + Number(dSnap.amount || 0), 0);
  }, [myDeposits]);

  const totalFixedCost = useMemo(() => {
    return myFixedExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }, [myFixedExpenses]);

  // Current Month Total Bazar Cost (meals * rate) + User's assigned Fixed Expenses
  const totalCost = useMemo(() => {
    return (Number(currentTotalMeals) * Number(liveMealRate)) + totalFixedCost;
  }, [currentTotalMeals, liveMealRate, totalFixedCost]);

  const netBalance = useMemo(() => {
    return totalDeposit - totalCost;
  }, [totalDeposit, totalCost]);

  const handleMealToggle = async (mealType) => {
    if (!config || !currentUser) return;
    const prevVal = Number(todayMeals[mealType] || 0);
    const newVal = prevVal > 0 ? 0 : (mealType === 'breakfast' ? 0.5 : 1);
    
    try {
      const mid = config.current_month_id;
      const [y, m, d] = today.split('-');
      const formattedDate = `${d}-${m}-${y}`;
      const ref = doc(db, 'daily_meals', `${currentUser.id}_${formattedDate}`);
      
      let breakfastVal = mealType === 'breakfast' ? newVal : Number(todayMeals.breakfast || 0);
      let lunchVal = mealType === 'lunch' ? newVal : Number(todayMeals.lunch || 0);
      let dinnerVal = mealType === 'dinner' ? newVal : Number(todayMeals.dinner || 0);

      const payload = {
        ...todayMeals,
        user_id: currentUser.id,
        memberId: currentUser.id,
        userName: currentUser.name,
        month_id: mid,
        date: formattedDate,
        monthYear: `${m}-${y}`,
        [mealType]: newVal,
        count: breakfastVal + lunchVal + dinnerVal
      };

      const { setDoc } = await import('../utils/firebase');
      await setDoc(ref, payload, { merge: true });
      showToast('মিল স্ট্যাটাস আপডেট হয়েছে!', 'success');
    } catch (err) {
      console.error(err);
      showToast('মিল সেভ করা যায়নি।', 'error');
    }
  };

  if (!currentUser) return <div className="loading">লোড হচ্ছে...</div>;

  return (
    <div className="app-layout" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={false} />
      <main className="main-content" style={{ padding: '0 0 80px 0', flex: 1 }}>
        <Navbar userName={currentUser?.name} userRole={currentUser?.role === 'manager' ? 'ম্যানেজার' : 'সদস্য'} photoURL={currentUser?.photoURL} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {netBalance < 0 && (
            <div className="alert-danger">
              <span style={{ fontWeight:'bold' }}>!</span> 
              <span>ব্যালেন্স সতর্কতা: আপনার ব্যালেন্স নেগেটিভ (৳{netBalance.toFixed(0)})। দয়া করে ফান্ড ডিপোজিট করুন।</span>
            </div>
          )}

          {/* Dynamic 5 Metric Cards */}
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-orange)' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>লাইভ মিল রেট</p>
              <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-orange)' }}>
                ৳{liveMealRate}
              </span>
            </div>
            <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-blue)' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>চলতি মোট মিল</p>
              <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-blue)' }}>
                {currentTotalMeals} টি
              </span>
            </div>
            <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-green)' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>মোট জমা</p>
              <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-green)' }}>
                ৳{totalDeposit.toLocaleString()}
              </span>
            </div>
            <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-purple)' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>চলতি মিল খরচ</p>
              <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-purple)' }}>
                ৳{totalCost.toFixed(0)}
              </span>
            </div>
            <div className="card glass-card" style={{ borderLeft: `5px solid ${netBalance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>
                {netBalance >= 0 ? 'ক্যাশ ব্যালেন্স' : 'ম্যানেজার পাবে'}
              </p>
              <span style={{ fontSize:'2.5rem', fontWeight:'900', color: netBalance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                ৳{Math.abs(netBalance).toFixed(0)}
              </span>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize:'1.1rem', fontWeight:'600', marginBottom:'1.5rem' }}>🏠 আমার ফিক্সড খরচ সমূহ</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {myFixedExpenses.length === 0 ? (
                  <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem' }}>কোনো ফিক্সড খরচ রেকর্ড নেই।</p>
                ) : myFixedExpenses.map((exp, idx) => (
                  <div key={idx} style={{ display:'flex', justifyContent:'space-between', padding:'0.75rem', background:'var(--surface-hover)', borderRadius:'var(--radius-sm)' }}>
                     <span>{exp.category}</span>
                     <span style={{ fontWeight:'700' }}>৳{Number(exp.amount || 0).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                <h3 style={{ fontSize:'1.1rem', fontWeight:'600' }}>🍽️ আজকের মিল</h3>
                <span className="badge badge-manager" style={{ fontSize:'0.75rem' }}>{getTodayDisplay()}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                <MealItem label={<span>সকাল (০.৫)</span>} checked={Number(todayMeals.breakfast) > 0} onToggle={() => handleMealToggle('breakfast')} />
                <MealItem label={<span>দুপুর <b style={{ color:'var(--accent-orange)' }}>(১.০)</b></span>} checked={Number(todayMeals.lunch) > 0} onToggle={() => handleMealToggle('lunch')} />
                <MealItem label={<span>রাত <b style={{ color:'var(--accent-orange)' }}>(১.০)</b></span>} checked={Number(todayMeals.dinner) > 0} onToggle={() => handleMealToggle('dinner')} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize:'1.1rem', fontWeight:'600', marginBottom:'1.5rem' }}>📅 আমার সাম্প্রতিক মিল রেকর্ড</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>তারিখ</th>
                    <th style={{ textAlign:'center' }}>সকাল</th>
                    <th style={{ textAlign:'center' }}>দুপুর</th>
                    <th style={{ textAlign:'center' }}>রাত</th>
                    <th style={{ textAlign:'right' }}>মোট</th>
                  </tr>
                </thead>
                <tbody>
                  {mealLogs.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign:'center', color:'var(--text-secondary)', padding:'2rem' }}>কোনো রেকর্ড পাওয়া যায়নি।</td></tr>
                  ) : mealLogs.map(log => {
                    const total = (Number(log.breakfast)||0) + (Number(log.lunch)||0) + (Number(log.dinner)||0);
                    return (
                      <tr key={log.id}>
                        <td>{log.date}</td>
                        <td style={{ textAlign:'center' }}>{Number(log.breakfast) > 0 ? (log.breakfast === 0.5 ? '✅ ০.৫' : `✅ ${log.breakfast}`) : '—'}</td>
                        <td style={{ textAlign:'center' }}>{Number(log.lunch) > 0 ? (log.lunch === 1 ? '✅ ১.০' : `✅ ${log.lunch}`) : '—'}</td>
                        <td style={{ textAlign:'center' }}>{Number(log.dinner) > 0 ? (log.dinner === 1 ? '✅ ১.০' : `✅ ${log.dinner}`) : '—'}</td>
                        <td style={{ textAlign:'right', fontWeight:'700', color:'var(--accent-blue)' }}>{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <BottomNav isManager={currentUser?.role === 'manager'} />
    </div>
  );
};

const MealItem = ({ label, checked, onToggle }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem', background:'var(--surface-hover)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-color)' }}>
    <span style={{ fontWeight:'500' }}>{label}</span>
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="slider"></span>
    </label>
  </div>
);

export default UserDashboard;
