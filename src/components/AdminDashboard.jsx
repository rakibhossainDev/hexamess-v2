import { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  db, collection, doc, onSnapshot, query, where
} from '../utils/firebase';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getTodayDateString } from '../utils/monthUtils';

// This component handles the layout for all admin pages
const AdminDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const userId = localStorage.getItem('hexamess-user-id');

  useEffect(() => {
    if (!db || !userId) return;
    const unsub = onSnapshot(doc(db, 'users', userId), snap => {
      if (snap.exists()) setCurrentUser(snap.data());
    });
    return () => unsub();
  }, [userId]);

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
  const [config, setConfig] = useState(null);
  const [todaySavedMeals, setTodaySavedMeals] = useState(0);
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const [totalBazarAmount, setTotalBazarAmount] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [selectedDateIso, setSelectedDateIso] = useState(getTodayDateString());

  // UNIFIED DATE HELPERS
  const { docIdKey, monthId } = useMemo(() => {
    if (!selectedDateIso) return { docIdKey: '', monthId: '' };
    const [y, m, d] = selectedDateIso.split('-');
    return {
      docIdKey: `${d}-${m}-${y}`,
      monthId: `${m}-${y}`
    };
  }, [selectedDateIso]);

  useEffect(() => {
    if (!db) return;
    // Config listener
    const unsubConfig = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => unsubConfig();
  }, []);

  // 3. Automated Dashboard Calculations (Unified from daily_meals)
  useEffect(() => {
    if (!db || !docIdKey) return;
    
    setFetching(true);

    // A. Today's Total Listener (DD-MM-YYYY)
    const unsubToday = onSnapshot(
      query(collection(db, 'daily_meals'), where('date', '==', docIdKey)),
      (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + Number(d.data().count || 0), 0);
        setTodaySavedMeals(total);
        setFetching(false);
      }
    );

    // B. Monthly Total Listener (MM-YYYY)
    const unsubMonth = onSnapshot(
      query(collection(db, 'daily_meals'), where('monthYear', '==', monthId)),
      (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + Number(d.data().count || 0), 0);
        setMonthTotalMeals(total);
      }
    );

    // C. Monthly Bazar Listener (MM-YYYY)
    const unsubBazar = onSnapshot(
      query(collection(db, 'bazar_records'), where('monthYear', '==', monthId)),
      (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
        setTotalBazarAmount(total);
      }
    );

    return () => {
      unsubToday();
      unsubMonth();
      unsubBazar();
    };
  }, [docIdKey, monthId]);

  const liveMealRate = useMemo(() => {
    if (monthTotalMeals === 0) return 0;
    return (totalBazarAmount / monthTotalMeals).toFixed(2);
  }, [totalBazarAmount, monthTotalMeals]);

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

      {/* Top Automated Cards */}
      <div className="stats-grid" style={{ marginBottom:'2rem' }}>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-blue)', opacity: fetching ? 0.6 : 1 }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>আজকের মোট মিল <span className="live-icon" /></p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-blue)' }}>
            {fetching ? '...' : todaySavedMeals} টি
          </span>
        </div>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-orange)' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>এই মাসের চলতি মোট মিল</p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-orange)' }}>
            {monthTotalMeals} টি
          </span>
        </div>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-green)' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>লাইভ মিল রেট</p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-green)' }}>
            ৳{liveMealRate}
          </span>
        </div>
      </div>

      <div className="card glass-card">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-blue)' }}>দ্রুত নির্দেশিকা</h3>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <li>মেম্বারদের মিল প্রতিদিন <strong>Meal Management</strong> থেকে ইনপুট করুন।</li>
          <li>প্রতিটি সেভ করার পর ড্যাশবোর্ড অটোমেটিক আপডেট হবে।</li>
          <li>বিলের হিসাব মাসের শেষে <strong>Settings</strong> থেকে জেনারেট করুন।</li>
          <li>কোন সমস্যা হলে সিস্টেম অ্যাডমিনের সাথে যোগাযোগ করুন।</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminDashboard;
