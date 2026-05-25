import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { db, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from '../utils/firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

const renderBazarItems = (rawText) => {
  try {
    if (!rawText || typeof rawText !== 'string') return "";
    
    let formattedText = rawText;
    const bengaliDigits = ['১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯', '১০'];
    const englishDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    
    bengaliDigits.forEach(digit => {
      // Delimiter with space
      formattedText = formattedText.replaceAll(` ${digit}।`, `|${digit}।`);
      formattedText = formattedText.replaceAll(` ${digit}.`, `|${digit}.`);
      formattedText = formattedText.replaceAll(` ${digit})`, `|${digit})`);
      // Delimiter without space at the start
      if (!formattedText.startsWith(`${digit}।`)) {
        formattedText = formattedText.replaceAll(`${digit}।`, `|${digit}।`);
      }
      if (!formattedText.startsWith(`${digit}.`)) {
        formattedText = formattedText.replaceAll(`${digit}.`, `|${digit}.`);
      }
      if (!formattedText.startsWith(`${digit})`)) {
        formattedText = formattedText.replaceAll(`${digit})`, `|${digit})`);
      }
    });

    englishDigits.forEach(digit => {
      // Delimiter with space
      formattedText = formattedText.replaceAll(` ${digit}।`, `|${digit}।`);
      formattedText = formattedText.replaceAll(` ${digit}.`, `|${digit}.`);
      formattedText = formattedText.replaceAll(` ${digit})`, `|${digit})`);
      // Delimiter without space at the start
      if (!formattedText.startsWith(`${digit}।`)) {
        formattedText = formattedText.replaceAll(`${digit}।`, `|${digit}।`);
      }
      if (!formattedText.startsWith(`${digit}.`)) {
        formattedText = formattedText.replaceAll(`${digit}.`, `|${digit}.`);
      }
      if (!formattedText.startsWith(`${digit})`)) {
        formattedText = formattedText.replaceAll(`${digit})`, `|${digit})`);
      }
    });

    let lines;
    if (formattedText.includes('|')) {
      lines = formattedText.split('|');
    } else if (rawText.includes(',')) {
      lines = rawText.split(',');
    } else if (rawText.includes('|')) {
      lines = rawText.split('|');
    } else {
      lines = [rawText];
    }
    
    return lines.map((line, index) => (
      <div key={index} className="block py-0.5 text-gray-200" style={{ fontFamily: "'Tiro Bangla', serif", display: 'block' }}>
        {line.trim()}
      </div>
    ));
  } catch (error) {
    console.error("Error rendering bazar items:", error);
    return <div className="block py-0.5 text-gray-200" style={{ fontFamily: "'Tiro Bangla', serif", display: 'block' }}>{String(rawText || "")}</div>;
  }
};

const BazarManager = () => {
  const [members, setMembers] = useState([]);
  const [bazarRecords, setBazarRecords] = useState([]);
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [bazarDate, setBazarDate] = useState(getTodayDateString());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { toasts, showToast, removeToast } = useToast();

  // Unified monthYear for aggregation (e.g., "05-2026")
  const monthYear = useMemo(() => {
    if (!bazarDate) return '';
    const [y, m] = bazarDate.split('-');
    return `${m}-${y}`;
  }, [bazarDate]);

  useEffect(() => {
    if (!db) return;
    
    // Listen to members
    const unsubMembers = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(dSnap => ({ id: dSnap.id, ...dSnap.data() })));
    });

    // Listen to bazar records for the current month
    const todayStr = getTodayDateString();
    const [y, m] = todayStr.split('-');
    const currentMonthId = `${m}-${y}`;
    
    const q = query(collection(db, 'bazar_records'), where('monthYear', '==', currentMonthId));
    const unsubRecords = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory by date descending, or by creation
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setBazarRecords(data);
    });

    return () => { unsubMembers(); unsubRecords(); };
  }, []);

  const handleIssueBazar = async (e) => {
    e.preventDefault();
    if (saving) return;

    const amountNum = Number(amount);
    if (!itemName || !amount || amountNum <= 0 || !selectedManager) {
      showToast('সবগুলো ঘর সঠিকভাবে পূরণ করুন।', 'error');
      return;
    }

    const manager = members.find(m => m.id === selectedManager);
    if (!manager) return;

    setSaving(true);
    try {
      if (editingId) {
        // UPDATE EXISTING RECORD
        await updateDoc(doc(db, 'bazar_records', editingId), {
          itemName,
          amount: amountNum,
          date: bazarDate,
          managerName: manager.name,
          managerId: manager.id,
          monthYear,
          updatedAt: serverTimestamp()
        });
        showToast('বাজার খরচ আপডেট করা হয়েছে!', 'success');
      } else {
        // CREATE NEW RECORD
        await addDoc(collection(db, 'bazar_records'), {
          itemName,
          amount: amountNum,
          date: bazarDate,
          managerName: manager.name,
          managerId: manager.id,
          monthYear,
          createdAt: serverTimestamp()
        });
        showToast('বাজার খরচ সফলভাবে ইস্যু করা হয়েছে!', 'success');
      }

      resetForm();
    } catch (err) {
      console.error('Bazar Save Error:', err);
      showToast('সেভ করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setItemName(record.itemName);
    setAmount(record.amount);
    setBazarDate(record.date);
    setSelectedManager(record.managerId || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে এই খরচটি ডিলিট করতে চান?")) return;
    
    try {
      await deleteDoc(doc(db, 'bazar_records', id));
      showToast('খরচ ডিলিট করা হয়েছে।', 'success');
    } catch (err) {
      console.error('Delete Error:', err);
      showToast('ডিলিট করা যায়নি।', 'error');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setItemName('');
    setAmount('');
    setSelectedManager('');
  };

  const currentUser = JSON.parse(localStorage.getItem('hexa_user') || '{}');
  const isManagerUser = currentUser?.username === 'manager';
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  const totalBazar = bazarRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const content = (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>বাজার ম্যানেজার</h2>
      </div>

      {/* Bazar Expense Form */}
      {isManagerUser && (
        <div className="card glass-card">
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-orange)' }}>🛒 বাজার খরচ ইস্যু করুন</h3>
          <form onSubmit={handleIssueBazar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
            <div className="form-group">
              <label>বাজারের নাম/আইটেম</label>
              <input 
                type="text" 
                className="form-control" 
                value={itemName} 
                onChange={e => setItemName(e.target.value)} 
                placeholder="যেমন: আলু, পেঁয়াজ, মাংস" 
                required 
              />
            </div>
            <div className="form-group">
              <label>পরিমাণ (৳)</label>
              <input 
                type="number" 
                className="form-control" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="৳০০.০০" 
                required 
              />
            </div>
            <div className="form-group">
              <label>তারিখ</label>
              <input 
                type="date" 
                className="form-control" 
                value={bazarDate} 
                onChange={e => setBazarDate(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label>বাজারকারী (সদস্য)</label>
              <select 
                className="form-control" 
                value={selectedManager} 
                onChange={e => setSelectedManager(e.target.value)} 
                required
              >
                <option value="">নির্বাচন করুন</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', gridColumn: 'span 1' }}>
              <button 
                type="submit" 
                className={`btn ${editingId ? 'btn-success' : 'btn-primary'}`} 
                disabled={saving}
                style={{ flex: 2, height: 'fit-content', padding: '0.875rem 1rem' }}
              >
                {saving ? 'সেভ হচ্ছে...' : (editingId ? 'আপডেট করুন' : 'ইস্যু করুন')}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  className="btn" 
                  onClick={resetForm}
                  style={{ flex: 1, background: 'var(--surface-hover)', padding: '0.875rem 1rem' }}
                >
                  বাতিল
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Bazar list */}
      <div className="card glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--accent-blue)', margin: 0 }}>এই মাসের বাজার তালিকা</h3>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>মোট বাজার খরচ</p>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-green)' }}>৳{totalBazar}</span>
          </div>
        </div>
        
        {/* Mobile View (Cards) */}
        <div className="block md:hidden space-y-4">
          {bazarRecords.length === 0 ? (
            <div className="text-center p-6 text-gray-500">কোন রেকর্ড পাওয়া যায়নি।</div>
          ) : (
            bazarRecords.map(r => (
              <div key={r.id} className="bg-[var(--surface-color)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">{formatDisplayDate(r.date)}</span>
                  <span className="font-bold text-[var(--accent-orange)] text-lg">৳{r.amount}</span>
                </div>
                <div className="font-medium text-[var(--text-primary)] mb-1">{renderBazarItems(r?.itemName || r?.item || r?.items || "")}</div>
                <div className="text-sm text-[var(--text-secondary)] mb-4">বাজারকারী: {r.managerName}</div>
                {isManagerUser && (
                  <div className="flex gap-3 justify-end border-t border-[var(--border-color)] pt-3">
                    <button className="flex items-center gap-1 text-sm bg-[var(--surface-hover)] px-3 py-1.5 rounded-lg" onClick={() => handleEdit(r)}>
                      ✏️ এডিট
                    </button>
                    <button className="flex items-center gap-1 text-sm bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg" onClick={() => handleDelete(r.id)}>
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
                <th>আইটেম</th>
                <th>বাজারকারী</th>
                <th style={{ textAlign: 'right' }}>পরিমাণ</th>
                {isManagerUser && <th style={{ textAlign: 'right' }}>অ্যাকশন</th>}
              </tr>
            </thead>
            <tbody>
              {bazarRecords.length === 0 ? (
                <tr>
                  <td colSpan={isManagerUser ? 5 : 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    কোন রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                bazarRecords.map(r => (
                  <tr key={r.id} style={{ background: editingId === r.id ? 'rgba(0, 150, 255, 0.1)' : 'transparent' }}>
                    <td>{formatDisplayDate(r.date)}</td>
                    <td style={{ fontWeight: '500' }}>{renderBazarItems(r?.itemName || r?.item || r?.items || "")}</td>
                    <td>{r.managerName}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-orange)' }}>৳{r.amount}</td>
                    {isManagerUser && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="icon-btn" onClick={() => handleEdit(r)} title="Edit">✏️</button>
                          <button className="icon-btn" onClick={() => handleDelete(r.id)} title="Delete" style={{ color: 'var(--accent-red)' }}>🗑️</button>
                        </div>
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
    return content;
  }

  return (
    <div className="app-layout" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={isManagerUser} />
      <main className="main-content" style={{ padding: '0 0 80px 0', flex: 1 }}>
        <Navbar userName={currentUser?.name} userRole={isManagerUser ? 'ম্যানেজার' : 'সদস্য'} photoURL={currentUser?.photoURL} />
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {content}
        </div>
      </main>
      <BottomNav isManager={isManagerUser} />
    </div>
  );
};

export default BazarManager;
