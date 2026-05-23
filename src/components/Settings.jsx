import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, writeBatch, query, where, getDocs, addDoc } from '../utils/firebase';
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
          current_balance: 0
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
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="card glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>⚙️ সিস্টেম সেটিংস</h2>

        {/* New Month */}
        <div style={{ padding: '1rem', background: 'rgba(0, 209, 255, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0, 209, 255, 0.2)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-blue)' }}>📅 নতুন মাস শুরু করুন</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            নতুন মাস শুরু করলে বর্তমান মাসের সকল তথ্য হিস্টরি আর্কাইভে চলে যাবে এবং মেম্বারদের মিল ও ডিপোজিট শূন্য হয়ে যাবে।
          </p>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', background: 'var(--accent-blue)', color: '#000', padding: '0.875rem' }}
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
