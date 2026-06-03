import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  db, collection, doc, onSnapshot, query, where
} from '../utils/firebase';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { getTodayDateString } from '../utils/monthUtils';

// This component handles the layout for all admin pages
const AdminDashboard = () => {
  const userId = localStorage.getItem('hexamess-user-id');
  const [currentUser, setCurrentUser] = useState(() => {
    if (userId === 'manager') return { name: 'মেস ম্যানেজার', role: 'manager' };
    return null;
  });
  const navigate = useNavigate();

  // Instant local storage check to prevent flicker
  useEffect(() => {
    const cachedRole = localStorage.getItem('hexamess-user-role');
    if (cachedRole && cachedRole !== 'manager' && cachedRole !== 'admin') {
      alert("আপনার এই পেজে ঢোকার অনুমতি নেই!");
      navigate('/dashboard');
    }
  }, [navigate]);

  useEffect(() => {
    if (!db || !userId) return;
    if (userId === 'manager') return;
    
    const unsub = onSnapshot(doc(db, 'users', userId), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentUser(data);
        if (data.role !== 'manager' && data.role !== 'admin') {
          alert("আপনার এই পেজে ঢোকার অনুমতি নেই!");
          navigate('/dashboard');
        }
      }
    });
    return () => unsub();
  }, [userId, navigate]);

  return (
    <div className="app-layout" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={true} />
      <main className="main-content" style={{ padding: 0 }}>
        <Navbar userName={currentUser?.name || "ম্যানেজার"} userRole="ম্যানেজার" photoURL={currentUser?.photoURL} />
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '80px' }}>
          <Outlet />
        </div>
        <BottomNav isManager={true} />
      </main>
    </div>
  );
};

// This is the actual Dashboard Home View
export const DashboardHome = () => {
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const [totalBazarAmount, setTotalBazarAmount] = useState(0);
  const [selectedDateIso, setSelectedDateIso] = useState(getTodayDateString());

  // Dynamic state for aggregated admin overview
  const [allDeposits, setAllDeposits] = useState([]);

  // UNIFIED DATE HELPERS
  const { docIdKey, monthId } = useMemo(() => {
    if (!selectedDateIso) return { docIdKey: '', monthId: '' };
    const [y, m, d] = selectedDateIso.split('-');
    return {
      docIdKey: `${d}-${m}-${y}`,
      monthId: `${m}-${y}`
    };
  }, [selectedDateIso]);

  // 3. Automated Dashboard Calculations (Unified from daily_meals)
  useEffect(() => {
    if (!db || !docIdKey) return;
    
    // B. Monthly Total Listener (MM-YYYY)
    const unsubMonth = onSnapshot(
      query(collection(db, 'daily_meals')),
      (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + Number(d.data().count || 0), 0);
        setMonthTotalMeals(total);
      }
    );

    // C. Monthly Bazar Listener (MM-YYYY)
    const unsubBazar = onSnapshot(
      query(collection(db, 'bazar_records')),
      (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
        setTotalBazarAmount(total);
      }
    );

    return () => {
      unsubMonth();
      unsubBazar();
    };
  }, [docIdKey, monthId]);

  // Listener for all deposits (fixed_expenses excluded from dashboard metrics)
  useEffect(() => {
    if (!db) return;
    const unsubDeposits = onSnapshot(collection(db, 'deposits'), snap => {
      setAllDeposits(snap.docs.map(d => d.data()));
    });
    return () => { unsubDeposits(); };
  }, []);

  const liveMealRate = useMemo(() => {
    if (monthTotalMeals === 0) return 0;
    return (totalBazarAmount / monthTotalMeals).toFixed(2);
  }, [totalBazarAmount, monthTotalMeals]);

  const currentTotalMeals = monthTotalMeals; // Total of all users combined for the current month

  const totalDeposit = useMemo(() => {
    return allDeposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  }, [allDeposits]);

  // মোট খরচ = exclusively bazar_records sum (fixed_expenses excluded)
  const totalCost = useMemo(() => {
    return Number(totalBazarAmount);
  }, [totalBazarAmount]);

  // ক্যাশ ব্যালেন্স = মোট জমা - মোট বাজার খরচ
  const netBalance = useMemo(() => {
    return totalDeposit - totalCost;
  }, [totalDeposit, totalCost]);

  return (
    <div className="fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>অ্যাডমিন ড্যাশবোর্ড</h2>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input 
            type="date" 
            className="form-control" 
            value={selectedDateIso} 
            onChange={(e) => setSelectedDateIso(e.target.value)}
            style={{ width: '160px' }}
          />
        </div>
      </div>

      {/* Dynamic 5 Metric Cards (Aggregated Mess overview) */}
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
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>মোট খরচ</p>
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

      <div className="card glass-card">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-blue)' }}>দ্রুত নির্দেশিকা</h3>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <li>মেম্বারদের মিল প্রতিদিন <strong>Meal Management</strong> থেকে ইনপুট করুন।</li>
          <li>প্রতিটি সেভ করার পর ড্যাশবোর্ড অটোমেটিক আপডেট হবে।</li>
          <li>ফিক্সড খরচ মাসের শেষে <strong>ফিক্সড খরচ</strong> থেকে এন্ট্রি ও ভাগ করে দিন।</li>
          <li>কোন সমস্যা হলে সিস্টেম অ্যাডমিনের সাথে যোগাযোগ করুন।</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminDashboard;
