import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  db, collection, doc, onSnapshot, addDoc, updateDoc, writeBatch,
  increment, serverTimestamp, query, where, getDocs, setDoc
} from '../firebase';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { EXPENSE_CATEGORIES, getTodayDateString } from '../utils/monthUtils';

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

export const DashboardHome = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [approvedExpenses, setApprovedExpenses] = useState([]);
  const [config, setConfig] = useState(null);
  
  // Stats States
  const [todayTotalMeals, setTodayTotalMeals] = useState(0);
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  
  // Meal Input States
  const [todayMeals, setTodayMeals] = useState({}); // Input buffer
  const [dbMeals, setDbMeals] = useState({});       // Verified DB state
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());

  // Other UI States
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [billCategory, setBillCategory] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ name:'', username:'', password:'', deposit:'' });
  const [isAdding, setIsAdding] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  const todaySlash = useMemo(() => {
    const [y, m, d] = selectedDate.split('-');
    return `${d}/${m}/${y}`;
  }, [selectedDate]);

  useEffect(() => {
    if (!db) return;
    const u1 = onSnapshot(collection(db, 'users'), snap => { setMembers(snap.docs.map(d => ({ id:d.id, ...d.data() }))); });
    const u2 = onSnapshot(doc(db, 'config', 'settings'), snap => { if (snap.exists()) setConfig(snap.data()); });
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    
    // 1. Fetch Stats & Pre-populate Input
    const unsubDaily = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('date', '==', todaySlash)
    ), snap => {
      let total = 0;
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const cnt = Number(data.count) || 0;
        total += cnt;
        if (data.memberId) mealsMap[data.memberId] = cnt;
      });
      setTodayTotalMeals(total);
      setDbMeals(mealsMap);
      setTodayMeals(prev => ({ ...mealsMap, ...prev })); // Merge existing into current input buffer
    });

    const unsubMonth = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('month_id', '==', mid)
    ), snap => {
      let total = 0;
      snap.docs.forEach(d => total += (Number(d.data().count) || 0));
      setMonthTotalMeals(total);
    });

    const unsubExp = onSnapshot(query(
      collection(db, 'expenses'), 
      where('month_id', '==', mid), 
      where('status', '==', 'approved')
    ), snap => {
      setApprovedExpenses(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });

    return () => { unsubDaily(); unsubMonth(); unsubExp(); };
  }, [config, todaySlash]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  const totalMarketCost = useMemo(() => approvedExpenses.reduce((s, e) => s + (Number(e.cost)||0), 0), [approvedExpenses]);
  const liveMealRate = useMemo(() => monthTotalMeals === 0 ? 0 : (totalMarketCost / monthTotalMeals).toFixed(2), [totalMarketCost, monthTotalMeals]);

  const handleMealChange = (memberId, value) => {
    setTodayMeals(prev => ({ ...prev, [memberId]: Number(value) }));
  };

  const handleSaveMeals = async () => {
    if (!db || !config || saving) return;
    setSaving(true);
    const batch = writeBatch(db);

    try {
      for (const m of activeMembers) {
        const count = Number(todayMeals[m.id] || 0);
        const prevCount = Number(dbMeals[m.id] || 0);
        const delta = count - prevCount;

        const dateId = todaySlash.replace(/\//g, '_');
        const mealRef = doc(db, 'daily_meals', `meal_${m.id}_${dateId}`);
        
        batch.set(mealRef, {
          memberId: m.id,
          date: todaySlash,
          count: count,
          month_id: config.current_month_id,
          updatedAt: new Date()
        }, { merge: true });

        if (delta !== 0) {
          batch.update(doc(db, 'users', m.id), {
            total_meals: increment(delta)
          });
        }
      }

      await batch.commit();
      window.alert("তথ্য সেভ হয়েছে, বস!");
    } catch (err) {
      console.error(err);
      window.alert("বস, তথ্য সেভ হয়নি!");
    } finally {
      setSaving(false);
    }
  };

  // Rest of handlers (Deposit, Bill, Member) omitted for brevity as per instructions but kept functional in the actual file.
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMember.name || !newMember.username || !newMember.password) { showToast('সবগুলো ঘর পূরণ করুন।', 'error'); return; }
    const isDuplicate = members.some(m => m.username === newMember.username || m.name === newMember.name);
    if (isDuplicate) { showToast('এই ইউজারনেম বা তথ্য দিয়ে সদস্য আগে থেকেই যুক্ত আছে!', 'error'); return; }
    setIsAdding(true);
    try {
      const dep = Number(newMember.deposit) || 0;
      const docRef = await addDoc(collection(db, 'users'), {
        name: newMember.name, username: newMember.username.toLowerCase(), password: newMember.password,
        role: 'member', status: 'active', total_deposit: dep, current_balance: dep, total_meals: 0,
        photoURL: '', bloodGroup: '', mobileNumber: ''
      });
      if (dep > 0 && config) { await addDoc(collection(db, 'deposits'), { month_id: config.current_month_id, user_id: docRef.id, user_name: newMember.name, amount: dep, date: new Date().toISOString() }); }
      setNewMember({ name:'', username:'', password:'', deposit:'' }); setShowAddForm(false);
      showToast('সদস্য সফলভাবে যুক্ত করা হয়েছে!', 'success');
    } catch (err) { showToast(`মেম্বার যুক্ত করতে সমস্যা হয়েছে: ${err.message}`, 'error'); } finally { setIsAdding(false); }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    try { await updateDoc(doc(db, 'users', id), { status: currentStatus === 'active' ? 'inactive' : 'active' }); showToast('স্ট্যাটাস আপডেট হয়েছে।', 'success'); } catch (err) { console.error(err); }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!selectedMember || !depositAmount || Number(depositAmount) <= 0) { showToast('সদস্য ও পরিমাণ দিন।', 'error'); return; }
    try {
      const amt = Number(depositAmount);
      const member = members.find(m => m.id === selectedMember);
      await updateDoc(doc(db, 'users', selectedMember), { total_deposit: increment(amt), current_balance: increment(amt) });
      if (config) { await addDoc(collection(db, 'deposits'), { month_id: config.current_month_id, user_id: selectedMember, user_name: member?.name||'', amount: amt, date: new Date().toISOString() }); }
      setDepositAmount(''); setSelectedMember('');
      showToast('ডিপোজিট সফল!', 'success');
    } catch (err) { console.error(err); showToast('ডিপোজিট ব্যর্থ।', 'error'); }
  };

  const handleAddBill = async (e) => {
    e.preventDefault();
    if (!billCategory || !billAmount || Number(billAmount) <= 0) { showToast('ক্যাটাগরি ও পরিমাণ দিন।', 'error'); return; }
    try {
      const amt = Number(billAmount);
      await addDoc(collection(db, 'fixed_costs'), { month_id: config?.current_month_id || '', category: billCategory, amount: amt, manager_name: localStorage.getItem('hexamess-user-name') || 'ম্যানেজার', date: serverTimestamp() });
      const perHead = amt / activeMembers.length;
      const batch = writeBatch(db);
      activeMembers.forEach(m => batch.update(doc(db, 'users', m.id), { current_balance: increment(-perHead) }));
      await batch.commit();
      setBillCategory(''); setBillAmount('');
      showToast(`বিল যুক্ত! জনপ্রতি ৳${perHead.toFixed(0)} কাটা হয়েছে।`, 'success');
    } catch (err) { showToast('বিল যুক্ত ব্যর্থ।', 'error'); }
  };

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ marginBottom:'0.5rem' }}>অ্যাডমিন ড্যাশবোর্ড</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="date" 
            className="form-control" 
            style={{ width: 'auto', background: '#111', border: '1px solid #333', color: '#fff' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? '✕ ফর্ম বন্ধ করুন' : '👤 নতুন মেম্বার যোগ করুন'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card glass-card" style={{ marginBottom:'1.5rem' }}>
          <h3 style={{ marginBottom:'1.25rem', color:'var(--accent-blue)' }}>নতুন মেম্বার রেজিস্ট্রেশন</h3>
          <form onSubmit={handleAddMember} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'1rem' }}>
            <div className="form-group"><label>নাম</label><input className="form-control" value={newMember.name} onChange={e=>setNewMember({...newMember, name:e.target.value})} required /></div>
            <div className="form-group"><label>ইউজারনেম</label><input className="form-control" value={newMember.username} onChange={e=>setNewMember({...newMember, username:e.target.value})} required /></div>
            <div className="form-group"><label>পাসওয়ার্ড</label><input className="form-control" type="password" value={newMember.password} onChange={e=>setNewMember({...newMember, password:e.target.value})} required /></div>
            <div className="form-group"><label>প্রাথমিক ডিপোজিট (৳)</label><input className="form-control" type="number" value={newMember.deposit} onChange={e=>setNewMember({...newMember, deposit:e.target.value})} /></div>
            <div style={{ gridColumn:'1/-1', textAlign:'right' }}><button className="btn btn-primary" type="submit" disabled={isAdding}>{isAdding ? 'যুক্ত হচ্ছে...' : 'যোগ করুন'}</button></div>
          </form>
        </div>
      )}

      {/* Top 3 Cards */}
      <div className="stats-grid" style={{ marginBottom:'1.5rem' }}>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-blue)' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>আজকের মোট মিল <span className="live-icon" /></p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-blue)' }}>{todayTotalMeals} টি</span>
        </div>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-orange)' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>এই মাসের চলতি মোট মিল</p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-orange)' }}>{monthTotalMeals} টি</span>
        </div>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-green)' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>লাইভ মিল রেট</p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-green)' }}>৳ {liveMealRate}</span>
        </div>
      </div>

      {/* Member Meal Input Section (Dashboard Integration) */}
      <div className="card glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: 'var(--accent-blue)' }}>🍽️ মেম্বার মিল ইনপুট ({todaySlash})</h3>
          <span style={{ fontSize: '0.8rem', color: '#888' }}>প্রি-পপুলেটেড ফ্রম ডেটাবেজ</span>
        </div>
        
        <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#000', color: '#888', fontSize: '0.9rem', textAlign: 'left' }}>
                <th style={{ padding: '1rem' }}>মেম্বার নাম</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>মিল সংখ্যা (০-৫)</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '700' }}>{m.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>@{m.username}</div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <select 
                      className="form-control"
                      style={{ width: '80px', margin: '0 auto', background: '#000', border: '1px solid #333', color: '#fff', fontWeight: '800' }}
                      value={todayMeals[m.id] ?? 0}
                      onChange={(e) => handleMealChange(m.id, e.target.value)}
                    >
                      {[0,1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary save-btn-interactive"
            onClick={handleSaveMeals}
            disabled={saving}
            style={{ 
              width: '280px', padding: '1.1rem', borderRadius: '12px', fontSize: '1rem', fontWeight: '800',
              transition: 'transform 0.15s ease'
            }}
          >
            {saving ? 'সেভ হচ্ছে...' : '💾 আজকের ডাটা সেভ করুন'}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:'1.5rem', marginBottom:'1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-blue)' }}>মেম্বার ডিপোজিট</h3>
          <form onSubmit={handleDeposit}>
            <div className="form-group"><label>মেম্বার নির্বাচন করুন</label><select className="form-control" value={selectedMember} onChange={e=>setSelectedMember(e.target.value)} required><option value="">নির্বাচন করুন</option>{activeMembers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div className="form-group"><label>ডিপোজিট এমাউন্ট (৳)</label><input type="number" className="form-control" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} min="1" required /></div>
            <button type="submit" className="btn btn-primary" style={{ width:'100%' }}>ডিপোজিট করুন</button>
          </form>
        </div>
        <div className="card">
          <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-orange)' }}>ফিক্সড বিল এন্ট্রি</h3>
          <form onSubmit={handleAddBill}>
            <div className="form-group"><label>বিলের ক্যাটাগরি</label><select className="form-control" value={billCategory} onChange={e=>setBillCategory(e.target.value)} required><option value="">নির্বাচন করুন</option>{EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>এমাউন্ট (৳)</label><input type="number" className="form-control" value={billAmount} onChange={e=>setBillAmount(e.target.value)} min="1" required /></div>
            <button type="submit" className="btn btn-primary" style={{ width:'100%' }}>বিল যুক্ত করুন</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-blue)' }}>মেম্বার সামারি</h3>
        <div className="table-container">
          <table>
            <thead><tr><th>নাম (ইউজারনেম)</th><th>ডিপোজিট</th><th>ব্যালেন্স</th><th>মোট মিল</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className={m.status === 'inactive' ? 'row-danger' : ''}>
                  <td><div style={{ fontWeight:'600' }}>{m.name}</div><div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>@{m.username}</div></td>
                  <td>৳{m.total_deposit||0}</td>
                  <td style={{ fontWeight:'700', color: (m.current_balance||0) < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{m.current_balance||0}</td>
                  <td>{m.total_meals||0} টি</td>
                  <td><span className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{m.status === 'active' ? 'এক্টিভ' : 'নিষ্ক্রিয়'}</span></td>
                  <td style={{ display:'flex', gap:'0.5rem' }}>
                    <button className="btn" style={{ padding:'0.25rem 0.5rem', fontSize:'0.75rem' }} onClick={()=>toggleUserStatus(m.id, m.status)}>{m.status === 'active' ? 'নিষ্ক্রিয় করুন' : 'এক্টিভ করুন'}</button>
                    <button className="btn" style={{ padding:'0.25rem 0.5rem', fontSize:'0.75rem', background:'var(--accent-blue)', color:'#000' }} onClick={()=>navigate(`/admin/members/${m.id}`)}>প্রোফাইল</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .save-btn-interactive:active { transform: scale(0.95); }
        .save-btn-interactive:hover:not(:disabled) { background: #1d4ed8; }
      `}} />
    </>
  );
};

export default AdminDashboard;
