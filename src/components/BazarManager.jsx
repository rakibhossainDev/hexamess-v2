import { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from '../utils/firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';

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

  // Unified monthYear for aggregation
  const monthYear = useMemo(() => {
    if (!bazarDate) return '';
    const [y, m, d] = bazarDate.split('-');
    return `${m}-${y}`;
  }, [bazarDate]);

  useEffect(() => {
    if (!db) return;
    
    // Listen to members
    const unsubMembers = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to bazar records for current month
    const currentMonth = new Date().toISOString().substring(5, 7) + '-' + new Date().getFullYear();
    const q = query(collection(db, 'bazar_records'), where('monthYear', '==', currentMonth));
    const unsubRecords = onSnapshot(q, snap => {
      setBazarRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
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
        showToast('খরচ আপডেট করা হয়েছে!', 'success');
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

  const totalBazar = bazarRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
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
            <label>বাজার ম্যানেজার</label>
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
                style={{ flex: 1, background: 'var(--surface-hover)' }}
              >
                বাতিল
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--accent-blue)', margin: 0 }}>এই মাসের বাজার তালিকা</h3>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>মোট খরচ</p>
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
                <div className="font-medium text-[var(--text-primary)] mb-1">{r.itemName}</div>
                <div className="text-sm text-[var(--text-secondary)] mb-4">ম্যানেজার: {r.managerName}</div>
                <div className="flex gap-3 justify-end border-t border-[var(--border-color)] pt-3">
                  <button className="flex items-center gap-1 text-sm bg-[var(--surface-hover)] px-3 py-1.5 rounded-lg" onClick={() => handleEdit(r)}>
                    ✏️ এডিট
                  </button>
                  <button className="flex items-center gap-1 text-sm bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg" onClick={() => handleDelete(r.id)}>
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
                <th>আইটেম</th>
                <th>ম্যানেজার</th>
                <th style={{ textAlign: 'right' }}>পরিমাণ</th>
                <th style={{ textAlign: 'right' }}>অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {bazarRecords.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>কোন রেকর্ড পাওয়া যায়নি।</td></tr>
              ) : (
                bazarRecords.map(r => (
                  <tr key={r.id} style={{ background: editingId === r.id ? 'rgba(0, 150, 255, 0.1)' : 'transparent' }}>
                    <td>{formatDisplayDate(r.date)}</td>
                    <td style={{ fontWeight: '500' }}>{r.itemName}</td>
                    <td>{r.managerName}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-orange)' }}>৳{r.amount}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="icon-btn" onClick={() => handleEdit(r)} title="Edit">✏️</button>
                        <button className="icon-btn" onClick={() => handleDelete(r.id)} title="Delete" style={{ color: 'var(--accent-red)' }}>🗑️</button>
                      </div>
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

export default BazarManager;
