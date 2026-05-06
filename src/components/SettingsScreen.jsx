import { useState, useEffect } from 'react';
import {
  db, collection, doc, onSnapshot, setDoc, writeBatch,
} from '../firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getMonthLabel, getNextMonthId } from '../utils/monthUtils';

const SettingsScreen = () => {
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(null);
  const [selectedNewManager, setSelectedNewManager] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(collection(db, 'users'), (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) setConfig({ id: snap.id, ...snap.data() });
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleChangeManager = async () => {
    if (!selectedNewManager) { showToast('দয়া করে নতুন ম্যানেজার নির্বাচন করুন।', 'error'); return; }
    const newMgr = members.find(m => m.id === selectedNewManager);
    if (!newMgr) return;
    try {
      const batch = writeBatch(db);
      if (config?.manager_id) batch.update(doc(db, 'users', config.manager_id), { role: 'member' });
      batch.update(doc(db, 'users', selectedNewManager), { role: 'manager' });
      batch.update(doc(db, 'config', 'settings'), { manager_id: selectedNewManager, manager_name: newMgr.name });
      await batch.commit();
      setSelectedNewManager('');
      showToast(`${newMgr.name} কে নতুন ম্যানেজার নিয়োগ দেওয়া হয়েছে!`, 'success');
    } catch (err) { console.error(err); showToast('ম্যানেজার পরিবর্তন ব্যর্থ।', 'error'); }
  };

  const handleMonthlyReset = async () => {
    if (!config) return;
    try {
      const cur = config.current_month_id;
      const next = getNextMonthId(cur);
      const archive = { month_id: cur, archived_at: new Date().toISOString(),
        members: members.map(m => ({ id:m.id, name:m.name, total_deposit:m.total_deposit||0, current_balance:m.current_balance||0, total_meals:m.total_meals||0, role:m.role })),
        total_deposits: members.reduce((s,m) => s+(m.total_deposit||0), 0),
        total_meals: members.reduce((s,m) => s+(m.total_meals||0), 0),
      };
      await setDoc(doc(db, 'archives', cur), archive);
      const batch = writeBatch(db);
      members.forEach(m => { 
        // Reset only total_meals, keep total_deposit and current_balance (carry-over)
        batch.update(doc(db, 'users', m.id), { total_meals: 0 }); 
      });
      batch.update(doc(db, 'config', 'settings'), { current_month_id: next });
      await batch.commit();
      setResetConfirm(false);
      showToast(`${getMonthLabel(cur)} আর্কাইভ হয়েছে! ${getMonthLabel(next)} শুরু হয়েছে।`, 'success');
    } catch (err) { console.error(err); showToast('মাসিক রিসেট ব্যর্থ।', 'error'); }
  };

  const currentManager = members.find(m => m.id === config?.manager_id);
  const nonMgr = members.filter(m => m.id !== config?.manager_id);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <h2>⚙️ সেটিংস</h2>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem' }}>
        {/* Manager Assignment */}
        <div className="card">
          <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-blue)' }}>ম্যানেজার পরিবর্তন</h3>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1rem', background:'rgba(0,209,255,0.06)', borderRadius:'var(--radius-md)', marginBottom:'1.5rem', border:'1px solid rgba(0,209,255,0.15)' }}>
            <span style={{ fontSize:'1.5rem' }}>👑</span>
            <div>
              <p style={{ fontWeight:'600' }}>{currentManager?.name || '—'}</p>
              <p style={{ fontSize:'0.8rem', color:'var(--accent-blue)' }}>বর্তমান ম্যানেজার</p>
            </div>
          </div>
          <div className="form-group">
            <label>নতুন ম্যানেজার নির্বাচন করুন</label>
            <select className="form-control" value={selectedNewManager} onChange={e => setSelectedNewManager(e.target.value)}>
              <option value="">সদস্য নির্বাচন করুন</option>
              {nonMgr.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ width:'100%', marginTop:'0.5rem' }} onClick={handleChangeManager} disabled={!selectedNewManager}>
            ম্যানেজার পরিবর্তন করুন
          </button>
        </div>

        {/* Monthly Reset */}
        <div className="card">
          <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-orange)' }}>মাসিক সেশন</h3>
          <div style={{ padding:'1rem', background:'rgba(245,158,11,0.06)', borderRadius:'var(--radius-md)', marginBottom:'1.5rem', border:'1px solid rgba(245,158,11,0.15)' }}>
            <p style={{ fontSize:'0.875rem', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>চলতি মাস</p>
            <p style={{ fontSize:'1.5rem', fontWeight:'700', color:'var(--accent-orange)' }}>{config ? getMonthLabel(config.current_month_id) : '—'}</p>
          </div>
          {!resetConfirm ? (
            <button className="btn" style={{ width:'100%', background:'rgba(245,158,11,0.1)', color:'var(--accent-orange)', border:'1px solid rgba(245,158,11,0.25)', fontWeight:'600' }} onClick={() => setResetConfirm(true)}>
              🔄 নতুন মাস শুরু করুন
            </button>
          ) : (
            <div style={{ padding:'1rem', background:'rgba(239,68,68,0.08)', borderRadius:'var(--radius-md)', border:'1px solid rgba(239,68,68,0.2)' }}>
              <p style={{ fontSize:'0.875rem', color:'var(--accent-red)', fontWeight:'600', marginBottom:'0.75rem' }}>⚠️ এই অ্যাকশন সব ব্যালেন্স রিসেট করবে।</p>
              <div style={{ display:'flex', gap:'0.75rem' }}>
                <button className="btn" style={{ flex:1, background:'rgba(239,68,68,0.15)', color:'var(--accent-red)', border:'1px solid rgba(239,68,68,0.3)' }} onClick={handleMonthlyReset}>নিশ্চিত</button>
                <button className="btn" style={{ flex:1 }} onClick={() => setResetConfirm(false)}>বাতিল</button>
              </div>
            </div>
          )}
          <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:'1rem' }}>রিসেট করলে বর্তমান ডাটা হিস্টরিতে সংরক্ষিত থাকবে।</p>
        </div>
      </div>

      {/* Roles Table */}
      <div className="card">
        <h3 style={{ marginBottom:'1.5rem', color:'var(--accent-green)' }}>সদস্যদের ভূমিকা</h3>
        <div className="table-container">
          <table>
            <thead><tr><th>#</th><th>নাম</th><th style={{ textAlign:'center' }}>ভূমিকা</th></tr></thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id}>
                  <td>{i+1}</td>
                  <td style={{ fontWeight:'500' }}>{m.name}</td>
                  <td style={{ textAlign:'center' }}>
                    <span className={`badge ${m.role === 'manager' ? 'badge-manager' : 'badge-success'}`}>
                      {m.role === 'manager' ? '👑 ম্যানেজার' : 'সদস্য'}
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

export default SettingsScreen;
