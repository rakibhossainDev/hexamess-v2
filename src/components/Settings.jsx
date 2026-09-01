import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, writeBatch, getDocs } from '../utils/firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

// Helper to convert any date format into a standard JS Date object for safe comparison
const getSafeDate = (dateVal) => {
  if (!dateVal) return new Date(0); // Epoch if missing
  
  if (typeof dateVal === 'string') {
    // Check if it's DD-MM-YYYY format
    if (dateVal.includes('-') && dateVal.split('-')[0].length === 2) {
      const [d, m, y] = dateVal.split('-');
      return new Date(`${y}-${m}-${d}T00:00:00`);
    }
    // Assume YYYY-MM-DD or standard parseable string
    return new Date(dateVal);
  }
  
  // If it's a Firestore Timestamp
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    return dateVal.toDate();
  }
  
  if (dateVal instanceof Date) {
    return dateVal;
  }
  
  return new Date(0);
};

const Settings = () => {
  const [members, setMembers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [sessionNameToArchive, setSessionNameToArchive] = useState('');
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub(); };
  }, []);

  const initiateArchive = () => {
    if (!endDate) {
      showToast('দয়া করে সেশন শেষের তারিখ নির্বাচন করুন।', 'error');
      return;
    }
    const newMonthName = window.prompt("নতুন সেশনের নাম দিন (যেমন: May 2024):");
    if (!newMonthName) return;

    setSessionNameToArchive(newMonthName);
    setConfirmText('');
    setShowConfirmModal(true);
  };

  const handleStartNewMonth = async () => {
    try {
      setShowConfirmModal(false);
      setIsProcessing(true);
      const newMonthName = sessionNameToArchive;
      
      // 1. Fetch ALL current data FIRST without complex where() queries
      const [mealSnap, expSnap, fixedSnap, depSnap] = await Promise.all([
        getDocs(collection(db, 'daily_meals')),
        getDocs(collection(db, 'bazar_records')),
        getDocs(collection(db, 'fixed_expenses')),
        getDocs(collection(db, 'deposits'))
      ]);

      const endDateTime = new Date(endDate).getTime();

      // 2. Filter them in JavaScript using standard Date object comparisons
      const meals = mealSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => getSafeDate(m.date).getTime() <= endDateTime);
        
      const expenses = expSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => getSafeDate(e.date || e.createdAt).getTime() <= endDateTime);
        
      const fixedCosts = fixedSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(f => getSafeDate(f.date || endDate).getTime() <= endDateTime);
        
      const deposits = depSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => getSafeDate(d.date || endDate).getTime() <= endDateTime);

      // Aggregation helpers for correct reporting (defaulting to 0)
      const calcMemberMeals = (mId, uName) => meals.filter(m => m.memberId === mId || m.user_id === mId || m.memberId === uName || m.username === uName).reduce((s, m) => s + Number(m.count || 0), 0);
      const calcMemberDeposit = (mId, uName) => deposits.filter(d => d.memberId === mId || d.user_id === mId || d.memberId === uName || d.username === uName).reduce((s, d) => s + Number(d.amount || 0), 0);

      // 3. Calculate Summaries safely defaulting to 0
      const totalMealsCount = meals.reduce((s, m) => s + Number(m.count || 0), 0);
      const totalMarket = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const totalFixed = fixedCosts.reduce((s, f) => s + Number(f.amount || 0), 0);
      const mealRate = totalMealsCount === 0 ? 0 : (totalMarket / totalMealsCount).toFixed(2);
      
      const activeMembers = members.filter(m => m.status === 'active' || calcMemberMeals(m.id, m.username) > 0);

      // Calculate Per Member Breakdown
      const memberBreakdown = activeMembers.map(m => {
        const mMeals = calcMemberMeals(m.id, m.username);
        const mDeposit = calcMemberDeposit(m.id, m.username);
        const mFixedCost = Number(m.total_fixed_cost) || 0;
        const mealCost = mMeals * Number(mealRate);
        const finalBalance = mDeposit - (mealCost + mFixedCost);
        
        return {
          id: m.id,
          name: m.name,
          deposit: mDeposit,
          meals: mMeals,
          meal_cost: Number(mealCost.toFixed(2)),
          fixed_cost: Number(mFixedCost.toFixed(2)),
          final_balance: Number(finalBalance.toFixed(2))
        };
      });

      // 4. Save to `histories` collection
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
        fixed_costs: fixedCosts,
        meals: meals,
        deposits: deposits
      });

      // 5. Database Cleanup & Member Reset
      const batch = writeBatch(db);
      
      // Reset members intelligently
      members.forEach(m => {
        const archivedMeals = calcMemberMeals(m.id, m.username);
        const archivedDeposit = calcMemberDeposit(m.id, m.username);
        const lifetime = (Number(m.lifetime_meals) || 0) + archivedMeals;
        
        batch.update(doc(db, 'users', m.id), {
          total_meals: Math.max(0, (Number(m.total_meals) || 0) - archivedMeals),
          total_deposit: Math.max(0, (Number(m.total_deposit) || 0) - archivedDeposit),
          total_fixed_cost: 0,
          lifetime_meals: lifetime
        });
      });

      // Delete ONLY the documents we archived
      const deleteDocs = (docsList, colName) => {
        docsList.forEach(d => {
          batch.delete(doc(db, colName, d.id));
        });
      };
      
      deleteDocs(meals, 'daily_meals');
      deleteDocs(expenses, 'bazar_records');
      deleteDocs(fixedCosts, 'fixed_expenses');
      deleteDocs(deposits, 'deposits');

      // 6. Update config (using setDoc with merge to prevent crashes if config doesn't exist)
      const newMonthId = newMonthName.toLowerCase().replace(/ /g, '_');
      batch.set(doc(db, 'config', 'settings'), {
        current_month_id: newMonthId,
        last_reset: new Date().toISOString(),
        last_reset_date: endDate
      }, { merge: true });

      await batch.commit();
      
      showToast('নতুন সেশন সফলভাবে শুরু হয়েছে!', 'success');
      setEndDate('');
      
    } catch (error) {
      // Expose the Real Error as requested
      console.error("Session Archive Error:", error);
      alert("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="card glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>⚙️ সিস্টেম সেটিংস</h2>

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
            onClick={initiateArchive}
            disabled={!endDate || isProcessing}
          >
            {isProcessing ? 'প্রসেসিং হচ্ছে...' : 'নতুন সেশন শুরু করুন'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div className="card glass-card" style={{ maxWidth: '400px', width: '90%', padding: '2rem' }}>
            <h3 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>⚠️ চূড়ান্ত সতর্কতা</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              আপনি <strong>{sessionNameToArchive}</strong> সেশন আর্কাইভে স্থানান্তর করতে যাচ্ছেন। নিশ্চিত করতে নিচের বক্সে <strong>CONFIRM</strong> টাইপ করুন।
            </p>
            <input 
              type="text" 
              className="form-control" 
              placeholder="CONFIRM টাইপ করুন"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{ width: '100%', marginBottom: '1.5rem', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '0.75rem', background: 'var(--surface-hover)', color: 'var(--text-primary)' }}
                onClick={() => setShowConfirmModal(false)}
              >
                বাতিল
              </button>
              <button 
                className="btn btn-primary" 
                style={{ 
                  flex: 1, padding: '0.75rem', 
                  background: confirmText === 'CONFIRM' ? 'var(--accent-red)' : 'var(--surface-hover)', 
                  color: confirmText === 'CONFIRM' ? '#fff' : 'var(--text-secondary)',
                  cursor: confirmText === 'CONFIRM' ? 'pointer' : 'not-allowed'
                }}
                onClick={handleStartNewMonth}
                disabled={confirmText !== 'CONFIRM'}
              >
                নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
