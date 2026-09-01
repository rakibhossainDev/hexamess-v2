import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from '../utils/firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getTodayDateString, formatDisplayDate, getCurrentMonthId, getMonthLabel } from '../utils/monthUtils';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

const DepositManager = () => {
  const currentUser = JSON.parse(localStorage.getItem('hexa_user') || '{}');
  const isManager = currentUser?.username === 'manager';
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const [members, setMembers] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState(getTodayDateString());
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  const depositSummary = deposits.reduce((acc, curr) => {
    if (!acc[curr.memberId]) {
      acc[curr.memberId] = { name: curr.memberName, total: 0 };
    }
    acc[curr.memberId].total += Number(curr.amount) || 0;
    return acc;
  }, {});

  useEffect(() => {
    if (!db) return;

    // Listen to all members
    const unsubMembers = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to deposits in real-time
    const unsubDeposits = onSnapshot(collection(db, 'deposits'), snap => {
      setDeposits(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => { unsubMembers(); unsubDeposits(); };
  }, []);

  const handleAddDeposit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const amt = Number(depositAmount);
    if (!selectedMember || !depositAmount || amt <= 0 || !depositDate) {
      showToast('সবগুলো ঘর সঠিকভাবে পূরণ করুন।', 'error');
      return;
    }

    setSaving(true);
    try {
      const member = members.find(m => m.id === selectedMember);
      await addDoc(collection(db, 'deposits'), {
        memberId: selectedMember,
        memberName: member ? member.name : '',
        amount: amt,
        date: depositDate,
        timestamp: serverTimestamp()
      });

      showToast('টাকা জমা সফলভাবে এন্ট্রি করা হয়েছে!', 'success');
      setSelectedMember('');
      setDepositAmount('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Deposit Save Error:', err);
      showToast('সেভ করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeposit = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে এই জমার রেকর্ডটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'deposits', id));
      showToast('জমার রেকর্ড ডিলিট করা হয়েছে।', 'success');
    } catch (err) {
      console.error('Delete Deposit Error:', err);
      showToast('ডিলিট করা যায়নি।', 'error');
    }
  };

  const renderContent = () => (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Page Title & Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--accent-green)' }}>
          {isManager ? '💸 ডিপোজিট ম্যানেজার' : '💸 টাকা জমার তালিকা'}
        </h2>
        {isManager && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn btn-success"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', borderRadius: '0.5rem' }}
          >
            + নতুন টাকা জমা দিন
          </button>
        )}
      </div>

      {/* Total Active Session Summary */}
      <div className="card glass-card">
        <h3 style={{ color: 'var(--accent-green)', marginBottom: '1.25rem' }}>মোট জমা</h3>
        {Object.keys(depositSummary).length === 0 ? (
          <div className="text-center p-4 text-gray-500 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)]">
            চলমান সেশনে এখনও কোন জমা নেই।
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.values(depositSummary).map((summary, idx) => (
              <div key={idx} className="bg-[var(--surface-color)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm flex flex-col justify-center items-center text-center">
                <span className="text-[var(--text-secondary)] text-sm mb-1">{summary.name}</span>
                <span className="text-xl font-bold text-[var(--text-primary)]">৳{summary.total.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit Input Modal (Manager Only) */}
      {isManager && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--surface-color)] p-6 rounded-2xl shadow-xl w-full max-w-md border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-[var(--accent-green)] m-0">💳 নতুন টাকা জমা করুন</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors border-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddDeposit} className="space-y-4 text-left">
              <div className="form-group text-left">
                <label className="block mb-1 font-medium text-[var(--text-secondary)]">সদস্য নির্বাচন</label>
                <select 
                  className="form-control w-full" 
                  value={selectedMember} 
                  onChange={e => setSelectedMember(e.target.value)} 
                  required
                >
                  <option value="">নির্বাচন করুন</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name} (@{m.username})</option>)}
                </select>
              </div>
              <div className="form-group text-left">
                <label className="block mb-1 font-medium text-[var(--text-secondary)]">জমার পরিমাণ (৳)</label>
                <input 
                  type="number" 
                  className="form-control w-full" 
                  value={depositAmount} 
                  onChange={e => setDepositAmount(e.target.value)} 
                  placeholder="৳০.০০" 
                  required 
                />
              </div>
              <div className="form-group text-left">
                <label className="block mb-1 font-medium text-[var(--text-secondary)]">তারিখ</label>
                <input 
                  type="date" 
                  className="form-control w-full" 
                  value={depositDate} 
                  onChange={e => setDepositDate(e.target.value)} 
                  required 
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="btn btn-success w-full py-3 rounded-xl font-bold text-lg" 
                  disabled={saving}
                >
                  {saving ? 'সেভ হচ্ছে...' : 'টাকা জমা করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Ledger History */}
      <div className="card glass-card">
        <h3 style={{ color: 'var(--accent-green)', marginBottom: '1.5rem' }}>জমা ইতিহাস তালিকা</h3>

        {/* Mobile View (Cards) */}
        <div className="block md:hidden space-y-4">
          {deposits.length === 0 ? (
            <div className="text-center p-6 text-gray-500">কোন রেকর্ড পাওয়া যায়নি।</div>
          ) : (
            deposits.map(dep => (
              <div key={dep.id} className="bg-[var(--surface-color)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">{formatDisplayDate(dep.date)}</span>
                  <span className="font-bold text-[var(--accent-green)] text-lg">৳{Number(dep.amount).toFixed(0)}</span>
                </div>
                <div className="font-medium text-[var(--text-primary)] mb-1">সদস্য: {dep.memberName}</div>
                {isManager && (
                  <div className="flex gap-3 justify-end border-t border-[var(--border-color)] pt-3">
                    <button className="flex items-center gap-1 text-sm bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg" onClick={() => handleDeleteDeposit(dep.id)}>
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
                <th>সদস্য নাম</th>
                <th style={{ textAlign: 'right' }}>জমার পরিমাণ</th>
                {isManager && <th style={{ textAlign: 'right' }}>অ্যাকশন</th>}
              </tr>
            </thead>
            <tbody>
              {deposits.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    কোন রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                deposits.map(dep => (
                  <tr key={dep.id}>
                    <td>{formatDisplayDate(dep.date)}</td>
                    <td style={{ fontWeight: '500' }}>{dep.memberName}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-green)' }}>৳{Number(dep.amount).toFixed(0)}</td>
                    {isManager && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="icon-btn" onClick={() => handleDeleteDeposit(dep.id)} title="Delete" style={{ color: 'var(--accent-red)' }}>🗑️</button>
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

  if (isAdminPath) {
    return renderContent();
  }

  return (
    <div className="app-layout" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={isManager} />
      <main className="main-content" style={{ padding: '0 0 80px 0', flex: 1 }}>
        <Navbar userName={currentUser?.name} userRole={isManager ? 'ম্যানেজার' : 'সদস্য'} photoURL={currentUser?.photoURL} />
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {renderContent()}
        </div>
      </main>
      <BottomNav isManager={isManager} />
    </div>
  );
};

export default DepositManager;
