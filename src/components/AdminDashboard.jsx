import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  db, collection, doc, onSnapshot, addDoc, updateDoc, writeBatch,
  increment, serverTimestamp, query, where,
} from '../firebase';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { EXPENSE_CATEGORIES } from '../utils/monthUtils';

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
    <div className="app-layout">
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
  const [fixedBills, setFixedBills] = useState([]);
  const [approvedExpenses, setApprovedExpenses] = useState([]);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [config, setConfig] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [billCategory, setBillCategory] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({ name:'', username:'', password:'', deposit:'' });
  const [isAdding, setIsAdding] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const u1 = onSnapshot(collection(db, 'users'), snap => { setMembers(snap.docs.map(d => ({ id:d.id, ...d.data() }))); });
    const u2 = onSnapshot(doc(db, 'config', 'settings'), snap => { if (snap.exists()) setConfig(snap.data()); });
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    const u1 = onSnapshot(query(collection(db, 'fixed_costs'), where('month_id', '==', mid)), snap => setFixedBills(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, 'expenses'), where('month_id', '==', mid), where('status', '==', 'approved')), snap => setApprovedExpenses(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    const u3 = onSnapshot(query(collection(db, 'expenses'), where('month_id', '==', mid), where('status', '==', 'pending')), snap => setPendingExpenses(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); };
  }, [config]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  const totalApprovedMarket = useMemo(() => approvedExpenses.reduce((s, e) => s + (Number(e.cost)||0), 0), [approvedExpenses]);
  const totalFixedBills = useMemo(() => fixedBills.reduce((s, b) => s + (Number(b.amount)||0), 0), [fixedBills]);
  const totalMeals = useMemo(() => members.reduce((s, m) => s + (Number(m.total_meals)||0), 0), [members]);
  const totalDeposits = useMemo(() => members.reduce((s, m) => s + (Number(m.total_deposit)||0), 0), [members]);

  const liveMealRate = useMemo(() => totalMeals === 0 ? 0 : (totalApprovedMarket / totalMeals).toFixed(2), [totalApprovedMarket, totalMeals]);
  const managerFund = useMemo(() => totalDeposits - totalApprovedMarket, [totalDeposits, totalApprovedMarket]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMember.name || !newMember.username || !newMember.password) {
      showToast('সবগুলো ঘর পূরণ করুন।', 'error'); return;
    }

    // Duplicate Prevention
    const isDuplicate = members.some(m => 
      m.username === newMember.username || 
      m.name === newMember.name || 
      m.password === newMember.password
    );

    if (isDuplicate) {
      showToast('এই ইউজারনেম বা তথ্য দিয়ে সদস্য আগে থেকেই যুক্ত আছে!', 'error');
      return;
    }

    setIsAdding(true);
    try {
      const dep = Number(newMember.deposit) || 0;
      const lowerUsername = newMember.username.toLowerCase();
      
      const docRef = await addDoc(collection(db, 'users'), {
        name: newMember.name, 
        username: lowerUsername, 
        password: newMember.password,
        role: 'member', 
        status: 'active', 
        total_deposit: dep, 
        current_balance: dep, 
        total_meals: 0,
        photoURL: '',
        bloodGroup: '',
        mobileNumber: ''
      });
      
      if (dep > 0 && config) {
        await addDoc(collection(db, 'deposits'), { 
          month_id: config.current_month_id, 
          user_id: docRef.id, 
          user_name: newMember.name, 
          amount: dep, 
          date: new Date().toISOString() 
        });
      }
      
      setNewMember({ name:'', username:'', password:'', deposit:'' }); 
      setShowAddForm(false);
      showToast('সদস্য সফলভাবে যুক্ত করা হয়েছে!', 'success');
    } catch (err) { 
      console.error("Firebase Add Member Error:", err); 
      showToast(`মেম্বার যুক্ত করতে সমস্যা হয়েছে: ${err.message || 'Unknown Error'}`, 'error'); 
    } finally {
      setIsAdding(false);
    }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'users', id), { status: currentStatus === 'active' ? 'inactive' : 'active' });
      showToast('স্ট্যাটাস আপডেট হয়েছে।', 'success');
    } catch (err) { console.error(err); }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!selectedMember || !depositAmount || Number(depositAmount) <= 0) { showToast('সদস্য ও পরিমাণ দিন।', 'error'); return; }
    try {
      const amt = Number(depositAmount);
      const member = members.find(m => m.id === selectedMember);
      await updateDoc(doc(db, 'users', selectedMember), { total_deposit: increment(amt), current_balance: increment(amt) });
      if (config) {
        await addDoc(collection(db, 'deposits'), { month_id: config.current_month_id, user_id: selectedMember, user_name: member?.name||'', amount: amt, date: new Date().toISOString() });
      }
      setDepositAmount(''); setSelectedMember('');
      showToast('ডিপোজিট সফল!', 'success');
    } catch (err) { console.error(err); showToast('ডিপোজিট ব্যর্থ।', 'error'); }
  };

  const handleAddBill = async (e) => {
    e.preventDefault();
    if (!billCategory || !billAmount || Number(billAmount) <= 0) { showToast('ক্যাটাগরি ও পরিমাণ দিন।', 'error'); return; }
    if (activeMembers.length === 0) { showToast('কোনো একটিভ মেম্বার নেই!', 'error'); return; }
    try {
      const amt = Number(billAmount);
      const managerName = localStorage.getItem('hexamess-user-name') || 'অজানা';
      await addDoc(collection(db, 'fixed_costs'), { 
        month_id: config?.current_month_id || '', 
        category: billCategory, 
        amount: amt, 
        manager_name: managerName,
        date: serverTimestamp() 
      });
      const perHead = amt / activeMembers.length;
      const batch = writeBatch(db);
      activeMembers.forEach(m => batch.update(doc(db, 'users', m.id), { current_balance: increment(-perHead) }));
      await batch.commit();
      setBillCategory(''); setBillAmount('');
      showToast(`বিল যুক্ত! (৳${amt}/${activeMembers.length}) জনপ্রতি ৳${perHead.toFixed(0)} কাটা হয়েছে।`, 'success');
    } catch (err) { console.error(err); showToast('বিল যুক্ত ব্যর্থ।', 'error'); }
  };
  const handleApprove = async (id) => {
    try {
      await updateDoc(doc(db, 'expenses', id), { status: 'approved' });
      showToast('খরচ অনুমোদিত হয়েছে!', 'success');
    } catch (err) {
      console.error(err);
      showToast('অনুমোদনে সমস্যা হয়েছে।', 'error');
    }
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
            <div style={{ gridColumn:'1/-1', textAlign:'right' }}>
              <button className="btn btn-primary" type="submit" disabled={isAdding}>
                {isAdding ? 'যুক্ত হচ্ছে...' : 'যোগ করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom:'0.5rem' }}>
        <div className="card glass-card">
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>লাইভ মিল রেট <span className="live-icon" /></p>
          <span style={{ fontSize:'2rem', fontWeight:'700', color:'var(--accent-orange)' }}>৳{liveMealRate}</span>
        </div>
        <div className="card">
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>ম্যানেজার ফান্ড</p>
          <span style={{ fontSize:'2rem', fontWeight:'700' }}>৳{managerFund.toLocaleString()}</span>
        </div>
        <div className="card">
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>মোট ফিক্সড খরচ</p>
          <span style={{ fontSize:'2rem', fontWeight:'700', color:'var(--accent-red)' }}>৳{totalFixedBills.toLocaleString()}</span>
        </div>
        <div className="card">
          <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>মেম্বার সংখ্যা</p>
          <span style={{ fontSize:'2rem', fontWeight:'700', color:'var(--accent-blue)' }}>{activeMembers.length}/{members.length}</span>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:'1.5rem', marginBottom:'0.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-orange)' }}>⚖️ পেন্ডিং বাজার অনুমোদন</h3>
          {pendingExpenses.length === 0 ? (
            <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'1rem' }}>কোনো পেন্ডিং খরচ নেই।</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem', maxHeight: '400px', overflowY: 'auto' }}>
              {pendingExpenses.map(exp => (
                <div key={exp.id} className="glass-card" style={{ padding:'1rem', border:'1px solid var(--border-color)', borderRadius:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                    <span style={{ fontWeight:'700' }}>{exp.shopper_name}</span>
                    <span style={{ color:'var(--accent-orange)', fontWeight:'800' }}>৳{exp.cost}</span>
                  </div>
                  <p style={{ fontSize:'0.875rem', fontWeight:'600', color:'var(--accent-blue)', marginBottom:'0.25rem' }}>
                    {exp.itemName ? `${exp.itemName} (${exp.quantity || 'N/A'})` : exp.details}
                  </p>
                  <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', marginBottom:'1rem' }}>{exp.details && exp.itemName ? exp.details : ''}</p>
                  <button 
                    className="btn btn-primary" style={{ width:'100%', fontSize:'0.8125rem' }}
                    onClick={() => handleApprove(exp.id)}
                  >
                    অনুমোদন করুন
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
            <thead><tr><th>নাম (ইউজারনেম)</th><th>ডিপোজিট</th><th>ব্যালেন্স</th><th>মিল</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className={m.status === 'inactive' ? 'row-danger' : ''}>
                  <td><div style={{ fontWeight:'600' }}>{m.name}</div><div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>@{m.username}</div></td>
                  <td>৳{m.total_deposit||0}</td>
                  <td style={{ fontWeight:'700', color: (m.current_balance||0) < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{m.current_balance||0}</td>
                  <td>{m.total_meals||0}</td>
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
      <div className="card" style={{ marginTop:'1.5rem' }}>
        <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-orange)' }}>📊 ফিক্সড বিল হিস্টরি</h3>
        {fixedBills.length === 0 ? <p style={{ color:'var(--text-secondary)' }}>কোনো ফিক্সড বিল পাওয়া যায়নি।</p> : (
          <div className="table-container">
            <table>
              <thead><tr><th>ক্যাটাগরি</th><th>পরিমাণ</th><th>সংযোজনকারী</th></tr></thead>
              <tbody>
                {fixedBills.map(b => (
                  <tr key={b.id}>
                    <td><span className="badge badge-success">{b.category}</span></td>
                    <td style={{ fontWeight:'700' }}>৳{b.amount}</td>
                    <td style={{ fontSize:'0.875rem' }}>{b.manager_name || 'ম্যানেজার'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminDashboard;
