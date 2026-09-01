import { useState, useEffect, useMemo } from 'react';
import { db, doc, onSnapshot, collection, query, where, limit } from '../utils/firebase';
import { getTodayDateString, getTodayDisplay } from '../utils/monthUtils';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const MemberDashboard = () => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('hexa_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [todayMeals, setTodayMeals] = useState({});
  const [mealLogs, setMealLogs] = useState([]);
  const { toasts, removeToast } = useToast();

  const userId = currentUser?.id || localStorage.getItem('hexamess-user-id');
  const today = getTodayDateString();

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
    return () => { unsubUser(); };
  }, [userId]);

  const [myFixedExpenses, setMyFixedExpenses] = useState([]);
  const [myDeposits, setMyDeposits] = useState([]);
  const [globalDeposits, setGlobalDeposits] = useState([]);
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const [totalBazarAmount, setTotalBazarAmount] = useState(0);
  const [userMonthTotalMeals, setUserMonthTotalMeals] = useState(0);

  useEffect(() => {
    if (!db || !currentUser) return;

    // Create proper formatted date (DD-MM-YYYY) for search alignment
    const [y, m, d] = today.split('-');
    const formattedDate = `${d}-${m}-${y}`;

    // Listen to current member's today meals directly by document path
    const unsubToday = onSnapshot(doc(db, 'daily_meals', `${currentUser.id}_${formattedDate}`), snap => {
      setTodayMeals(snap.exists() ? snap.data() : {});
    });

    // Recent logs
    const unsubLogs = onSnapshot(query(collection(db, 'daily_meals'), where('memberId', '==', currentUser.id), limit(30)), snap => {
      const logs = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      // Sort in JS to avoid index errors on date/memberId mismatch
      logs.sort((a, b) => b.date.localeCompare(a.date));
      setMealLogs(logs.slice(0, 10));
    });

    // Listen to personal fixed expenses
    const unsubFixed = onSnapshot(query(collection(db, 'fixed_expenses'), where('memberId', '==', currentUser.id)), snap => {
      setMyFixedExpenses(snap.docs.map(docSnap => docSnap.data()));
    });

    // Listen to personal deposits
    const unsubDeposits = onSnapshot(query(collection(db, 'deposits'), where('memberId', '==', currentUser.id)), snap => {
      setMyDeposits(snap.docs.map(docSnap => docSnap.data()));
    });

    // Listen to global deposits
    const unsubGlobalDeposits = onSnapshot(collection(db, 'deposits'), snap => {
      setGlobalDeposits(snap.docs.map(dSnap => dSnap.data()));
    });

    // Monthly Bazar amount for the current month
    const qBazar = query(collection(db, 'bazar_records'));
    const unsubBazar = onSnapshot(qBazar, snap => {
      const sum = snap.docs.reduce((s, docSnap) => s + Number(docSnap.data().amount || 0), 0);
      setTotalBazarAmount(sum);
    });

    // Monthly Daily meals for the current month
    const qMeals = query(collection(db, 'daily_meals'));
    const unsubMeals = onSnapshot(qMeals, snap => {
      const sumAll = snap.docs.reduce((s, docSnap) => s + Number(docSnap.data().count || 0), 0);
      setMonthTotalMeals(sumAll);

      const sumUser = snap.docs.reduce((s, docSnap) => {
        const data = docSnap.data();
        if (data.memberId === currentUser.id || data.user_id === currentUser.id) {
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
      unsubGlobalDeposits();
      unsubBazar();
      unsubMeals();
    };
  }, [currentUser, today]);

  const liveMealRate = useMemo(() => {
    if (monthTotalMeals === 0) return 0;
    return (totalBazarAmount / monthTotalMeals).toFixed(2);
  }, [totalBazarAmount, monthTotalMeals]);

  // Global calculations for the 5 metric cards
  const globalDepositSum = useMemo(() => {
    return globalDeposits.reduce((sum, docSnap) => sum + Number(docSnap.amount || 0), 0);
  }, [globalDeposits]);

  const globalTotalCost = useMemo(() => {
    return Number(totalBazarAmount);
  }, [totalBazarAmount]);

  const globalNetBalance = useMemo(() => {
    return globalDepositSum - globalTotalCost;
  }, [globalDepositSum, globalTotalCost]);

  // Personal calculations (for warning alert & status card)
  const personalTotalDeposit = useMemo(() => {
    return myDeposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  }, [myDeposits]);

  const personalFixedCost = useMemo(() => {
    return myFixedExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }, [myFixedExpenses]);

  const personalTotalCost = useMemo(() => {
    return (Number(userMonthTotalMeals) * Number(liveMealRate)) + personalFixedCost;
  }, [userMonthTotalMeals, liveMealRate, personalFixedCost]);

  const personalNetBalance = useMemo(() => {
    return personalTotalDeposit - personalTotalCost;
  }, [personalTotalDeposit, personalTotalCost]);

  if (!currentUser) return <div className="loading">লোড হচ্ছে...</div>;

  return (
    <div className="app-layout" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={false} />
      <main className="main-content" style={{ padding: '0 0 80px 0', flex: 1 }}>
        <Navbar userName={currentUser?.name} userRole={currentUser?.role === 'manager' ? 'ম্যানেজার' : 'সদস্য'} photoURL={currentUser?.photoURL} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {personalNetBalance < 0 && (
            <div className="alert-danger">
              <span style={{ fontWeight:'bold' }}>!</span> 
              <span>ব্যালেন্স সতর্কতা: আপনার ব্যালেন্স নেগেティブ (৳{personalNetBalance.toFixed(0)})। দয়া করে ফান্ড ডিপোজিট করুন।</span>
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
                {monthTotalMeals} টি
              </span>
            </div>
            <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-green)' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>মোট জমা</p>
              <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-green)' }}>
                ৳{globalDepositSum.toLocaleString()}
              </span>
            </div>
            <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-purple)' }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>মোট খরচ</p>
              <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-purple)' }}>
                ৳{globalTotalCost.toFixed(0)}
              </span>
            </div>
            <div className="card glass-card" style={{ borderLeft: `5px solid ${globalNetBalance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>
                {globalNetBalance >= 0 ? 'ক্যাশ ব্যালেন্স' : 'ম্যানেজার পাবে'}
              </p>
              <span style={{ fontSize:'2.5rem', fontWeight:'900', color: globalNetBalance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                ৳{Math.abs(globalNetBalance).toFixed(0)}
              </span>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize:'1.1rem', fontWeight:'600', marginBottom:'1rem' }}>📊 আর্থিক অবস্থা</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>মোট জমা:</span> <span style={{ fontWeight:'700' }}>৳{personalTotalDeposit.toLocaleString()}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>চলতি মাসের মিল খরচ:</span> <span style={{ fontWeight:'700' }}>৳{(Number(userMonthTotalMeals) * Number(liveMealRate)).toFixed(0)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>ফিক্সড খরচ:</span> <span style={{ fontWeight:'700' }}>৳{personalFixedCost.toFixed(0)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>মোট খরচ:</span> <span style={{ fontWeight:'700' }}>৳{personalTotalCost.toFixed(0)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>নিট ব্যালেন্স:</span> <span style={{ fontWeight:'700', color: personalNetBalance < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{personalNetBalance.toFixed(0)}</span></div>
              </div>
            </div>

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
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', background:'var(--surface-hover)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-color)', textAlign:'center', minHeight:'120px' }}>
                <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem', marginBottom:'0.5rem' }}>আজকের মোট মিল সংখ্যা</p>
                <span style={{ fontSize:'3.5rem', fontWeight:'900', color:'var(--accent-orange)' }}>
                  {Number(todayMeals.count || 0)} টি
                </span>
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
                    <th style={{ textAlign:'right' }}>মিল সংখ্যা</th>
                  </tr>
                </thead>
                <tbody>
                  {mealLogs.length === 0 ? (
                    <tr><td colSpan="2" style={{ textAlign:'center', color:'var(--text-secondary)', padding:'2rem' }}>কোনো রেকর্ড পাওয়া যায়নি।</td></tr>
                  ) : mealLogs.map(log => {
                    return (
                      <tr key={log.id}>
                        <td>{log.date}</td>
                        <td style={{ textAlign:'right', fontWeight:'700', color:'var(--accent-blue)' }}>
                          <span className="badge badge-blue" style={{ fontSize: '0.9rem' }}>
                            {Number(log.count || 0)} টি
                          </span>
                        </td>
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

export default MemberDashboard;
