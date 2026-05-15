import { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  db, collection, doc, onSnapshot, addDoc, updateDoc, writeBatch,
  increment, serverTimestamp, query, where, setDoc, getDoc, getDocs
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
  
  // Refresh Trigger
  const [refresh, setRefresh] = useState(0);
  const [fetching, setFetching] = useState(false);

  // Meal Summary States
  const [selectedDateIso, setSelectedDateIso] = useState(getTodayDateString());
  const [todaySavedMeals, setTodaySavedMeals] = useState(0);
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const [saving, setSaving] = useState(false);

  // Deposit and Bills States
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [billCategory, setBillCategory] = useState('');
  const [billAmount, setBillAmount] = useState('');

  // Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', username: '', password: '', deposit: '' });
  const [isAdding, setIsAdding] = useState(false);

  // Helper: DD/MM/YYYY format for Document ID
  const docIdKey = useMemo(() => {
    if (!selectedDateIso) return '';
    const [y, m, d] = selectedDateIso.split('-');
    return `${d}/${m}/${y}`;
  }, [selectedDateIso]);

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const u1 = onSnapshot(collection(db, 'users'), snap => { setMembers(snap.docs.map(d => ({ id:d.id, ...d.data() }))); });
    const u2 = onSnapshot(doc(db, 'config', 'settings'), snap => { if (snap.exists()) setConfig(snap.data()); });
    return () => { u1(); u2(); };
  }, []);

  // 2 & 3. Real-time Dashboard Aggregation
  useEffect(() => {
    if (!db || !docIdKey) return;
    
    setFetching(true);
    const [targetY, targetM] = selectedDateIso.split('-');
    const monthId = `${targetY}-${targetM}`;

    // A. Today's Total Listener
    const unsubToday = onSnapshot(
      query(collection(db, 'daily_meals'), where('date', '==', docIdKey)),
      (snap) => {
        try {
          const total = snap.docs.reduce((sum, d) => sum + Number(d.data().count || 0), 0);
          setTodaySavedMeals(total);
          setFetching(false);
        } catch (err) {
          console.error("Today Meals Summation Error:", err);
        }
      },
      (err) => { 
        console.error("Today Meals Listener Error:", err); 
        if (err.message.includes("requires an index")) {
          console.warn("Firestore Index Required: " + err.message);
        }
        setFetching(false); 
      }
    );

    // B. Monthly Summation Listener
    const unsubMonth = onSnapshot(
      query(collection(db, 'daily_meals'), where('month_id', '==', monthId)),
      (snap) => {
        try {
          const total = snap.docs.reduce((sum, d) => sum + Number(d.data().count || 0), 0);
          setMonthTotalMeals(total);
        } catch (err) {
          console.error("Month Meals Summation Error:", err);
        }
      },
      (err) => { 
        console.error("Month Meals Listener Error:", err); 
        if (err.message.includes("requires an index")) {
          console.warn("Firestore Index Required: " + err.message);
        }
      }
    );

    return () => {
      unsubToday();
      unsubMonth();
    };
  }, [docIdKey, selectedDateIso]);

  // Market Expense Sync
  useEffect(() => {
    if (!db || !config) return;
    const unsubExp = onSnapshot(query(
      collection(db, 'expenses'), 
      where('month_id', '==', config.current_month_id), 
      where('status', '==', 'approved')
    ), snap => {
      setApprovedExpenses(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    });
    return () => unsubExp();
  }, [config]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  const totalMarketCost = useMemo(() => approvedExpenses.reduce((s, e) => s + (Number(e.cost)||0), 0), [approvedExpenses]);
  const liveMealRate = useMemo(() => monthTotalMeals === 0 ? 0 : (totalMarketCost / monthTotalMeals).toFixed(2), [totalMarketCost, monthTotalMeals]);


  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMember.name || !newMember.username || !newMember.password) { showToast('সবগুলো ঘর পূরণ করুন।', 'error'); return; }
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
    try {
      await updateDoc(doc(db, 'users', id), {
        status: currentStatus === 'active' ? 'inactive' : 'active'
      });
      showToast('স্ট্যাটাস আপডেট হয়েছে।', 'success');
    } catch {
      showToast('স্ট্যাটাস আপডেটে সমস্যা হয়েছে।', 'error');
    }
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
    } catch { showToast('বিল যুক্ত ব্যর্থ।', 'error'); }
  };

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ marginBottom:'0.5rem' }}>অ্যাডমিন ড্যাশবোর্ড</h2>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? '✕ ফর্ম বন্ধ করুন' : '👤 নতুন মেম্বার যোগ করুন'}
        </button>
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

      {/* Top Cards */}
      <div className="stats-grid" style={{ marginBottom:'1.5rem' }}>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-blue)', opacity: fetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>আজকের মোট মিল <span className="live-icon" /></p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-blue)' }}>{fetching ? '...' : todaySavedMeals} টি</span>
        </div>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-orange)', opacity: fetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>এই মাসের চলতি মোট মিল</p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-orange)' }}>{fetching ? '...' : monthTotalMeals} টি</span>
        </div>
        <div className="card glass-card" style={{ borderLeft: '5px solid var(--accent-green)', opacity: fetching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>লাইভ মিল রেট</p>
          <span style={{ fontSize:'2.5rem', fontWeight:'900', color:'var(--accent-green)' }}>৳ {fetching ? '...' : liveMealRate}</span>
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
            <thead><tr><th>নাম (ইউজারনেম)</th><th>ডিপোজিট</th><th>ব্যব্যালেন্স</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className={m.status === 'inactive' ? 'row-danger' : ''}>
                  <td><div style={{ fontWeight:'600' }}>{m.name}</div><div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>@{m.username}</div></td>
                  <td>৳{m.total_deposit||0}</td>
                  <td style={{ fontWeight:'700', color: (m.current_balance||0) < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{m.current_balance||0}</td>
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
        .manual-save-btn:active { transform: scale(0.95); }
        .manual-save-btn:hover:not(:disabled) { background: #1d4ed8; }
        .live-icon { display: inline-block; width: 8px; height: 8px; background: #ff3b3b; border-radius: 50%; margin-left: 5px; animation: blink 1.5s infinite; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
      `}} />
    </>
  );
};

export default AdminDashboard;
