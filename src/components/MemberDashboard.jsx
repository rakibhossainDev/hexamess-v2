import { useState, useEffect, useMemo } from 'react';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, increment, query, where, orderBy, limit, addDoc } from '../firebase';
import { getTodayDateString, getTodayDisplay } from '../utils/monthUtils';

const MemberDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [approvedExpenses, setApprovedExpenses] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [mealLogs, setMealLogs] = useState([]);
  const [details, setDetails] = useState('');
  const [cost, setCost] = useState('');
  const [advance, setAdvance] = useState('');
  const { toasts, showToast, removeToast } = useToast();

  const userId = localStorage.getItem('hexamess-user-id');
  const today = getTodayDateString();

  useEffect(() => {
    if (!db || !userId) return;
    // Real-time listener for current user data
    const unsubUser = onSnapshot(doc(db, 'users', userId), snap => {
      if (snap.exists()) setCurrentUser({ id: snap.id, ...snap.data() });
    });
    const unsubConfig = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { unsubUser(); unsubConfig(); };
  }, [userId]);

  const [fixedBills, setFixedBills] = useState([]);

  useEffect(() => {
    if (!db || !config || !currentUser) return;
    const mid = config.current_month_id;
    
    // Global Stats for Rate Calculation
    const qExp = query(collection(db, 'expenses'), where('month_id', '==', mid), where('status', '==', 'approved'));
    const unsubExp = onSnapshot(qExp, snap => setApprovedExpenses(snap.docs.map(d => d.data())));

    // User's specific meal for today
    const qToday = query(collection(db, 'meals'), where('month_id', '==', mid), where('date', '==', today), where('user_id', '==', currentUser.id));
    const unsubToday = onSnapshot(qToday, snap => {
      setTodayMeals(snap.docs.length > 0 ? snap.docs[0].data() : {});
    });

    // Recent Logs
    const qLogs = query(collection(db, 'meals'), where('user_id', '==', currentUser.id), orderBy('date', 'desc'), limit(10));
    const unsubLogs = onSnapshot(qLogs, snap => setMealLogs(snap.docs.map(d => ({ id:d.id, ...d.data() }))));

    // Fixed Bills
    const qFixed = query(collection(db, 'fixed_costs'), where('month_id', '==', mid));
    const unsubFixed = onSnapshot(qFixed, snap => setFixedBills(snap.docs.map(d => ({ id:d.id, ...d.data() }))));

    return () => { unsubExp(); unsubToday(); unsubLogs(); unsubFixed(); };
  }, [config, currentUser, today]);

  // Global live rate calculation
  const totalApprovedMarket = useMemo(() => approvedExpenses.reduce((s, e) => s + (Number(e.cost)||0), 0), [approvedExpenses]);
  // We need total meals from ALL users to calculate global rate accurately
  // For simplicity here, we assume total meals is tracked or fetch all users
  const [totalMeals, setTotalMeals] = useState(0);
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      const sum = snap.docs.reduce((s, d) => s + (Number(d.data().total_meals)||0), 0);
      setTotalMeals(sum);
    });
    return () => unsub();
  }, []);

  const [activeMemberCount, setActiveMemberCount] = useState(6);
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(query(collection(db, 'users'), where('status', '==', 'active')), snap => {
      setActiveMemberCount(snap.docs.length || 6);
    });
    return () => unsub();
  }, []);

  const liveMealRate = useMemo(() => totalMeals === 0 ? 0 : (totalApprovedMarket / totalMeals).toFixed(2), [totalApprovedMarket, totalMeals]);

  const deposit = currentUser?.total_deposit || 0;
  const myMeals = currentUser?.total_meals || 0;
  const currentBalance = currentUser?.current_balance || 0;
  const mealCost = useMemo(() => (myMeals * Number(liveMealRate)), [myMeals, liveMealRate]);
  const effectiveBalance = useMemo(() => (currentBalance - mealCost).toFixed(0), [currentBalance, mealCost]);

  const handleMealToggle = async (mealType) => {
    if (!config || !currentUser) return;
    const currentVal = !!todayMeals[mealType];
    const newVal = !currentVal;
    const mealValue = mealType === 'breakfast' ? 0.5 : 1;
    const delta = newVal ? mealValue : -mealValue;
    const mealDocId = `${config.current_month_id}_${today}_${currentUser.id}`;
    
    try {
      await setDoc(doc(db, 'meals', mealDocId), {
        month_id: config.current_month_id, date: today, user_id: currentUser.id,
        [mealType]: newVal,
        ...(Object.keys(todayMeals).length === 0 ? { breakfast:false, lunch:false, dinner:false, [mealType]:newVal } : {}),
      }, { merge: true });
      await updateDoc(doc(db, 'users', currentUser.id), { total_meals: increment(delta) });
    } catch (err) { console.error(err); showToast('মিল আপডেট ব্যর্থ।', 'error'); }
  };

  const handleMarketSubmit = async (e) => {
    e.preventDefault();
    if (!details || !cost || !config || !currentUser) { showToast('সব তথ্য পূরণ করুন।', 'error'); return; }
    try {
      await addDoc(collection(db, 'expenses'), {
        month_id: config.current_month_id,
        date: new Date().toISOString().split('T')[0],
        shopper_id: currentUser.id, shopper_name: currentUser.name,
        details, cost: Number(cost), advance: Number(advance)||0, status: 'pending',
      });
      showToast('বাজারের হিসাব সাবমিট হয়েছে, অনুমোদনের অপেক্ষায়!', 'success');
      setDetails(''); setCost(''); setAdvance('');
    } catch (err) { console.error(err); showToast('সাবমিট ব্যর্থ।', 'error'); }
  };

  if (!currentUser) return <div className="loading">লোড হচ্ছে...</div>;

  return (
    <div className="app-layout">
      <main className="main-content" style={{ padding: '0 0 80px 0' }}>
        <Navbar userName={currentUser?.name} userRole="সদস্য" photoURL={currentUser?.photoURL} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {effectiveBalance < 0 && (
            <div className="alert-danger">
              <span style={{ fontWeight:'bold' }}>!</span> 
              <span>ব্যালেন্স সতর্কতা: আপনার ব্যালেন্স নেগেটিভ (৳{effectiveBalance})। দয়া করে ফান্ড ডিপোজিট করুন।</span>
            </div>
          )}

          {/* Personal Stats Grid */}
          <div className="stats-grid">
            <StatCard label="লাইভ মিল রেট" value={`৳${liveMealRate}`} color="var(--accent-orange)" glow />
            <StatCard label="মোট জমা" value={`৳${deposit.toLocaleString()}`} color="var(--accent-green)" />
            <StatCard label="বকেয়া" value={effectiveBalance < 0 ? `৳${Math.abs(effectiveBalance).toLocaleString()}` : '৳০'} color="var(--accent-red)" />
            <StatCard label="মেস থেকে পাওয়া" value={effectiveBalance > 0 ? `৳${Number(effectiveBalance).toLocaleString()}` : '৳০'} color="var(--accent-blue)" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'1.5rem' }}>
            {/* Summary Info */}
            <div className="card">
              <h3 style={{ fontSize:'1.1rem', fontWeight:'600', marginBottom:'1rem' }}>📊 আর্থিক অবস্থা</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>মোট জমা:</span> <span style={{ fontWeight:'700' }}>৳{deposit.toLocaleString()}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>মোট মিল:</span> <span style={{ fontWeight:'700' }}>{myMeals}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>মিল খরচ:</span> <span style={{ fontWeight:'700' }}>৳{mealCost.toFixed(0)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>নিট ব্যালেন্স:</span> <span style={{ fontWeight:'700', color: effectiveBalance < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{effectiveBalance}</span></div>
              </div>
            </div>

            {/* Fixed Bills Section */}
            <div className="card">
              <h3 style={{ fontSize:'1.1rem', fontWeight:'600', marginBottom:'1.5rem' }}>🏠 ফিক্সড বিল সমূহ (১/{activeMemberCount})</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {fixedBills.length === 0 ? (
                  <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem' }}>এই মাসে কোনো ফিক্সড বিল নেই।</p>
                ) : fixedBills.map(bill => (
                  <div key={bill.id} style={{ display:'flex', justifyContent:'space-between', padding:'0.75rem', background:'var(--surface-hover)', borderRadius:'var(--radius-sm)' }}>
                    <span>{bill.category}</span>
                    <span style={{ fontWeight:'700' }}>৳{(bill.amount / activeMemberCount).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Meal Toggle Section */}
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                <h3 style={{ fontSize:'1.1rem', fontWeight:'600' }}>🍽️ আজকের মিল</h3>
                <span className="badge badge-manager" style={{ fontSize:'0.75rem' }}>{getTodayDisplay()}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                <MealItem label="সকাল (০.৫)" checked={!!todayMeals.breakfast} onToggle={() => handleMealToggle('breakfast')} />
                <MealItem label="দুপুর (১.০)" checked={!!todayMeals.lunch} onToggle={() => handleMealToggle('lunch')} />
                <MealItem label="রাত (১.০)" checked={!!todayMeals.dinner} onToggle={() => handleMealToggle('dinner')} />
              </div>
            </div>

            {/* Quick Market Entry */}
            <div className="card">
              <h3 style={{ fontSize:'1.1rem', fontWeight:'600', marginBottom:'1.5rem' }}>🛒 বাজার এন্ট্রি পাঠান</h3>
              <form onSubmit={handleMarketSubmit}>
                <div className="form-group">
                  <label>বাজারের বিবরণ</label>
                  <input className="form-control" placeholder="যেমন: চাল, ডাল, তেল..." value={details} onChange={e => setDetails(e.target.value)} required />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.25rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>খরচ (৳)</label>
                    <input type="number" className="form-control" value={cost} onChange={e => setCost(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>এডভান্স (৳)</label>
                    <input type="number" className="form-control" value={advance} onChange={e => setAdvance(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width:'100%' }}>সাবমিট করুন</button>
              </form>
            </div>
          </div>

          {/* Recent Meal History Table */}
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
                    const total = (log.breakfast?0.5:0) + (log.lunch?1:0) + (log.dinner?1:0);
                    return (
                      <tr key={log.id}>
                        <td>{log.date}</td>
                        <td style={{ textAlign:'center' }}>{log.breakfast ? '✅' : '—'}</td>
                        <td style={{ textAlign:'center' }}>{log.lunch ? '✅' : '—'}</td>
                        <td style={{ textAlign:'center' }}>{log.dinner ? '✅' : '—'}</td>
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
      <BottomNav isManager={false} />
    </div>
  );
};

const StatCard = ({ label, value, color, glow }) => (
  <div className="card" style={{ position:'relative', overflow:'hidden' }}>
    {glow && <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'80px', height:'80px', background:color, filter:'blur(40px)', opacity:'0.1', borderRadius:'50%' }} />}
    <p style={{ color:'var(--text-secondary)', fontSize:'0.8rem', fontWeight:'500', marginBottom:'0.5rem' }}>{label}</p>
    <p style={{ fontSize:'1.75rem', fontWeight:'700', color }}>{value}</p>
  </div>
);

const MealItem = ({ label, checked, onToggle }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem', background:'var(--surface-hover)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-color)' }}>
    <span style={{ fontWeight:'500' }}>{label}</span>
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="slider"></span>
    </label>
  </div>
);

export default MemberDashboard;
