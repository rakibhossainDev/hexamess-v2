import { useState, useEffect, useMemo } from 'react';
import { db, doc, onSnapshot, collection, query, where, orderBy, limit, addDoc } from '../utils/firebase';
import { getTodayDateString, getTodayDisplay } from '../utils/monthUtils';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const MemberDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [approvedExpenses, setApprovedExpenses] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [mealLogs, setMealLogs] = useState([]);
  const { toasts, showToast, removeToast } = useToast();

  const userId = localStorage.getItem('hexamess-user-id');
  const today = getTodayDateString();

  // Load config & user
  useEffect(() => {
    if (!db || !userId) return;
    const unsubUser = onSnapshot(doc(db, 'users', userId), snap => {
      if (snap.exists()) setCurrentUser({ id: snap.id, ...snap.data() });
    });
    const unsubConfig = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { unsubUser(); unsubConfig(); };
  }, [userId]);

  const [myFixedExpenses, setMyFixedExpenses] = useState([]);

  useEffect(() => {
    if (!db || !config || !currentUser) return;
    const mid = config.current_month_id;
    
    const unsubExp = onSnapshot(query(collection(db, 'expenses'), where('month_id', '==', mid), where('status', '==', 'approved')), snap => setApprovedExpenses(snap.docs.map(d => d.data())));

    const unsubToday = onSnapshot(query(collection(db, 'daily_meals'), where('month_id', '==', mid), where('date', '==', today), where('user_id', '==', currentUser.id)), snap => {
      setTodayMeals(snap.docs.length > 0 ? snap.docs[0].data() : {});
    });

    const unsubLogs = onSnapshot(query(collection(db, 'daily_meals'), where('user_id', '==', currentUser.id), orderBy('date', 'desc'), limit(10)), snap => setMealLogs(snap.docs.map(d => ({ id:d.id, ...d.data() }))));

    const unsubFixed = onSnapshot(query(collection(db, 'fixed_expenses'), where('memberId', '==', currentUser.id)), snap => {
      setMyFixedExpenses(snap.docs.map(d => d.data()));
    });

    return () => { unsubExp(); unsubToday(); unsubLogs(); unsubFixed(); };
  }, [config, currentUser, today]);

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

  const totalApprovedMarket = useMemo(() => approvedExpenses.reduce((s, e) => s + (Number(e.cost)||0), 0), [approvedExpenses]);
  const liveMealRate = useMemo(() => totalMeals === 0 ? 0 : (totalApprovedMarket / totalMeals).toFixed(2), [totalApprovedMarket, totalMeals]);

  const deposit = currentUser?.total_deposit || 0;
  const myMeals = currentUser?.total_meals || 0;
  const totalFixedCost = useMemo(() => {
    return myFixedExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }, [myFixedExpenses]);

  const totalMealCost = useMemo(() => (myMeals * Number(liveMealRate)), [myMeals, liveMealRate]);
  const netBalance = useMemo(() => (deposit - (totalMealCost + totalFixedCost)), [deposit, totalMealCost, totalFixedCost]);

  const handleMealToggle = async (mealType) => {
    if (!config || !currentUser) return;
    const prevVal = Number(todayMeals[mealType] || 0);
    const newVal = prevVal > 0 ? 0 : (mealType === 'breakfast' ? 0.5 : 1);
    
    // In our simplified direct system, manager inputs it or user toggles on dashboard
    // If you need direct updates, you can create/update the daily_meals document
    try {
      const mid = config.current_month_id;
      const ref = doc(db, 'daily_meals', `${currentUser.id}_${today}`);
      const payload = {
        ...todayMeals,
        user_id: currentUser.id,
        userName: currentUser.name,
        month_id: mid,
        date: today,
        [mealType]: newVal,
        count: (Number(todayMeals.breakfast||0) - prevVal + newVal) + (Number(todayMeals.lunch||0)) + (Number(todayMeals.dinner||0))
      };
      // adjust logic for count correctly
      let breakfastVal = mealType === 'breakfast' ? newVal : Number(todayMeals.breakfast || 0);
      let lunchVal = mealType === 'lunch' ? newVal : Number(todayMeals.lunch || 0);
      let dinnerVal = mealType === 'dinner' ? newVal : Number(todayMeals.dinner || 0);
      payload.count = breakfastVal + lunchVal + dinnerVal;

      const { setDoc } = await import('../utils/firebase');
      await setDoc(ref, payload, { merge: true });
      showToast('মিল স্ট্যাটাস আপডেট হয়েছে!', 'success');
    } catch (err) {
      console.error(err);
      showToast('মিল সেভ করা যায়নি।', 'error');
    }
  };

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [details, setDetails] = useState('');
  const [cost, setCost] = useState('');
  const [advance, setAdvance] = useState('');

  const handleMarketSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !config) return;
    try {
      const mid = config.current_month_id;
      await addDoc(collection(db, 'expenses'), {
        user_id: currentUser.id,
        userName: currentUser.name,
        month_id: mid,
        date: today,
        itemName,
        quantity,
        cost: Number(cost), advance: Number(advance)||0, status: 'pending',
      });
      showToast('বাজারের হিসাব সাবমিট হয়েছে, অনুমোদনের অপেক্ষায়!', 'success');
      setDetails(''); setItemName(''); setQuantity(''); setCost(''); setAdvance('');
    } catch (err) { console.error(err); showToast('সাবমিট ব্যর্থ।', 'error'); }
  };

  if (!currentUser) return <div className="loading">লোড হচ্ছে...</div>;

  return (
    <div className="app-layout">
      <main className="main-content" style={{ padding: '0 0 80px 0' }}>
        <Navbar userName={currentUser?.name} userRole={currentUser?.role === 'manager' ? 'ম্যানেজার' : 'সদস্য'} photoURL={currentUser?.photoURL} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {netBalance < 0 && (
            <div className="alert-danger">
              <span style={{ fontWeight:'bold' }}>!</span> 
              <span>ব্যালেন্স সতর্কতা: আপনার ব্যালেন্স নেগেটিভ (৳{netBalance.toFixed(0)})। দয়া করে ফান্ড ডিপোজিট করুন।</span>
            </div>
          )}

          <div className="stats-grid">
            <StatCard label="লাইভ মিল রেট" value={`৳${liveMealRate}`} color="var(--accent-orange)" glow />
            <StatCard label="মোট জমা" value={`৳${deposit.toLocaleString()}`} color="var(--accent-green)" />
            <StatCard label="মোট বকেয়া" value={netBalance < 0 ? `৳${Math.abs(netBalance).toFixed(0)}` : '৳০'} color="var(--accent-red)" />
            <StatCard label="মেস থেকে পাওয়া" value={netBalance >= 0 ? `৳${netBalance.toFixed(0)}` : '৳০'} color="var(--accent-blue)" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize:'1.1rem', fontWeight:'600', marginBottom:'1rem' }}>📊 আর্থিক অবস্থা</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>মোট জমা:</span> <span style={{ fontWeight:'700' }}>৳{deposit.toLocaleString()}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>মোট মিল:</span> <span style={{ fontWeight:'700' }}>{myMeals}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>মিল খরচ:</span> <span style={{ fontWeight:'700' }}>৳{totalMealCost.toFixed(0)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>ফিক্সড খরচ:</span> <span style={{ fontWeight:'700' }}>৳{totalFixedCost.toFixed(0)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}><span>নিট ব্যালেন্স:</span> <span style={{ fontWeight:'700', color: netBalance < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{netBalance.toFixed(0)}</span></div>
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
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                <MealItem label={<span>সকাল (০.৫)</span>} checked={Number(todayMeals.breakfast) > 0} onToggle={() => handleMealToggle('breakfast')} />
                <MealItem label={<span>দুপুর <b style={{ color:'var(--accent-orange)' }}>(১.০)</b></span>} checked={Number(todayMeals.lunch) > 0} onToggle={() => handleMealToggle('lunch')} />
                <MealItem label={<span>রাত <b style={{ color:'var(--accent-orange)' }}>(১.০)</b></span>} checked={Number(todayMeals.dinner) > 0} onToggle={() => handleMealToggle('dinner')} />
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize:'1.1rem', fontWeight:'600', marginBottom:'1.5rem' }}>🛒 বাজার এন্ট্রি পাঠান</h3>
              <form onSubmit={handleMarketSubmit}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>পণ্যের নাম</label>
                    <input className="form-control" placeholder="যেমন: চাল" value={itemName} onChange={e => setItemName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>পরিমাণ</label>
                    <input className="form-control" placeholder="যেমন: ৫ কেজি" value={quantity} onChange={e => setQuantity(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>বাজারের বিবরণ (ঐচ্ছিক)</label>
                  <input className="form-control" placeholder="অন্যান্য তথ্য..." value={details} onChange={e => setDetails(e.target.value)} />
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
