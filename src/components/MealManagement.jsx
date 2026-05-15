import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  db, collection, doc, onSnapshot, query, where, writeBatch, setDoc, serverTimestamp, getDocs
} from '../firebase';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [inputMeals, setInputMeals] = useState({}); 
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toasts, showToast, removeToast } = useToast();

  // Unified Date Format: DD-MM-YYYY (Source of truth for IDs)
  const docIdDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-');
    return `${d}-${m}-${y}`;
  }, [selectedDate]);

  // 3. Persistence: Fetch saved meals for selected date
  const fetchSavedMeals = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    
    // Safety timeout for loading state
    const timeout = setTimeout(() => setLoading(false), 5000);

    try {
      const q = query(collection(db, 'daily_meals'), where('date', '==', docIdDate));
      const snap = await getDocs(q);
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.memberId) mealsMap[data.memberId] = Number(data.count) || 0;
      });
      
      console.log(`Fetched ${snap.size} meal records for ${docIdDate}`);
      setInputMeals(mealsMap);
      clearTimeout(timeout);
    } catch (error) {
      console.error("Fetch Meals Error:", error);
    } finally {
      setLoading(false);
    }
  }, [docIdDate]);

  useEffect(() => {
    if (!db) return;
    const unsubMembers = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubConfig = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { unsubMembers(); unsubConfig(); };
  }, []);

  useEffect(() => {
    fetchSavedMeals();
  }, [fetchSavedMeals]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  
  const currentTotal = useMemo(() => {
    return Object.values(inputMeals).reduce((s, v) => s + v, 0);
  }, [inputMeals]);

  const handleMealChange = (memberId, value) => {
    setInputMeals(prev => ({ ...prev, [memberId]: Number(value) }));
  };

  // 1 & 2. Robust Batch Save & Sync System
  const handleSaveAll = async () => {
    if (!db || saving) return;
    
    // Non-blocking config check
    if (!config) {
      showToast("সিস্টেম কনফিগ লোড হচ্ছে, অনুগ্রহ করে একটু অপেক্ষা করুন।", "error");
      return;
    }

    setSaving(true);
    const batch = writeBatch(db);

    try {
      let totalSum = 0;

      activeMembers.forEach(member => {
        const count = Number(inputMeals[member.id] || 0);
        totalSum += count;

        const mealDocId = `meal_${member.id}_${docIdDate}`;
        const mealRef = doc(db, 'daily_meals', mealDocId);

        // Save individual member meal (Atomic Batch)
        batch.set(mealRef, {
          memberId: member.id,
          date: docIdDate,
          count: count,
          month_id: config.current_month_id,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      // 2. Dashboard Total Sync: Update 'meal_summaries'
      const summaryRef = doc(db, 'meal_summaries', docIdDate);
      batch.set(summaryRef, {
        date: docIdDate,
        totalMeals: Number(totalSum), // Type Safe Number
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      
      // 4. UI Feedback
      alert("সব মেম্বারের মিল সেভ হয়েছে, বস!");
      console.log(`Saved total ${totalSum} meals for ${docIdDate}`);
      
    } catch (error) {
      console.error("Meal Save Failure:", error); // Specific Firebase error logging
      showToast(`সেভ করতে সমস্যা হয়েছে: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>🍽️ মিল ম্যানেজমেন্ট (Robust Sync)</h2>
        <div className="form-group" style={{ margin: 0 }}>
          <input 
            type="date" 
            className="form-control" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            style={{ width: 'auto', background: '#111', color: '#fff', border: '1px solid #333' }}
          />
        </div>
      </div>

      <div className="card glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--accent-blue)' }}>মেম্বার তালিকা ({formatDisplayDate(selectedDate)})</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>প্রতি মেম্বারের মিল ড্রপডাউন থেকে সিলেক্ট করুন</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>ইনপুটকৃত মোট মিল</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-blue)' }}>{currentTotal} টি</div>
          </div>
        </div>

        {loading && activeMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
            লোড হচ্ছে...
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#000', color: '#888', fontSize: '0.9rem', textAlign: 'left' }}>
                  <th style={{ padding: '1rem' }}>সদস্য</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>মিল (০-৫)</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map(member => (
                  <tr key={member.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: '#fff' }}>{member.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>@{member.username}</div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <select 
                        className="form-control"
                        style={{ 
                          width: '85px', margin: '0 auto', background: '#000', color: '#fff', 
                          border: '1px solid #444', fontWeight: '800', textAlign: 'center'
                        }}
                        value={inputMeals[member.id] ?? 0}
                        onChange={(e) => handleMealChange(member.id, e.target.value)}
                      >
                        {[0, 1, 2, 3, 4, 5].map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary meal-save-btn"
            disabled={saving || loading || activeMembers.length === 0}
            onClick={handleSaveAll}
            style={{ 
              width: '100%', maxWidth: '320px', padding: '1.1rem', borderRadius: '12px', fontSize: '1rem', 
              fontWeight: '800', transition: 'all 0.15s ease', boxShadow: '0 4px 25px rgba(0,0,0,0.4)'
            }}
          >
            {saving ? 'সেভ হচ্ছে...' : '💾 আজকের সব মিল সেভ করুন'}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .meal-save-btn:active { transform: scale(0.96); }
        .meal-save-btn:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 6px 30px rgba(29, 78, 216, 0.3); }
        .glass-card { background: rgba(18, 18, 18, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); }
      `}} />
    </div>
  );
};

export default MealManagement;
