import { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, addDoc, serverTimestamp, query, where } from '../utils/firebase';
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
      await addDoc(collection(db, 'bazar_records'), {
        itemName,
        amount: amountNum,
        date: bazarDate,
        managerName: manager.name,
        managerId: manager.id,
        monthYear,
        createdAt: serverTimestamp()
      });

      setItemName('');
      setAmount('');
      showToast('বাজার খরচ সফলভাবে ইস্যু করা হয়েছে!', 'success');
    } catch (err) {
      console.error('Bazar Save Error:', err);
      showToast('সেভ করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setSaving(false);
    }
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
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={saving}
            style={{ height: 'fit-content', padding: '0.875rem 1.5rem', gridColumn: 'span 1' }}
          >
            {saving ? 'সেভ হচ্ছে...' : 'ইস্যু করুন'}
          </button>
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
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>আইটেম</th>
                <th>ম্যানেজার</th>
                <th style={{ textAlign: 'right' }}>পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              {bazarRecords.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>কোন রেকর্ড পাওয়া যায়নি।</td></tr>
              ) : (
                bazarRecords.map(r => (
                  <tr key={r.id}>
                    <td>{formatDisplayDate(r.date)}</td>
                    <td style={{ fontWeight: '500' }}>{r.itemName}</td>
                    <td>{r.managerName}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent-orange)' }}>৳{r.amount}</td>
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
