import { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, updateDoc } from '../utils/firebase';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';

const MemberList = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalBazarAmount, setTotalBazarAmount] = useState(0);
  const [visiblePasswords, setVisiblePasswords] = useState({});
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

  const togglePassword = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
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
                <th>ইউজারনেম</th>
                <th>পাসওয়ার্ড</th>
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
                  <td>@{member.username}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem' }}>
                        {visiblePasswords[member.id] ? member.password : '••••••••'}
                      </span>
                      <button className="icon-btn" onClick={() => togglePassword(member.id)} style={{ fontSize: '0.75rem' }}>
                        {visiblePasswords[member.id] ? '🔒' : '👁️'}
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-blue" style={{ fontWeight: '800' }}>
                      {Number(member.total_meals) || 0} টি
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                    ৳{Number(member.total_deposit) || 0}
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
    </div>
  );
};

export default MemberList;
