import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, addDoc, updateDoc, query, where } from '../firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getTodayDisplay } from '../utils/monthUtils';

const MarketManager = () => {
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(null);
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [approvedExpenses, setApprovedExpenses] = useState([]);
  const [selectedShopper, setSelectedShopper] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(collection(db, 'users'), snap => setMembers(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    const unsub2 = onSnapshot(doc(db, 'config', 'settings'), snap => { if (snap.exists()) setConfig(snap.data()); });
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    const pQ = query(collection(db, 'expenses'), where('month_id', '==', mid), where('status', '==', 'pending'));
    const aQ = query(collection(db, 'expenses'), where('month_id', '==', mid), where('status', '==', 'approved'));
    const u1 = onSnapshot(pQ, snap => setPendingExpenses(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    const u2 = onSnapshot(aQ, snap => setApprovedExpenses(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [config]);

  const handleIssueAdvance = async (e) => {
    e.preventDefault();
    if (!selectedShopper || !advanceAmount || Number(advanceAmount) <= 0) {
      showToast('সদস্য এবং পরিমাণ সঠিকভাবে দিন।', 'error'); return;
    }
    const shopper = members.find(m => m.id === selectedShopper);
    try {
      await addDoc(collection(db, 'expenses'), {
        month_id: config.current_month_id,
        date: new Date().toISOString().split('T')[0],
        shopper_id: selectedShopper,
        shopper_name: shopper.name,
        advance: Number(advanceAmount),
        cost: 0, details: '', status: 'pending',
      });
      setSelectedShopper(''); setAdvanceAmount('');
      showToast(`${shopper.name} কে ৳${advanceAmount} এডভান্স ইস্যু করা হয়েছে!`, 'success');
    } catch (err) { console.error(err); showToast('এডভান্স ইস্যু ব্যর্থ।', 'error'); }
  };

  const handleApprove = async (expense) => {
    try {
      await updateDoc(doc(db, 'expenses', expense.id), { status: 'approved' });
      showToast('খরচ অনুমোদিত হয়েছে!', 'success');
    } catch (err) { console.error(err); showToast('অনুমোদন ব্যর্থ।', 'error'); }
  };

  const totalApproved = approvedExpenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2>🛒 বাজার ম্যানেজার</h2>
        <span style={{ fontSize:'0.875rem', color:'var(--text-secondary)', background:'var(--surface-hover)', padding:'0.25rem 0.75rem', borderRadius:'var(--radius-full)' }}>{getTodayDisplay()}</span>
      </div>

      {/* Issue Advance */}
      <div className="card">
        <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-blue)' }}>এডভান্স ইস্যু করুন</h3>
        <form onSubmit={handleIssueAdvance} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'1rem', alignItems:'end' }}>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>বাজারকারী সদস্য</label>
            <select className="form-control" value={selectedShopper} onChange={e => setSelectedShopper(e.target.value)} required>
              <option value="">নির্বাচন করুন</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>এডভান্স পরিমাণ (৳)</label>
            <input type="number" className="form-control" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} min="1" placeholder="পরিমাণ..." required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height:'fit-content', padding:'0.875rem 1.5rem' }}>ইস্যু করুন</button>
        </form>
      </div>

      {/* Pending Receipts */}
      <div className="card">
        <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-orange)' }}>পেন্ডিং রিসিট ({pendingExpenses.length})</h3>
        {pendingExpenses.length === 0 ? (
          <p style={{ color:'var(--text-secondary)' }}>কোনো পেন্ডিং রিসিট নেই।</p>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>তারিখ</th><th>বাজারকারী</th><th>বিবরণ</th><th>এডভান্স</th><th>খরচ</th><th>অ্যাকশন</th></tr></thead>
              <tbody>
                {pendingExpenses.map(e => (
                  <tr key={e.id}>
                    <td style={{ color:'var(--text-secondary)' }}>{e.date}</td>
                    <td style={{ fontWeight:'500' }}>{e.shopper_name}</td>
                    <td>{e.details || <span style={{ color:'var(--text-secondary)', fontStyle:'italic' }}>অপেক্ষমাণ...</span>}</td>
                    <td>৳{e.advance}</td>
                    <td>{e.cost ? `৳${e.cost}` : '—'}</td>
                    <td>
                      {e.cost > 0 ? (
                        <button className="btn btn-primary" style={{ padding:'0.25rem 0.75rem', fontSize:'0.875rem' }} onClick={() => handleApprove(e)}>অনুমোদন</button>
                      ) : (
                        <span className="badge badge-warning">রিসিট অপেক্ষা</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approved List */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
          <h3 style={{ color:'var(--accent-green)' }}>অনুমোদিত বাজার ({approvedExpenses.length})</h3>
          <span style={{ fontSize:'1rem', fontWeight:'700', color:'var(--accent-green)' }}>মোট: ৳{totalApproved.toLocaleString()}</span>
        </div>
        {approvedExpenses.length === 0 ? (
          <p style={{ color:'var(--text-secondary)' }}>এই মাসে কোনো অনুমোদিত বাজার নেই।</p>
        ) : (
          <div className="table-container">
            <table>
              <thead><tr><th>তারিখ</th><th>বাজারকারী</th><th>বিবরণ</th><th style={{ textAlign:'right' }}>এডভান্স</th><th style={{ textAlign:'right' }}>খরচ</th><th style={{ textAlign:'right' }}>ফেরত</th></tr></thead>
              <tbody>
                {approvedExpenses.map(e => {
                  const ret = (e.advance||0) - (e.cost||0);
                  return (
                    <tr key={e.id}>
                      <td style={{ color:'var(--text-secondary)' }}>{e.date}</td>
                      <td style={{ fontWeight:'500' }}>{e.shopper_name}</td>
                      <td>{e.details}</td>
                      <td style={{ textAlign:'right' }}>৳{e.advance}</td>
                      <td style={{ textAlign:'right' }}>৳{e.cost}</td>
                      <td style={{ textAlign:'right', fontWeight:'600', color: ret < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{ret > 0 ? `+${ret}` : ret}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketManager;
