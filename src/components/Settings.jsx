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

    if (!window.confirm("আপনি কি নিশ্চিত? বর্তমান মাসের ডেটা ডিলিট হবে এবং নতুন মাস শুরু হবে।")) {
      return;
    }

    setIsProcessing(true);
    try {
      const cur = config.current_month_id;
      
      // 1. Fetch current data
      const [mealSnap, expSnap, fixedSnap, depSnap] = await Promise.all([
        getDocs(collection(db, 'daily_meals')),
        getDocs(collection(db, 'bazar_records')),
        getDocs(collection(db, 'fixed_expenses')),
        getDocs(collection(db, 'deposits'))
      ]);

      const meals = mealSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const fixedCosts = fixedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const deposits = depSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Calculate Summaries
      const totalMealsCount = members.reduce((s, m) => s + (Number(m.total_meals) || 0), 0);
      const totalMarket = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const totalFixed = fixedCosts.reduce((s, f) => s + (Number(f.amount) || 0), 0);
      const mealRate = totalMealsCount === 0 ? 0 : (totalMarket / totalMealsCount).toFixed(2);
      const perMemberFixed = members.length > 0 ? (totalFixed / members.length).toFixed(2) : 0;

      // Calculate Per Member Breakdown
      const memberBreakdown = members.map(m => {
        const mMeals = Number(m.total_meals) || 0;
        const mDeposit = Number(m.total_deposit) || 0;
        const mealCost = mMeals * Number(mealRate);
        const finalBalance = mDeposit - (mealCost + Number(perMemberFixed));
        
        return {
          id: m.id,
          name: m.name,
          deposit: mDeposit,
          meals: mMeals,
          meal_cost: Number(mealCost.toFixed(2)),
          fixed_cost: Number(perMemberFixed),
          final_balance: Number(finalBalance.toFixed(2))
        };
      });

      // 2. Save to `histories` collection (Document named after the custom session name)
      const { setDoc } = await import('../utils/firebase');
      const sessionDocId = newMonthName.trim();
      
      await setDoc(doc(db, 'histories', sessionDocId), {
        month_id: sessionDocId, // Store as month_id for backwards compatibility or as main ID
        session_name: sessionDocId,
        month_name: sessionDocId,
        total_market: totalMarket,
        total_fixed: totalFixed,
        total_meals: totalMealsCount,
        meal_rate: Number(mealRate),
        archived_at: new Date().toISOString(),
        members: memberBreakdown,
        expenses: expenses,
        fixed_costs: fixedCosts
      });

      // 3. Database Cleanup & Member Reset
      const batch = writeBatch(db);
      
      // Reset members
      members.forEach(m => {
        const lifetime = (Number(m.lifetime_meals) || 0) + (Number(m.total_meals) || 0);
        batch.update(doc(db, 'users', m.id), {
          total_meals: 0,
          total_deposit: 0,
          current_balance: 0,
          lifetime_meals: lifetime
        });
      });

      // Delete old records (up to batch limit, but usually fine for a month's data)
      const deleteDocs = (docsList, colName) => {
        docsList.forEach(d => {
          batch.delete(doc(db, colName, d.id));
        });
      };
      
      deleteDocs(meals, 'daily_meals');
      deleteDocs(expenses, 'bazar_records');
      deleteDocs(fixedCosts, 'fixed_expenses');
      deleteDocs(deposits, 'deposits');

      // 4. Update config with new month
      const newMonthId = newMonthName.toLowerCase().replace(' ', '_');
      batch.update(doc(db, 'config', 'settings'), {
        current_month_id: newMonthId,
        last_reset: new Date().toISOString()
      });

      await batch.commit();
      showToast('নতুন মাস সফলভাবে শুরু হয়েছে! পুরাতন ডেটা ডিলিট এবং আর্কাইভ করা হয়েছে।', 'success');
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
