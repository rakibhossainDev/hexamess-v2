import { useState, useEffect } from 'react';
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from '../utils/firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';

const MarketExpense = () => {
  const [members, setMembers] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [fixedCategory, setFixedCategory] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedDate, setFixedDate] = useState(getTodayDateString());
  const [selectedMember, setSelectedMember] = useState('');
  const [savingFixed, setSavingFixed] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    
    // Listen to members
    const unsubMembers = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to fixed expenses
    const unsubFixed = onSnapshot(collection(db, 'fixed_expenses'), snap => {
      setFixedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => { unsubMembers(); unsubFixed(); };
  }, []);

  const handleIssueFixedExpense = async (e) => {
    e.preventDefault();
    if (savingFixed) return;

    const amt = Number(fixedAmount);
    if (!fixedCategory || !fixedAmount || amt <= 0 || !selectedMember) {
      showToast('সবগুলো ঘর সঠিকভাবে পূরণ করুন।', 'error');
      return;
    }

    setSavingFixed(true);
    try {
      if (selectedMember === 'all') {
        // Divide equally among all users
        const dividedAmt = amt / members.length;
        for (const m of members) {
          await addDoc(collection(db, 'fixed_expenses'), {
            memberId: m.id,
            memberName: m.name,
            category: fixedCategory,
            amount: dividedAmt,
            date: fixedDate,
            timestamp: serverTimestamp()
          });
        }
        showToast('সকল মেম্বারদের জন্য ফিক্সড খরচ বিভক্ত করে যোগ করা হয়েছে!', 'success');
      } else {
        const member = members.find(m => m.id === selectedMember);
        await addDoc(collection(db, 'fixed_expenses'), {
          memberId: selectedMember,
          memberName: member ? member.name : '',
          category: fixedCategory,
          amount: amt,
          date: fixedDate,
          timestamp: serverTimestamp()
        });
        showToast('মেম্বারের ফিক্সড খরচ সফলভাবে যোগ করা হয়েছে!', 'success');
      }

      setFixedCategory('');
      setFixedAmount('');
      setSelectedMember('');
    } catch (err) {
      console.error('Fixed Expense Save Error:', err);
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

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>ফিক্সড খরচ ম্যানেজার</h2>
      </div>

      {/* Fixed Expenses Form */}
      <div className="card glass-card">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-green)' }}>🏠 ফিক্সড খরচ ইস্যু করুন</h3>
        <form onSubmit={handleIssueFixedExpense} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group">
            <label>ক্যাটেগরি</label>
            <select 
              className="form-control" 
              value={fixedCategory} 
              onChange={e => setFixedCategory(e.target.value)} 
              required
            >
              <option value="">নির্বাচন করুন</option>
              <option value="বাসা ভাড়া">বাসা ভাড়া</option>
              <option value="বিদ্যুৎ বিল">বিদ্যুৎ বিল</option>
              <option value="ওয়াইফাই বিল">ওয়াইফাই বিল</option>
              <option value="গ্যাস বিল">গ্যাস বিল</option>
              <option value="আসবাবপত্র">আসবাবপত্র</option>
              <option value="অন্যান্য">অন্যান্য</option>
            </select>
          </div>
          <div className="form-group">
            <label>পরিমাণ (৳)</label>
            <input 
              type="number" 
              className="form-control" 
              value={fixedAmount} 
              onChange={e => setFixedAmount(e.target.value)} 
              placeholder="৳০০.০০" 
              required 
            />
          </div>
          <div className="form-group">
            <label>তারিখ</label>
            <input 
              type="date" 
              className="form-control" 
              value={fixedDate} 
              onChange={e => setFixedDate(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>মেম্বার নির্বাচন</label>
            <select 
              className="form-control" 
              value={selectedMember} 
              onChange={e => setSelectedMember(e.target.value)} 
              required
            >
              <option value="">নির্বাচন করুন</option>
              <option value="all">All Members (সমান ভাগে বিভক্ত)</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', gridColumn: 'span 1' }}>
            <button 
              type="submit" 
              className="btn btn-success" 
              disabled={savingFixed}
              style={{ flex: 1, height: 'fit-content', padding: '0.875rem 1rem' }}
            >
              {savingFixed ? 'সেভ হচ্ছে...' : 'ফিক্সড খরচ যোগ করুন'}
            </button>
          </div>
        </form>
      </div>

      {/* Fixed Expenses List */}
      <div className="card glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--accent-green)', margin: 0 }}>ফিক্সড খরচ তালিকা</h3>
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
                <div className="text-sm text-[var(--text-secondary)] mb-4">মেম্বার: {fe.memberName}</div>
                <div className="flex gap-3 justify-end border-t border-[var(--border-color)] pt-3">
                  <button className="flex items-center gap-1 text-sm bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg" onClick={() => handleDeleteFixed(fe.id)}>
                    🗑️ ডিলিট
                  </button>
                </div>
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
                <th>মেম্বার</th>
                <th style={{ textAlign: 'right' }}>পরিমাণ</th>
                <th style={{ textAlign: 'right' }}>অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {fixedExpenses.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>কোন রেকর্ড পাওয়া যায়নি।</td></tr>
              ) : (
                fixedExpenses.map(fe => (
                  <tr key={fe.id}>
                    <td>{formatDisplayDate(fe.date)}</td>
                    <td style={{ fontWeight: '500' }}>{fe.category}</td>
                    <td>{fe.memberName}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-green)' }}>৳{Number(fe.amount).toFixed(0)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="icon-btn" onClick={() => handleDeleteFixed(fe.id)} title="Delete" style={{ color: 'var(--accent-red)' }}>🗑️</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MarketExpense;
