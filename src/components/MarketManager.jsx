import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, addDoc, updateDoc, query, where } from '../firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getTodayISO, formatDisplayDate } from '../utils/monthUtils';

const MarketManager = () => {
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(null);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [approvedExpenses, setApprovedExpenses] = useState([]);
  const [selectedShopper, setSelectedShopper] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(getTodayISO());
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(collection(db, 'users'), snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsub2 = onSnapshot(doc(db, 'config', 'settings'), snap => { if (snap.exists()) setConfig(snap.data()); });
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    const pQ = query(collection(db, 'expenses'), where('month_id', '==', mid), where('status', '==', 'pending'));
    const aQ = query(collection(db, 'expenses'), where('month_id', '==', mid), where('status', '==', 'approved'));
    const u1 = onSnapshot(pQ, snap => setPendingExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(aQ, snap => setApprovedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [config]);

  const handleIssueAdvance = async (e) => {
    e.preventDefault();
    const amountNum = Number(advanceAmount);

    if (!selectedShopper || !advanceAmount || amountNum <= 0 || !config) {
      showToast('সদস্য এবং পরিমাণ সঠিকভাবে দিন।', 'error'); return;
    }

    const shopper = members.find(m => m.id === selectedShopper);
    if (!shopper) { showToast('সদস্য খুঁজে পাওয়া যায়নি।', 'error'); return; }

    try {
      await addDoc(collection(db, 'expenses'), {
        month_id: config.current_month_id,
        date: expenseDate,
        bazar_member_id: selectedShopper,
        shopper_name: shopper.name,
        advance: amountNum,
        note: note || '',
        cost: 0,
        details: note || 'এডভান্স ইস্যু',
        status: 'pending',
      });
      setSelectedShopper(''); setAdvanceAmount(''); setNote('');
      showToast(`${shopper.name} কে ৳${amountNum} এডভান্স ইস্যু করা হয়েছে!`, 'success');
    } catch (err) { console.error('Advance Error:', err); showToast('ব্যর্থ।', 'error'); }
  };

  const handleApprove = async (expense) => {
    try {
      await updateDoc(doc(db, 'expenses', expense.id), { status: 'approved' });
      showToast('অনুমোদিত হয়েছে!', 'success');
    } catch (err) { console.error(err); showToast('ব্যর্থ।', 'error'); }
  };

  const totalApproved = approvedExpenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="card">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-blue)' }}>💰 এডভান্স ইস্যু করুন</h3>
        <form onSubmit={handleIssueAdvance} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group">
            <label>সদস্যের নাম</label>
            <select className="form-control" value={selectedShopper} onChange={e => setSelectedShopper(e.target.value)} required>
              <option value="">নির্বাচন করুন</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>তারিখ</label>
            <input type="date" className="form-control" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>এডভান্স পরিমাণ (৳)</label>
            <input type="number" className="form-control" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} placeholder="৳০০.০০" required />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>নোট (বাজারের সম্ভাব্য ফর্দ)</label>
            <textarea className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="বাজারের তালিকা লিখুন..." style={{ minHeight: '80px' }}></textarea>
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: 'fit-content', padding: '0.875rem 1.5rem' }}>ইস্যু করুন</button>
        </form>
      </div>

      {/* Lists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--accent-orange)' }}>পেন্ডিং রিসিট ({pendingExpenses.length})</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>তারিখ</th><th>সদস্য</th><th>পরিমাণ</th><th>অ্যাকশন</th></tr></thead>
              <tbody>
                {pendingExpenses.map(e => (
                  <tr key={e.id}>
                    <td>{formatDisplayDate(e.date)}</td>
                    <td>{e.shopper_name}</td>
                    <td>৳{e.advance}</td>
                    <td>
                      {e.cost > 0 ? (
                        <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleApprove(e)}>Approve</button>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>রিসিট বাকি</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--accent-green)' }}>অনুমোদিত খরচ</h3>
            <span style={{ fontWeight: '700' }}>৳{totalApproved}</span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>তারিখ</th><th>সদস্য</th><th>খরচ</th></tr></thead>
              <tbody>
                {approvedExpenses.map(e => (
                  <tr key={e.id}>
                    <td>{formatDisplayDate(e.date)}</td>
                    <td>{e.shopper_name}</td>
                    <td style={{ fontWeight: '600' }}>৳{e.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketManager;
