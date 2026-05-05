import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, addDoc, query, where } from '../firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const ExpenseTracker = () => {
  const [config, setConfig] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ shopper:'', details:'', cost:'', advance:'' });
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const u1 = onSnapshot(doc(db, 'config', 'settings'), snap => { if (snap.exists()) setConfig(snap.data()); });
    const u2 = onSnapshot(collection(db, 'users'), snap => setMembers(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (!db || !config) return;
    const eQ = query(collection(db, 'expenses'), where('month_id', '==', config.current_month_id));
    const unsub = onSnapshot(eQ, snap => {
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setExpenses(data);
    });
    return () => unsub();
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.shopper || !formData.details || !formData.cost) { showToast('সব তথ্য পূরণ করুন।', 'error'); return; }
    const shopper = members.find(m => m.id === formData.shopper);
    try {
      await addDoc(collection(db, 'expenses'), {
        month_id: config.current_month_id,
        date: new Date().toISOString().split('T')[0],
        shopper_id: formData.shopper,
        shopper_name: shopper?.name || '',
        details: formData.details,
        cost: Number(formData.cost),
        advance: Number(formData.advance) || 0,
        status: 'pending',
      });
      setFormData({ shopper:'', details:'', cost:'', advance:'' });
      setShowForm(false);
      showToast('বাজার এন্ট্রি সাবমিট হয়েছে!', 'success');
    } catch (err) { console.error(err); showToast('সাবমিট ব্যর্থ।', 'error'); }
  };

  const negCount = members.filter(m => (m.current_balance||0) < 0).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem', flex:1 }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {negCount > 0 && (
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', padding:'1rem 1.5rem', borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', gap:'1rem' }}>
          <div style={{ background:'var(--accent-red)', color:'#fff', width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', flexShrink:0 }}>!</div>
          <div>
            <p style={{ color:'var(--text-primary)', fontWeight:'600', marginBottom:'0.25rem' }}>ব্যালেন্স সতর্কতা</p>
            <p style={{ color:'#FCA5A5', fontSize:'0.875rem' }}>{negCount} জন মেম্বারের ব্যালেন্স নেগেটিভ।</p>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
          <h2 style={{ fontSize:'1.25rem', fontWeight:'600' }}>সাম্প্রতিক বাজারের তালিকা</h2>
          <button className="btn btn-primary" style={{ fontSize:'0.875rem' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ বাতিল' : '+ নতুন বাজার এন্ট্রি'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom:'1.5rem', padding:'1.25rem', background:'rgba(0,209,255,0.04)', borderRadius:'var(--radius-md)', border:'1px solid rgba(0,209,255,0.1)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>বাজারকারী</label>
                <select className="form-control" value={formData.shopper} onChange={e => setFormData({...formData, shopper:e.target.value})} required>
                  <option value="">নির্বাচন করুন</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>বিবরণ</label>
                <input className="form-control" value={formData.details} onChange={e => setFormData({...formData, details:e.target.value})} placeholder="চাল, ডাল, তেল..." required />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'1rem', alignItems:'end' }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>খরচ (৳)</label>
                <input type="number" className="form-control" value={formData.cost} onChange={e => setFormData({...formData, cost:e.target.value})} min="1" required />
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>এডভান্স (৳)</label>
                <input type="number" className="form-control" value={formData.advance} onChange={e => setFormData({...formData, advance:e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding:'0.875rem 1.5rem' }}>সাবমিট</button>
            </div>
          </form>
        )}

        {expenses.length === 0 ? (
          <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>এই মাসে কোনো বাজার এন্ট্রি নেই।</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>তারিখ</th><th>বাজারকারী</th><th>বিবরণ</th>
                  <th style={{ textAlign:'right' }}>এডভান্স</th><th style={{ textAlign:'right' }}>খরচ</th>
                  <th style={{ textAlign:'right' }}>ফেরত</th><th style={{ textAlign:'center' }}>স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => {
                  const ret = (exp.advance||0) - (exp.cost||0);
                  return (
                    <tr key={exp.id}>
                      <td style={{ color:'var(--text-secondary)' }}>{exp.date}</td>
                      <td style={{ fontWeight:'500' }}>{exp.shopper_name}</td>
                      <td>{exp.details || '—'}</td>
                      <td style={{ textAlign:'right' }}>{exp.advance || 0}</td>
                      <td style={{ textAlign:'right' }}>{exp.cost || 0}</td>
                      <td style={{ textAlign:'right', fontWeight:'600', color: ret < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                        {exp.cost ? (ret > 0 ? `+${ret}` : ret) : '—'}
                      </td>
                      <td style={{ textAlign:'center' }}>
                        <span className={`badge ${exp.status === 'approved' ? 'badge-success' : 'badge-warning'}`}>
                          {exp.status === 'approved' ? 'অনুমোদিত' : 'পেন্ডিং'}
                        </span>
                      </td>
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

export default ExpenseTracker;
