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
    <div className="app-layout overflow-x-hidden w-full max-w-[100vw]" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={true} />
      <main className="main-content overflow-x-hidden w-full max-w-[100vw]" style={{ padding: 0 }}>
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
  const [globalTotalMeals, setGlobalTotalMeals] = useState(0);
  const [totalBazarAmount, setTotalBazarAmount] = useState(0);
  const [globalDepositSum, setGlobalDepositSum] = useState(0);
  
  const [selectedDateIso, setSelectedDateIso] = useState(getTodayDateString());

  // Unified Fetching for Dashboard Metrics (Using Users Collection for Bulletproof Summation)
  useEffect(() => {
    if (!db) return;
    
    // 1 & 2. Total Meals and Total Deposits (Aggregated from Users Collection)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      let totalMeals = 0;
      let totalDeposits = 0;
      
      snap.docs.forEach((docSnap) => {
        const userData = docSnap.data();
        totalMeals += Number(userData.total_meals) || 0;
        totalDeposits += Number(userData.total_deposit) || 0;
      });
      
      setGlobalTotalMeals(totalMeals);
      setGlobalDepositSum(totalDeposits);
    });

    // 3. Total Bazar/Expense (All Active Data without date filters)
    const unsubBazar = onSnapshot(collection(db, 'bazar_records'), (snap) => {
      const sum = snap.docs.reduce((acc, docSnap) => acc + Number(docSnap.data().amount || 0), 0);
      setTotalBazarAmount(sum);
    });

    return () => {
      unsubUsers();
      unsubBazar();
    };
  }, []);

  const liveMealRate = useMemo(() => {
    if (globalTotalMeals === 0) return 0;
    return (totalBazarAmount / globalTotalMeals).toFixed(2);
  }, [totalBazarAmount, globalTotalMeals]);

  // মোট খরচ = exclusively bazar_records sum
  const totalCost = Number(totalBazarAmount);

  // ক্যাশ ব্যালেন্স = মোট জমা - মোট বাজার খরচ
  const netBalance = globalDepositSum - totalCost;

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
      <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-orange)' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>লাইভ মিল রেট</p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-orange)' }}>
            ৳{liveMealRate}
          </span>
        </div>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-blue)' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>মোট মিল</p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-blue)' }}>
            {globalTotalMeals} টি
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
