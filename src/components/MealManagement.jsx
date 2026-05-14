import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, increment, query, where } from '../utils/firebase';
import { getTodayDateString } from '../utils/monthUtils';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [successId, setSuccessId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const { toasts, showToast, removeToast } = useToast();

  const MEAL_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  // 1. Initial Data Fetching (Members & Config)
  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // 2. Data Persistence (The Fix): Fetch whenever 'Selected Date' changes
  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    setMealsLoading(true);
    
    const unsubDaily = onSnapshot(query(
      collection(db, 'daily_meals'), 
      where('date', '==', selectedDate)
    ), snap => {
      const mealsMap = {};
      snap.docs.forEach(d => { 
        const data = d.data(); 
        mealsMap[data.user_id] = { ...data }; 
      });
      setTodayMeals(mealsMap);
      setMealsLoading(false);
    }, (err) => {
      console.error("Meal fetch error:", err);
      setMealsLoading(false);
    });

    const unsubMonth = onSnapshot(query(
      collection(db, 'daily_meals'), 
      where('month_id', '==', mid)
    ), snap => {
      const total = snap.docs.reduce((s, d) => s + (Number(d.data().total) || 0), 0);
      setMonthTotalMeals(total);
    });

    return () => { unsubDaily(); unsubMonth(); };
  }, [config, selectedDate]);

  const handleInputChange = (userId, type, val) => {
    const numVal = parseFloat(val) || 0;
    setTodayMeals(prev => {
      const current = prev[userId] || { breakfast: 0, lunch: 0, dinner: 0 };
      const updated = { ...current, [type]: numVal };
      updated.total = (Number(updated.breakfast) || 0) + (Number(updated.lunch) || 0) + (Number(updated.dinner) || 0);
      return { ...prev, [userId]: updated };
    });
  };

  // 3. Save Logic (Force Save)
  const handleSaveMeal = async (userId) => {
    if (!config) return;
    setSavingId(userId);

    const meal = todayMeals[userId] || { breakfast: 0, lunch: 0, dinner: 0 };
    const b = Number(meal.breakfast) || 0;
    const l = Number(meal.lunch) || 0;
    const d = Number(meal.dinner) || 0;
    const total = Number(b + l + d);

    // Calculate delta for user's aggregate total_meals
    const existing = todayMeals[userId];
    const prevTotal = Number(existing?.total) || 0;
    const delta = total - prevTotal;

    const data = {
      month_id: config.current_month_id,
      date: selectedDate,
      user_id: userId,
      breakfast: b,
      lunch: l,
      dinner: d,
      total: total
    };

    // Document ID format: "${selectedDate}_${userId}"
    const mealDocId = `${selectedDate}_${userId}`;

    try {
      // Force Save with merge: true
      await setDoc(doc(db, 'daily_meals', mealDocId), data, { merge: true });
      
      // Update member's total meals count
      await updateDoc(doc(db, 'users', userId), { 
        total_meals: increment(delta) 
      });

      console.log("Data Saved:", data);
      setSuccessId(userId);
      setTimeout(() => setSuccessId(null), 2000);
      showToast('সফলভাবে সেভ হয়েছে!', 'success');
    } catch (err) {
      console.error('Meal save error:', err);
      showToast('সেভ ব্যর্থ।', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const grandTotalToday = Object.values(todayMeals).reduce((s, m) => s + (Number(m.total) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ textAlign: 'center', background: 'rgba(0, 209, 255, 0.05)', border: '1px solid rgba(0, 209, 255, 0.1)', padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>আজকের মোট মিল</p>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent-blue)', margin: 0 }}>{grandTotalToday}</p>
        </div>
        <div className="card" style={{ textAlign: 'center', background: 'rgba(255, 150, 0, 0.05)', border: '1px solid rgba(255, 150, 0, 0.1)', padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>এই মাসের মোট মিল</p>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent-orange)', margin: 0 }}>{monthTotalMeals}</p>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>🍽️ মিল ম্যানেজমেন্ট</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>সদস্যদের প্রতিদিনের মিল ইনপুট দিন</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '600' }}>তারিখ:</label>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: 'auto', background: 'transparent', border: 'none', padding: 0, color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }} 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
            />
          </div>
        </div>

        {(loading || mealsLoading) ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>লোড হচ্ছে...</p>
          </div>
        ) : (
          <div className="table-container" style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', width: '30%' }}>মেম্বার নাম</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>সকাল</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>দুপুর</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>রাত</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>অ্যাকশন / মোট</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const meal = todayMeals[m.id] || { breakfast: 0, lunch: 0, dinner: 0 };
                  const rowTotal = Number(meal.total) || 0;
                  const isSaving = savingId === m.id;

                  return (
                    <tr key={m.id} className="member-row">
                      <td style={{ padding: '1rem', borderRadius: '12px 0 0 12px', border: '1px solid var(--border-color)', borderRight: 'none' }}>
                        <div style={{ fontWeight: '700' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{m.username}</div>
                      </td>
                      <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <select 
                          className="meal-select"
                          value={meal.breakfast || 0} 
                          onChange={(e) => handleInputChange(m.id, 'breakfast', e.target.value)}
                        >
                          {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <select 
                          className="meal-select"
                          value={meal.lunch || 0} 
                          onChange={(e) => handleInputChange(m.id, 'lunch', e.target.value)}
                        >
                          {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <select 
                          className="meal-select"
                          value={meal.dinner || 0} 
                          onChange={(e) => handleInputChange(m.id, 'dinner', e.target.value)}
                        >
                          {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem', borderRadius: '0 12px 12px 0', border: '1px solid var(--border-color)', borderLeft: 'none', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{rowTotal}</span>
                          <button 
                            className="btn" 
                            disabled={isSaving}
                            style={{ 
                              padding: '0.5rem 1rem', 
                              background: successId === m.id 
                                ? 'var(--accent-green)' 
                                : 'linear-gradient(135deg, #00d1ff, #0088ff)',
                              color: successId === m.id ? '#fff' : '#000',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              minWidth: '85px',
                              fontWeight: '700',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem'
                            }} 
                            onClick={() => handleSaveMeal(m.id)}
                          >
                            {isSaving ? (
                              <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid #000', borderTopColor: 'transparent' }}></div>
                            ) : successId === m.id ? 'সফল' : 'সেভ'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .member-row {
          background: var(--surface-color);
          transition: all 0.2s ease;
        }
        .member-row:hover {
          background: var(--surface-hover);
        }
        .meal-select {
          width: 65px;
          padding: 0.4rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-color);
          color: var(--text-primary);
          font-weight: 700;
          cursor: pointer;
          text-align: center;
        }
        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(0, 209, 255, 0.3);
          border-top-color: var(--accent-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
};

export default MealManagement;
