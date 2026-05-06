import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, addDoc, query, where } from '../firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const MarketExpense = () => {
  const [config, setConfig] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ shopper: '', details: '', itemName: '', quantity: '', cost: '', advance: '' });
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(doc(db, 'config', 'settings'), snap => { if (snap.exists()) setConfig(snap.data()); });
    const unsub2 = onSnapshot(collection(db, 'users'), snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!db || !config) return;
    const eQ = query(collection(db, 'expenses'), where('month_id', '==', config.current_month_id));
    const unsub = onSnapshot(eQ, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setExpenses(data);
    });
    return () => unsub();
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const costNum = Number(formData.cost);
    const advanceNum = Number(formData.advance) || 0;

    // Strict validation to avoid undefined/null
    if (!formData.shopper || !formData.itemName || !formData.quantity || !formData.cost) {
      showToast('সব তথ্য সঠিকভাবে দিন (সদস্য, পণ্যের নাম, পরিমাণ এবং খরচ)।', 'error'); return;
    }

    const shopper = members.find(m => m.id === formData.shopper);
    if (!shopper) { showToast('সদস্য খুঁজে পাওয়া যায়নি।', 'error'); return; }

    try {
      await addDoc(collection(db, 'expenses'), {
        month_id: config.current_month_id || '',
        date: new Date().toISOString().split('T')[0],
        bazar_member_id: formData.shopper,
        shopper_name: shopper.name || '',
        itemName: formData.itemName || '',
        quantity: formData.quantity || '',
        details: `${formData.itemName} (${formData.quantity})` + (formData.details ? ` - ${formData.details}` : ''),
        cost: costNum,
        advance: advanceNum,
        status: 'pending',
      });
      setFormData({ shopper: '', details: '', itemName: '', quantity: '', cost: '', advance: '' });
      setShowForm(false);
      showToast('বাজার এন্ট্রি সফল হয়েছে!', 'success');
    } catch (err) { console.error('Submit Error:', err); showToast('ব্যর্থ।', 'error'); }
  };

  const totalMeals = members.reduce((s, m) => s + (Number(m.total_meals) || 0), 0);
  const totalApprovedCost = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const liveRate = totalMeals === 0 ? 0 : (totalApprovedCost / totalMeals).toFixed(2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Summary Box for Live Rate */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(0, 209, 255, 0.05), transparent)', borderLeft: '4px solid var(--accent-blue)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>লাইভ মিল রেট</p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--accent-blue)' }}>৳{liveRate}</h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>মোট খরচ: ৳{totalApprovedCost}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>মোট মিল: {totalMeals}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>🛒 বাজার ও খরচ এন্ট্রি</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ বাতিল' : '+ নতুন বাজার এন্ট্রি'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'var(--surface-hover)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>বাজারকারী</label>
                <select className="form-control" value={formData.shopper} onChange={e => setFormData({ ...formData, shopper: e.target.value })} required>
                  <option value="">নির্বাচন করুন</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>পণ্যের নাম</label>
                <input className="form-control" value={formData.itemName} onChange={e => setFormData({ ...formData, itemName: e.target.value })} placeholder="যেমন: চাল" required />
              </div>
              <div className="form-group">
                <label>পরিমাণ</label>
                <input className="form-control" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="যেমন: ৫ কেজি" required />
              </div>
              <div className="form-group">
                <label>মোট খরচ (৳)</label>
                <input type="number" className="form-control" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>পাওয়ার পরিমাণ (৳)</label>
                <input type="number" className="form-control" value={formData.advance} onChange={e => setFormData({ ...formData, advance: e.target.value })} placeholder="ঐচ্ছিক" />
              </div>
              <div className="form-group">
                <label>বিস্তারিত (ঐচ্ছিক)</label>
                <input className="form-control" value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })} placeholder="অন্যান্য..." />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}>সাবমিট করুন</button>
          </form>
        )}

        <div className="table-container">
          <table>
            <thead><tr><th>তারিখ</th><th>বাজারকারী</th><th>পণ্যের বিবরণ</th><th style={{ textAlign: 'right' }}>খরচ</th><th style={{ textAlign: 'center' }}>স্ট্যাটাস</th></tr></thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id}>
                  <td>{exp.date}</td>
                  <td style={{ fontWeight: '500' }}>{exp.shopper_name}</td>
                  <td>{exp.details}</td>
                  <td style={{ textAlign: 'right', fontWeight: '700' }}>৳{exp.cost}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${exp.status === 'approved' ? 'badge-success' : 'badge-warning'}`}>
                      {exp.status === 'approved' ? 'Approved' : 'Pending'}
                    </span>
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

export default MarketExpense;
