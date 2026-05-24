import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, where } from '../utils/firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

const FixedExpenses = () => {
  const currentUser = JSON.parse(localStorage.getItem('hexa_user') || '{}');
  const isManagerUser = currentUser?.username === 'manager';
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  const [members, setMembers] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [expenseRows, setExpenseRows] = useState([{ category: '', amount: '' }]);
  const [fixedDate, setFixedDate] = useState(getTodayDateString());
  const [selectedMember, setSelectedMember] = useState('');
  const [savingFixed, setSavingFixed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    setLoading(true);

    // Listen to members
    const unsubMembers = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to fixed expenses (conditional query for member vs manager)
    let qFixed = collection(db, 'fixed_expenses');
    if (!isManagerUser && currentUser.id) {
      qFixed = query(collection(db, 'fixed_expenses'), where('memberId', '==', currentUser.id));
    }

    const unsubFixed = onSnapshot(qFixed, snap => {
      const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      setFixedExpenses(sorted);
      setLoading(false);
    }, err => {
      console.error("Firestore Listen Error:", err);
      setLoading(false);
    });

    return () => { unsubMembers(); unsubFixed(); };
  }, [isManagerUser, currentUser.id]);

  const handleAddRow = () => {
    setExpenseRows([...expenseRows, { category: '', amount: '' }]);
  };

  const handleRemoveRow = (index) => {
    if (expenseRows.length === 1) return;
    setExpenseRows(expenseRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...expenseRows];
    updated[index][field] = value;
    setExpenseRows(updated);
  };

  const handleIssueFixedExpense = async (e) => {
    e.preventDefault();
    if (savingFixed) return;

    // Validate all rows
    for (let i = 0; i < expenseRows.length; i++) {
      const row = expenseRows[i];
      const amt = Number(row.amount);
      if (!row.category || !row.amount || amt <= 0) {
        showToast(`অনুগ্রহ করে ${i + 1} নং লাইনের ক্যাটেগরি ও সঠিক পরিমাণ দিন।`, 'error');
        return;
      }
    }
    if (!selectedMember || !fixedDate) {
      showToast('মেম্বার এবং তারিখ নির্বাচন করুন।', 'error');
      return;
    }

    setSavingFixed(true);
    try {
      const { writeBatch, collection, doc } = await import('../utils/firebase');
      const batch = writeBatch(db);

      for (const row of expenseRows) {
        const amt = Number(row.amount);
        if (selectedMember === 'all') {
          const dividedAmt = amt / members.length;
          for (const m of members) {
            const newDocRef = doc(collection(db, 'fixed_expenses'));
            batch.set(newDocRef, {
              memberId: m.id,
              memberName: m.name,
              category: row.category,
              amount: dividedAmt,
              date: fixedDate,
              timestamp: serverTimestamp()
            });
          }
        } else {
          const member = members.find(m => m.id === selectedMember);
          const newDocRef = doc(collection(db, 'fixed_expenses'));
          batch.set(newDocRef, {
            memberId: selectedMember,
            memberName: member ? member.name : '',
            category: row.category,
            amount: amt,
            date: fixedDate,
            timestamp: serverTimestamp()
          });
        }
      }

      await batch.commit();
      showToast('সবগুলো ফিক্সড খরচ সফলভাবে ব্যাচ-আপডেট করা হয়েছে!', 'success');
      setExpenseRows([{ category: '', amount: '' }]);
      setSelectedMember('');
    } catch (err) {
      console.error('Batch Fixed Expense Save Error:', err);
      showToast('সেভ করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setSavingFixed(false);
    }
  };

  const handleDeleteFixed = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে এই ফিক্সড খরচটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'fixed_expenses', id));
      showToast('ফিক্সড খরচ ডিলিট করা হয়েছে।', 'success');
    } catch (err) {
      console.error('Delete Fixed Error:', err);
      showToast('ডিলিট করা যায়নি।', 'error');
    }
  };

  const renderContent = () => (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--accent-green)' }}>
          {isManagerUser ? 'ফিক্সড খরচ ম্যানেজার' : 'আমার ফিক্সড খরচ সমূহ'}
        </h2>
      </div>

      {/* Fixed Expenses Form (Manager Only) */}
      {isManagerUser && (
        <div className="card glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: 'var(--accent-green)' }}>🏠 ফিক্সড খরচ ইস্যু করুন</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>তারিখ</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={fixedDate} 
                  onChange={e => setFixedDate(e.target.value)} 
                  style={{ width: '160px', minHeight: '36px', padding: '0.25rem 0.5rem' }}
                  required 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>মেম্বার নির্বাচন</label>
                <select 
                  className="form-control" 
                  value={selectedMember} 
                  onChange={e => setSelectedMember(e.target.value)} 
                  style={{ width: '180px', minHeight: '36px', padding: '0.25rem 0.5rem' }}
                  required
                >
                  <option value="">নির্বাচন করুন</option>
                  <option value="all">All Members (সমান ভাগে বিভক্ত)</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <form onSubmit={handleIssueFixedExpense}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {expenseRows.map((row, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '1rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    {index === 0 && <label style={{ fontSize: '0.85rem' }}>ক্যাটেগরি</label>}
                    <select 
                      className="form-control" 
                      value={row.category} 
                      onChange={e => handleRowChange(index, 'category', e.target.value)} 
                      required
                    >
                      <option value="">নির্বাচন করুন</option>
                      <option value="বাসা ভাড়া">বাসা ভাড়া</option>
                      <option value="বিদ্যুৎ বিল">বিদ্যুৎ বিল</option>
                      <option value="ওয়াইফাই বিল">ওয়াইফাই বিল</option>
                      <option value="গ্যাস বিল">গ্যাস বিল</option>
                      <option value="আসবাবপত্র খরচ">আসবাবপত্র খরচ</option>
                      <option value="অন্যান্য">অন্যান্য</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    {index === 0 && <label style={{ fontSize: '0.85rem' }}>পরিমাণ (৳)</label>}
                    <input 
                      type="number" 
                      className="form-control" 
                      value={row.amount} 
                      onChange={e => handleRowChange(index, 'amount', e.target.value)} 
                      placeholder="৳০০.০০" 
                      required 
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleAddRow}
                    style={{ height: '42px', width: '42px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}
                    title="নতুন রো যোগ করুন"
                  >
                    +
                  </button>
                  {expenseRows.length > 1 && (
                    <button 
                      type="button" 
                      className="btn btn-danger" 
                      onClick={() => handleRemoveRow(index)}
                      style={{ height: '42px', width: '42px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}
                      title="রো ডিলিট করুন"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="submit" 
                className="btn btn-success" 
                disabled={savingFixed}
                style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
              >
                {savingFixed ? 'সেভ হচ্ছে...' : 'ফিক্সড খরচ যোগ করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fixed Expenses List */}
      <div className="card glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--accent-green)', margin: 0 }}>
            {isManagerUser ? 'ফিক্সড খরচ তালিকা' : 'আমার বরাদ্দের বিবরণ'}
          </h3>
        </div>
        
        {/* Mobile View (Cards) */}
        <div className="block md:hidden space-y-4">
          {fixedExpenses.length === 0 ? (
            <div className="text-center p-6 text-gray-500">কোন রেকর্ড পাওয়া যায়নি।</div>
          ) : (
            fixedExpenses.map(fe => (
              <div key={fe.id} className="bg-[var(--surface-color)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">{formatDisplayDate(fe.date)}</span>
                  <span className="font-bold text-[var(--accent-green)] text-lg">৳{Number(fe.amount).toFixed(0)}</span>
                </div>
                <div className="font-medium text-[var(--text-primary)] mb-1">{fe.category}</div>
                {isManagerUser && <div className="text-sm text-[var(--text-secondary)] mb-4">মেম্বার: {fe.memberName}</div>}
                {isManagerUser && (
                  <div className="flex gap-3 justify-end border-t border-[var(--border-color)] pt-3">
                    <button className="flex items-center gap-1 text-sm bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg" onClick={() => handleDeleteFixed(fe.id)}>
                      🗑️ ডিলিট
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block table-container">
          <table>
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>ক্যাটেগরি</th>
                {isManagerUser && <th>মেম্বার</th>}
                <th style={{ textAlign: 'right' }}>পরিমাণ</th>
                {isManagerUser && <th style={{ textAlign: 'right' }}>অ্যাকশন</th>}
              </tr>
            </thead>
            <tbody>
              {fixedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={isManagerUser ? 5 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    কোন রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                fixedExpenses.map(fe => (
                  <tr key={fe.id}>
                    <td>{formatDisplayDate(fe.date)}</td>
                    <td style={{ fontWeight: '500' }}>{fe.category}</td>
                    {isManagerUser && <td>{fe.memberName}</td>}
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-green)' }}>৳{Number(fe.amount).toFixed(0)}</td>
                    {isManagerUser && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="icon-btn" onClick={() => handleDeleteFixed(fe.id)} title="Delete" style={{ color: 'var(--accent-red)' }}>🗑️</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '50vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>লোড হচ্ছে...</p>
      </div>
    );
  }

  if (isAdminPath) {
    return renderContent();
  }

  return (
    <div className="app-layout" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={isManagerUser} />
      <main className="main-content" style={{ padding: '0 0 80px 0', flex: 1 }}>
        <Navbar userName={currentUser?.name} userRole={isManagerUser ? 'ম্যানেজার' : 'সদস্য'} photoURL={currentUser?.photoURL} />
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {renderContent()}
        </div>
      </main>
      <BottomNav isManager={isManagerUser} />
    </div>
  );
};

export default FixedExpenses;
