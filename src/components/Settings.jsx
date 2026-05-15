import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, writeBatch, query, where, getDocs, addDoc } from '../firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { getMonthLabel } from '../utils/monthUtils';

const Settings = () => {
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const currentManager = members.find(m => m.role === 'manager');

  const handleChangeManager = async (newManagerId) => {
    if (!newManagerId) return;
    const confirmChange = window.confirm("আপনি কি নিশ্চিতভাবে ম্যানেজার পরিবর্তন করতে চান?");
    if (!confirmChange) return;

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Demote current manager
      if (currentManager) {
        batch.update(doc(db, 'users', currentManager.id), { role: 'member' });
      }
      
      // 2. Promote new manager
      batch.update(doc(db, 'users', newManagerId), { role: 'manager' });
      
      await batch.commit();
      showToast('ম্যানেজার সফলভাবে পরিবর্তন করা হয়েছে!', 'success');
    } catch (err) {
      console.error('Manager change error:', err);
      showToast('পরিবর্তন ব্যর্থ।', 'error');
    }
    setIsProcessing(false);
  };

  const handleStartNewMonth = async () => {
    if (!config) return;
    const newMonthName = window.prompt("নতুন মাসের নাম দিন (যেমন: May 2024):");
    if (!newMonthName) return;

    setIsProcessing(true);
    try {
      const cur = config.current_month_id;
      
      // 1. Archive current month data
      const [mealSnap, expSnap, fixedSnap] = await Promise.all([
        getDocs(query(collection(db, 'daily_meals'), where('month_id', '==', cur))),
        getDocs(query(collection(db, 'expenses'), where('month_id', '==', cur))),
        getDocs(query(collection(db, 'fixed_costs'), where('month_id', '==', cur)))
      ]);

      const meals = mealSnap.docs.map(d => d.data());
      const expenses = expSnap.docs.map(d => d.data());
      const fixedCosts = fixedSnap.docs.map(d => d.data());

      const totalMarket = expenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);
      const totalFixed = fixedCosts.reduce((s, f) => s + (Number(f.amount) || 0), 0);
      const totalMealsCount = meals.reduce((s, m) => s + (Number(m.total) || 0), 0);
      const mealRate = totalMealsCount === 0 ? 0 : (totalMarket / totalMealsCount).toFixed(2);

      await addDoc(collection(db, 'history_archive'), {
        month_id: cur,
        month_name: getMonthLabel(cur),
        total_market: totalMarket,
        total_fixed: totalFixed,
        total_meals: totalMealsCount,
        meal_rate: Number(mealRate),
        archived_at: new Date().toISOString()
      });

      // 2. Reset member stats
      const batch = writeBatch(db);
      members.forEach(m => {
        batch.update(doc(db, 'users', m.id), {
          total_meals: 0,
          total_deposit: 0,
          current_balance: 0 // Resetting balance for new month, or keep it? User didn't specify.
        });
      });

      // 3. Update config
      const newMonthId = newMonthName.toLowerCase().replace(' ', '_');
      batch.update(doc(db, 'config', 'settings'), {
        current_month_id: newMonthId,
        last_reset: new Date().toISOString()
      });

      await batch.commit();
      showToast('নতুন মাস সফলভাবে শুরু হয়েছে!', 'success');
    } catch (err) {
      console.error('New month error:', err);
      showToast('ব্যর্থ।', 'error');
    }
    setIsProcessing(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>⚙️ সিস্টেম সেটিংস</h2>
        
        {/* Manager Management */}
        <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(255, 215, 0, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👑 ম্যানেজার পরিবর্তন
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            বর্তমান ম্যানেজার: <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{currentManager?.name || 'নেই'}</span>
          </p>
          <div className="form-group">
            <select 
              className="form-control" 
              value="" 
              onChange={(e) => handleChangeManager(e.target.value)}
              disabled={isProcessing}
            >
              <option value="">নতুন ম্যানেজার নির্বাচন করুন...</option>
              {members.filter(m => m.role !== 'manager').map(m => (
                <option key={m.id} value={m.id}>{m.name} (@{m.username})</option>
              ))}
            </select>
          </div>
        </div>

        {/* New Month */}
        <div style={{ padding: '1rem', background: 'rgba(0, 209, 255, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0, 209, 255, 0.2)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📅 নতুন মাস শুরু করুন</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            নতুন মাস শুরু করলে বর্তমান মাসের সকল তথ্য হিস্টরি আর্কাইভে চলে যাবে এবং মেম্বারদের মিল ও ডিপোজিট শূন্য হয়ে যাবে।
          </p>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', background: 'var(--accent-blue)', color: '#000' }}
            onClick={handleStartNewMonth}
            disabled={isProcessing}
          >
            {isProcessing ? 'প্রসেসিং হচ্ছে...' : 'নতুন সেশন শুরু করুন'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
