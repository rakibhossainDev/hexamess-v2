import { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, updateDoc } from '../utils/firebase';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';

const MemberList = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalBazarAmount, setTotalBazarAmount] = useState(0);
  const [editingMealUser, setEditingMealUser] = useState(null);
  const [newTotalMeals, setNewTotalMeals] = useState(0);
  const [editingDepositUser, setEditingDepositUser] = useState(null);
  const [newTotalDeposit, setNewTotalDeposit] = useState(0);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    
    // 1. Members Listener
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // 2. Bazar Records Listener for Live Meal Rate
    const unsubBazar = onSnapshot(collection(db, 'bazar_records'), (snap) => {
      const sum = snap.docs.reduce((acc, docSnap) => acc + Number(docSnap.data().amount || 0), 0);
      setTotalBazarAmount(sum);
    });

    return () => { unsubscribe(); unsubBazar(); };
  }, []);

  const handleUpdateTotalDeposit = async () => {
    if (!editingDepositUser) return;
    try {
      const userRef = doc(db, 'users', editingDepositUser.id);
      await updateDoc(userRef, { total_deposit: Number(newTotalDeposit) });
      showToast("মোট জমা সফলভাবে আপডেট হয়েছে।", "success");
      setEditingDepositUser(null);
    } catch (err) {
      console.error(err);
      showToast("আপডেট ব্যর্থ হয়েছে।", "error");
    }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    try {
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, { status: currentStatus === 'active' ? 'inactive' : 'active' });
      showToast("ইউজার স্ট্যাটাস আপডেট হয়েছে।", "success");
    } catch (err) {
      console.error(err);
      showToast("আপডেট ব্যর্থ হয়েছে।", "error");
    }
  };

  const handleUpdateTotalMeals = async () => {
    if (!editingMealUser) return;
    try {
      const userRef = doc(db, 'users', editingMealUser.id);
      await updateDoc(userRef, { total_meals: Number(newTotalMeals) });
      showToast("মোট মিল সফলভাবে আপডেট হয়েছে।", "success");
      setEditingMealUser(null);
    } catch (err) {
      console.error(err);
      showToast("আপডেট ব্যর্থ হয়েছে।", "error");
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '50vh' }}><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>মেম্বার তালিকা</h2>
        <span className="badge badge-blue">মোট মেম্বার: {members.length} জন</span>
      </div>

      <div className="card glass-card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>মেম্বার প্রোফাইল</th>
                <th style={{ textAlign: 'center' }}>মোট মিল</th>
                <th style={{ textAlign: 'center' }}>মোট জমা</th>
                <th style={{ textAlign: 'center' }}>ফিক্সড খরচ</th>
                <th style={{ textAlign: 'center' }}>সর্বমোট খরচ</th>
                <th style={{ textAlign: 'center' }}>হিসেব (পাবে/দিবে)</th>
                <th>স্ট্যাটাস</th>
                <th style={{ textAlign: 'right' }}>অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className={member.status === 'inactive' ? 'row-danger' : ''}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="relative w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0">
                        <div className="absolute inset-0 w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300 flex items-center justify-center font-bold">
                          {member.name.charAt(0)}
                        </div>
                        {member.photoURL && (
                          <img 
                            src={member.photoURL} 
                            alt={member.name} 
                            className="absolute inset-0 w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0 rounded-full object-cover border border-cyan-500 z-10 bg-[var(--surface-color)]" 
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                      </div>
                      <div style={{ fontWeight: '600' }}>{member.name}</div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-blue" style={{ fontWeight: '800' }}>
                        {Number(member.total_meals) || 0} টি
                      </span>
                      <button 
                        className="text-blue-500 hover:text-blue-600 transition-colors" 
                        title="এডিট মিল"
                        onClick={() => {
                          setEditingMealUser(member);
                          setNewTotalMeals(Number(member.total_meals) || 0);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span>৳{Number(member.total_deposit) || 0}</span>
                      <button 
                        className="text-green-500 hover:text-green-600 transition-colors" 
                        title="এডিট জমা"
                        onClick={() => {
                          setEditingDepositUser(member);
                          setNewTotalDeposit(Number(member.total_deposit) || 0);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-orange)' }}>
                    ৳{Number(member.total_fixed_cost) || 0}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-red)' }}>
                    ৳{(((Number(member.total_meals) || 0) * (members.reduce((s, m) => s + (Number(m.total_meals) || 0), 0) > 0 ? (totalBazarAmount / members.reduce((s, m) => s + (Number(m.total_meals) || 0), 0)) : 0)) + (Number(member.total_fixed_cost) || 0)).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {(() => {
                      const totalMeals = members.reduce((s, m) => s + (Number(m.total_meals) || 0), 0);
                      const liveMealRate = totalMeals > 0 ? totalBazarAmount / totalMeals : 0;
                      const finalTotalCost = ((Number(member.total_meals) || 0) * liveMealRate) + (Number(member.total_fixed_cost) || 0);
                      const finalBalance = (Number(member.total_deposit) || 0) - finalTotalCost;
                      const isRefund = finalBalance >= 0;
                      return (
                        <span className={isRefund ? 'text-green-500' : 'text-red-500'}>
                          {isRefund ? `+৳${finalBalance.toFixed(2)}` : `-৳${Math.abs(finalBalance).toFixed(2)}`}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <span className={`badge ${member.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                      {member.status === 'active' ? 'এক্টিভ' : 'নিষ্ক্রিয়'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn" 
                      onClick={() => toggleUserStatus(member.id, member.status)}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                    >
                      {member.status === 'active' ? 'নিষ্ক্রিয় করুন' : 'এক্টিভ করুন'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingMealUser && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="card glass-card w-full max-w-sm fade-in">
            <h3 className="text-lg font-bold text-[var(--accent-blue)] mb-2">ম্যানুয়াল মিল আপডেট</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              মেম্বার: <span className="font-semibold text-[var(--text-primary)]">{editingMealUser.name}</span>
            </p>
            <div className="form-group mb-6">
              <label className="text-sm font-medium mb-2 block text-left">সর্বমোট মিল (চলমান):</label>
              <input
                type="number"
                className="form-control"
                value={newTotalMeals}
                onChange={(e) => setNewTotalMeals(e.target.value)}
                min="0"
                step="0.5"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={() => setEditingMealUser(null)}>বাতিল</button>
              <button className="btn btn-primary flex-1" onClick={handleUpdateTotalMeals}>সেভ করুন</button>
            </div>
          </div>
        </div>
      )}

      {editingDepositUser && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="card glass-card w-full max-w-sm fade-in">
            <h3 className="text-lg font-bold text-[var(--accent-green)] mb-2">ম্যানুয়াল জমা আপডেট</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              মেম্বার: <span className="font-semibold text-[var(--text-primary)]">{editingDepositUser.name}</span>
            </p>
            <div className="form-group mb-6">
              <label className="text-sm font-medium mb-2 block text-left">সর্বমোট জমা (চলমান):</label>
              <input
                type="number"
                className="form-control"
                value={newTotalDeposit}
                onChange={(e) => setNewTotalDeposit(e.target.value)}
                min="0"
                step="1"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={() => setEditingDepositUser(null)}>বাতিল</button>
              <button className="btn btn-primary flex-1" onClick={handleUpdateTotalDeposit}>সেভ করুন</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberList;
