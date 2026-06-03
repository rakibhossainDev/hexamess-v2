import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, writeBatch, query, where, getDocs, addDoc } from '../utils/firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

// Helper to convert DD-MM-YYYY or Timestamps to YYYY-MM-DD for comparison
const convertToIso = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal !== 'string') {
    if (dateVal.toDate && typeof dateVal.toDate === 'function') {
      return dateVal.toDate().toISOString().split('T')[0];
    }
    if (dateVal instanceof Date) {
      return dateVal.toISOString().split('T')[0];
    }
    return '';
  }
  if (dateVal.includes('-') && dateVal.split('-')[0].length === 2) {
    const [d, m, y] = dateVal.split('-');
    return `${y}-${m}-${d}`;
  }
  return dateVal;
};

const Settings = () => {
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [endDate, setEndDate] = useState('');
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
    try {
      if (!config) {
        alert("সিস্টেম কনফিগারেশন লোড হয়নি। দয়া করে পেজটি রিফ্রেশ করুন।");
        return;
      }
      if (!endDate) {
        showToast('দয়া করে সেশন শেষের তারিখ নির্বাচন করুন।', 'error');
        return;
      }
      const newMonthName = window.prompt("নতুন সেশনের নাম দিন (যেমন: May 2024):");
      if (!newMonthName) return;

      if (!window.confirm("আপনি কি নিশ্চিত? এই তারিখ পর্যন্ত সকল তথ্য আর্কাইভে যাবে।")) {
        return;
      }

      setIsProcessing(true);
      
      // 1. Fetch ALL current data
      const [mealSnap, expSnap, fixedSnap, depSnap] = await Promise.all([
        getDocs(collection(db, 'daily_meals')),
        getDocs(collection(db, 'bazar_records')),
        getDocs(collection(db, 'fixed_expenses')),
        getDocs(collection(db, 'deposits'))
      ]);

      // Filter by end date (<= endDate)
      const meals = mealSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => convertToIso(m.date) <= endDate);
      const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => convertToIso(e.date || e.createdAt) <= endDate);
      const fixedCosts = fixedSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => convertToIso(f.date || endDate) <= endDate);
      const deposits = depSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => convertToIso(d.date || endDate) <= endDate);

      // Aggregation helpers for correct reporting
      const calcMemberMeals = (mId, uName) => meals.filter(m => m.memberId === mId || m.user_id === mId || m.memberId === uName || m.username === uName).reduce((s, m) => s + Number(m.count || 0), 0);
      const calcMemberDeposit = (mId, uName) => deposits.filter(d => d.memberId === mId || d.user_id === mId || d.memberId === uName || d.username === uName).reduce((s, d) => s + Number(d.amount || 0), 0);

      // Calculate Summaries strictly from filtered arrays
      const totalMealsCount = meals.reduce((s, m) => s + Number(m.count || 0), 0);
      const totalMarket = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const totalFixed = fixedCosts.reduce((s, f) => s + Number(f.amount || 0), 0);
      const mealRate = totalMealsCount === 0 ? 0 : (totalMarket / totalMealsCount).toFixed(2);
      
      const activeMembers = members.filter(m => m.status === 'active' || calcMemberMeals(m.id, m.username) > 0);
      const perMemberFixed = activeMembers.length > 0 ? (totalFixed / activeMembers.length).toFixed(2) : 0;

      // Calculate Per Member Breakdown
      const memberBreakdown = activeMembers.map(m => {
        const mMeals = calcMemberMeals(m.id, m.username);
        const mDeposit = calcMemberDeposit(m.id, m.username);
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
        month_id: sessionDocId, 
        session_name: sessionDocId,
        month_name: sessionDocId,
        end_date: endDate,
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
      
      // Reset members intelligently (subtract only what we archived)
      members.forEach(m => {
        const archivedMeals = calcMemberMeals(m.id, m.username);
        const archivedDeposit = calcMemberDeposit(m.id, m.username);
        const lifetime = (Number(m.lifetime_meals) || 0) + archivedMeals;
        
        batch.update(doc(db, 'users', m.id), {
          total_meals: Math.max(0, (Number(m.total_meals) || 0) - archivedMeals),
          total_deposit: Math.max(0, (Number(m.total_deposit) || 0) - archivedDeposit),
          lifetime_meals: lifetime
        });
      });

      // Delete only the documents we archived!
      const deleteDocs = (docsList, colName) => {
        docsList.forEach(d => {
          batch.delete(doc(db, colName, d.id));
        });
      };
      
      deleteDocs(meals, 'daily_meals');
      deleteDocs(expenses, 'bazar_records');
      deleteDocs(fixedCosts, 'fixed_expenses');
      deleteDocs(deposits, 'deposits');

      // 4. Update config with new session details
      const newMonthId = newMonthName.toLowerCase().replace(/ /g, '_');
      batch.update(doc(db, 'config', 'settings'), {
        current_month_id: newMonthId,
        last_reset: new Date().toISOString(),
        last_reset_date: endDate
      });

      await batch.commit();
      showToast('নতুন সেশন সফলভাবে শুরু হয়েছে! পুরাতন ডেটা ডিলিট এবং আর্কাইভ করা হয়েছে।', 'success');
      setEndDate('');
    } catch (err) {
      console.error('New session error details:', err);
      alert(`অপারেশনটি ব্যর্থ হয়েছে। ত্রুটি: ${err.message}`);
      showToast('অপারেশন ব্যর্থ হয়েছে।', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="card glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>⚙️ সিস্টেম সেটিংস</h2>

        {/* New Session */}
        <div style={{ padding: '1.5rem', background: 'rgba(0, 209, 255, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0, 209, 255, 0.2)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent-blue)' }}>📅 নতুন সেশন শুরু করুন</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            সেশন শেষের তারিখ নির্বাচন করুন। শুধুমাত্র এই তারিখ এবং এর আগের সকল ডেটা হিস্টরি আর্কাইভে চলে যাবে এবং ড্যাশবোর্ড থেকে মুছে যাবে। নতুন ডেটা অক্ষত থাকবে।
          </p>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>সেশন শেষের তারিখ নির্ধারণ করুন:</label>
            <input 
              type="date" 
              className="form-control" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', maxWidth: '300px' }}
            />
          </div>

          <button 
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              background: (!endDate || isProcessing) ? 'var(--surface-hover)' : 'var(--accent-blue)', 
              color: (!endDate || isProcessing) ? 'var(--text-secondary)' : '#000', 
              padding: '0.875rem',
              cursor: (!endDate || isProcessing) ? 'not-allowed' : 'pointer'
            }}
            onClick={handleStartNewMonth}
            disabled={!endDate || isProcessing}
          >
            {isProcessing ? 'প্রসেসিং হচ্ছে...' : 'নতুন সেশন শুরু করুন'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
