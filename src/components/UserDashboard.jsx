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
  const [globalDeposits, setGlobalDeposits] = useState([]);
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const [totalBazarAmount, setTotalBazarAmount] = useState(0);

  useEffect(() => {
    if (!db || !currentUser) return;

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
      setMealLogs(logs.slice(0, 31));
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


    // Listen to global deposits
    const unsubGlobalDeposits = onSnapshot(collection(db, 'deposits'), snap => {
      setGlobalDeposits(snap.docs.map(dSnap => dSnap.data()));
    });

    // Monthly Bazar amount for the current month
    const qBazar = query(collection(db, 'bazar_records'));
    const unsubBazar = onSnapshot(qBazar, snap => {
      const sum = snap.docs.reduce((s, dSnap) => s + Number(dSnap.data().amount || 0), 0);
      setTotalBazarAmount(sum);
    });

    // Monthly Daily meals for the current month (Global + User filtering)
    const qMealsGlobal = query(collection(db, 'daily_meals'));
    const unsubMealsGlobal = onSnapshot(qMealsGlobal, snap => {
      const sumAll = snap.docs.reduce((s, dSnap) => s + Number(dSnap.data().count || 0), 0);
      setMonthTotalMeals(sumAll);
    });


    return () => {
      unsubToday();
      unsubLogs();
      unsubFixed();
      unsubGlobalDeposits();
      unsubBazar();
      unsubMealsGlobal();
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



  if (!currentUser) return <div className="loading">লোড হচ্ছে...</div>;

  return (
    <div className="app-layout overflow-x-hidden w-full max-w-[100vw]" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={false} />
      <main className="main-content overflow-x-hidden w-full max-w-[100vw]" style={{ padding: '0 0 80px 0', flex: 1 }}>
        <Navbar userName={currentUser?.name} userRole={currentUser?.username === 'manager' ? 'ম্যানেজার' : 'সদস্য'} photoURL={currentUser?.photoURL} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Dynamic 5 Metric Cards */}
          <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
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
            <div className="w-full">
              {/* Header Row */}
              <div className="flex justify-between items-center w-full pb-2 border-b border-[var(--border-color)] text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold mb-2">
                <span>তারিখ</span>
                <span>মিল সংখ্যা</span>
              </div>
              
              {/* Scrollable Body Rows */}
              <div className="max-h-[280px] overflow-y-auto pr-1 css-scrollbar scrollbar-thin scrollbar-thumb-gray-800 divide-y divide-gray-800">
                {mealLogs.length === 0 ? (
                  <div className="text-center text-[var(--text-secondary)] py-8">কোনো রেকর্ড পাওয়া যায়নি।</div>
                ) : mealLogs.map(log => {
                  return (
                    <div key={log.id} className="w-full flex justify-between items-center py-2.5 border-b border-gray-800 text-sm md:text-base text-[var(--text-primary)]">
                      <span className="font-medium">{log.date}</span>
                      <span style={{ fontWeight:'700', color:'var(--accent-blue)' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.9rem', backgroundColor: 'rgba(0, 209, 255, 0.1)', color: 'var(--accent-blue)', border: 'none' }}>
                          {Number(log.count || 0)} টি
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNav isManager={currentUser?.username === 'manager'} />
    </div>
  );
};

export default UserDashboard;
