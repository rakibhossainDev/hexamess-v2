import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, increment, query, where } from '../firebase';
import { getTodayDateString } from '../utils/monthUtils';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { saveMealEntry } from '../utils/firebase';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const [successId, setSuccessId] = useState(null);
  const [mealsLoading, setMealsLoading] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  const MEAL_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

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

  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    setMealsLoading(true);
    
    const unsubDaily = onSnapshot(query(collection(db, 'daily_meals'), where('month_id', '==', mid), where('date', '==', selectedDate)), snap => {
      const mealsMap = {};
      snap.docs.forEach(d => { 
        const data = d.data(); 
        mealsMap[data.user_id] = { docId: d.id, ...data }; 
      });
      setTodayMeals(mealsMap);
      setMealsLoading(false);
    }, (err) => {
      console.error("Daily meals fetch error:", err);
      setMealsLoading(false);
    });

    const unsubMonth = onSnapshot(query(collection(db, 'daily_meals'), where('month_id', '==', mid)), snap => {
      const total = snap.docs.reduce((s, d) => s + (Number(d.data().total) || 0), 0);
      setMonthTotalMeals(total);
    });

    return () => { unsubDaily(); unsubMonth(); };
  }, [config, selectedDate]);

  const handleSaveMeal = async (userId) => {
    if (!config) return;
    setSavingId(userId);
    
    const meal = todayMeals[userId] || { breakfast: 0, lunch: 0, dinner: 0 };
    const prevTotal = Number(meal.total) || 0;

    try {
      await saveMealEntry(
        config,
        selectedDate,
        userId,
        meal.breakfast,
        meal.lunch,
        meal.dinner,
        prevTotal
      );
      
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

  const handleInputChange = (userId, type, val) => {
    const numVal = parseFloat(val) || 0;
    setTodayMeals(prev => {
      const updatedUserMeals = {
        ...(prev[userId] || { breakfast: 0, lunch: 0, dinner: 0 }),
        [type]: numVal
      };
      
      // Real-time total calculation for the row
      updatedUserMeals.total = updatedUserMeals.breakfast + updatedUserMeals.lunch + updatedUserMeals.dinner;

      return {
        ...prev,
        [userId]: updatedUserMeals
      };
    });
  };

  const grandTotalToday = Object.values(todayMeals).reduce((s, m) => s + (Number(m.total) || 0), 0);
  
  // Calculate column totals
  const breakfastTotal = Object.values(todayMeals).reduce((s, m) => s + (Number(m.breakfast) || 0), 0);
  const lunchTotal = Object.values(todayMeals).reduce((s, m) => s + (Number(m.lunch) || 0), 0);
  const dinnerTotal = Object.values(todayMeals).reduce((s, m) => s + (Number(m.dinner) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Summaries Header */}
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
                  <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.85rem', width: '25%' }}>মেম্বার নাম</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.85rem', width: '15%' }}>সকাল</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.85rem', width: '15%' }}>দুপুর</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.85rem', width: '15%' }}>রাত</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.85rem', width: '30%' }}>অ্যাকশন / মোট</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const meal = todayMeals[m.id] || { breakfast: 0, lunch: 0, dinner: 0 };
                  const rowTotal = (Number(meal.breakfast) || 0) + (Number(meal.lunch) || 0) + (Number(meal.dinner) || 0);
                  const isSaving = savingId === m.id;

                  return (
                    <tr key={m.id} className="member-row">
                      <td style={{ padding: '1rem', borderRadius: '12px 0 0 12px', border: '1px solid var(--border-color)', borderRight: 'none' }}>
                        <div style={{ fontWeight: '700', fontSize: '1rem' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>@{m.username}</div>
                      </td>
                      <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <select 
                          className="meal-select"
                          value={meal.breakfast} 
                          onChange={(e) => handleInputChange(m.id, 'breakfast', e.target.value)}
                        >
                          {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <select 
                          className="meal-select"
                          value={meal.lunch} 
                          onChange={(e) => handleInputChange(m.id, 'lunch', e.target.value)}
                        >
                          {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <select 
                          className="meal-select"
                          value={meal.dinner} 
                          onChange={(e) => handleInputChange(m.id, 'dinner', e.target.value)}
                        >
                          {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem', borderRadius: '0 12px 12px 0', border: '1px solid var(--border-color)', borderLeft: 'none', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem' }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{rowTotal}</span>
                          <button 
                            className="btn" 
                            disabled={isSaving}
                            style={{ 
                              padding: '0.6rem 1.2rem', 
                              fontSize: '0.9rem', 
                              fontWeight: '700',
                              background: successId === m.id 
                                ? 'linear-gradient(135deg, #00ff88, #00cc66)' 
                                : 'linear-gradient(135deg, #00d1ff, #0088ff)',
                              color: successId === m.id ? '#fff' : '#000',
                              border: 'none',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'all 0.3s ease',
                              boxShadow: successId === m.id 
                                ? '0 4px 15px rgba(0, 255, 136, 0.3)' 
                                : '0 4px 15px rgba(0, 209, 255, 0.3)',
                              minWidth: '95px',
                              justifyContent: 'center'
                            }} 
                            onMouseOver={(e) => !isSaving && (e.currentTarget.style.transform = 'translateY(-2px)')}
                            onMouseOut={(e) => !isSaving && (e.currentTarget.style.transform = 'translateY(0)')}
                            onClick={() => handleSaveMeal(m.id)}
                          >
                            {isSaving ? (
                              <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #000', borderTopColor: 'transparent' }}></div>
                            ) : successId === m.id ? (
                              <><span>✓</span> সফল</>
                            ) : (
                              <><span>💾</span> সেভ</>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(0, 209, 255, 0.05)' }}>
                  <td style={{ padding: '1.25rem', borderRadius: '12px 0 0 12px', border: '1px solid var(--border-color)', borderRight: 'none', fontWeight: '800' }}>আজকের মোট হিসেব:</td>
                  <td style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontWeight: '800', fontSize: '1.2rem', color: 'var(--accent-blue)' }}>{breakfastTotal}</td>
                  <td style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontWeight: '800', fontSize: '1.2rem', color: 'var(--accent-blue)' }}>{lunchTotal}</td>
                  <td style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontWeight: '800', fontSize: '1.2rem', color: 'var(--accent-blue)' }}>{dinnerTotal}</td>
                  <td style={{ padding: '1.25rem', borderRadius: '0 12px 12px 0', border: '1px solid var(--border-color)', borderLeft: 'none', textAlign: 'right', fontWeight: '900', fontSize: '1.5rem', color: 'var(--accent-blue)' }}>{grandTotalToday}</td>
                </tr>
              </tfoot>
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
          background: var(--surface-hover) !important;
          transform: scale(1.002);
        }
        .meal-select {
          width: 70px;
          padding: 0.5rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-color);
          color: var(--text-primary);
          font-weight: 700;
          font-size: 1rem;
          text-align: center;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }
        .meal-select:focus {
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 2px rgba(0, 209, 255, 0.2);
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
        .table-container::-webkit-scrollbar {
          height: 8px;
        }
        .table-container::-webkit-scrollbar-track {
          background: var(--bg-color);
        }
        .table-container::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 4px;
        }
        .form-control:focus {
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 2px rgba(0, 209, 255, 0.2);
          outline: none;
        }
      `}} />
    </div>
  );
};

export default MealManagement;
