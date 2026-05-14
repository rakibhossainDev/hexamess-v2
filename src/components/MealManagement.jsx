import { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, increment, query, where } from '../utils/firebase';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';
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
  const [selectedDateISO, setSelectedDateISO] = useState(getTodayDateString());
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const { toasts, showToast, removeToast } = useToast();

  const MEAL_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  // Convert ISO (YYYY-MM-DD) to Slash format (DD/MM/YYYY)
  const slashDate = useMemo(() => {
    const [y, m, d] = selectedDateISO.split('-');
    return `${d}/${m}/${y}`;
  }, [selectedDateISO]);

  // Convert Slash format to ID format (DD_MM_YYYY)
  const dateIdSuffix = useMemo(() => {
    return slashDate.replace(/\//g, '_');
  }, [slashDate]);

  // 1. Fetch Members & Config
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

  // 2. Fetch Daily Meals on Date Change
  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    setMealsLoading(true);

    const unsubDaily = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('date', '==', slashDate)
    ), snap => {
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        mealsMap[data.user_id] = data;
      });
      setTodayMeals(mealsMap);
      setMealsLoading(false);
    }, (err) => {
      console.error("Fetch error:", err);
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
  }, [config, slashDate]);

  // 3. Save Logic
  const handleSaveMeal = async (userId, val) => {
    if (!config) return;
    setSavingId(userId);
    const numVal = Number(val) || 0;

    const existing = todayMeals[userId];
    const prevTotal = Number(existing?.total) || 0;
    const delta = numVal - prevTotal;

    // Document ID: memberId_DD_MM_YYYY
    const mealDocId = `${userId}_${dateIdSuffix}`;

    const data = {
      month_id: config.current_month_id,
      date: slashDate,
      user_id: userId,
      total: numVal,
      // Keep legacy fields for compatibility if needed
      breakfast: 0,
      lunch: numVal, 
      dinner: 0
    };

    try {
      await setDoc(doc(db, 'daily_meals', mealDocId), data, { merge: true });
      await updateDoc(doc(db, 'users', userId), {
        total_meals: increment(delta)
      });

      setSuccessId(userId);
      setTimeout(() => setSuccessId(null), 2000);
      showToast('মিল সফলভাবে সেভ হয়েছে!', 'success');
    } catch (err) {
      console.error("Save error:", err);
      showToast('সেভ ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const grandTotalToday = Object.values(todayMeals).reduce((s, m) => s + (Number(m.total) || 0), 0);

  return (
    <div className="meal-flow-container" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Header Section */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'linear-gradient(145deg, var(--surface-color), #1a1a1a)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '700', margin: 0, color: 'var(--accent-blue)' }}>🍽️ মিল ম্যানেজমেন্ট</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>এক ক্লিকে প্রতিদিনের মিল আপডেট করুন</p>
          </div>
          <div className="date-picker-wrapper">
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>তারিখ নির্বাচন করুন</label>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: '180px', fontWeight: '700' }}
              value={selectedDateISO}
              onChange={(e) => setSelectedDateISO(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        
        {/* Input List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>মেম্বার তালিকা ({members.length})</h3>
          </div>
          
          {(loading || mealsLoading) ? (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>ডেটা লোড হচ্ছে...</p>
            </div>
          ) : (
            <div className="member-list-scroll" style={{ maxHeight: '600px', overflowY: 'auto', padding: '0.5rem' }}>
              {members.map(m => {
                const meal = todayMeals[m.id] || { total: 0 };
                const isSaving = savingId === m.id;
                const isSuccess = successId === m.id;

                return (
                  <div key={m.id} className="member-meal-row">
                    <div className="member-info">
                      <div className="name">{m.name}</div>
                      <div className="username">@{m.username}</div>
                    </div>
                    
                    <div className="meal-input-group">
                      <select 
                        className="meal-dropdown"
                        value={meal.total}
                        onChange={(e) => handleSaveMeal(m.id, e.target.value)}
                        disabled={isSaving}
                        style={{
                          background: meal.total > 0 ? 'rgba(0, 209, 255, 0.1)' : 'var(--bg-color)',
                          borderColor: meal.total > 0 ? 'var(--accent-blue)' : 'var(--border-color)'
                        }}
                      >
                        {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      
                      <button 
                        className={`action-btn ${isSuccess ? 'success' : ''}`}
                        onClick={() => handleSaveMeal(m.id, meal.total)}
                        disabled={isSaving}
                      >
                        {isSaving ? <div className="spinner-sm"></div> : isSuccess ? 'সফল' : 'সেভ'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Real-time Summary & Preview Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card preview-card">
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--accent-blue)' }}>📊 আজকের সারসংক্ষেপ</h3>
            
            <div className="summary-item">
              <span>নির্বাচিত তারিখ:</span>
              <span className="value">{slashDate}</span>
            </div>
            <div className="summary-item main">
              <span>আজকের মোট মিল:</span>
              <span className="value big">{grandTotalToday}</span>
            </div>
            
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>মেম্বার ব্রেকডাউন</h4>
              <div className="breakdown-list">
                {members.slice(0, 5).map(m => (
                  <div key={m.id} className="breakdown-row">
                    <span>{m.name}</span>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <span style={{ color: 'var(--accent-blue)' }}>আজ: {todayMeals[m.id]?.total || 0}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>|</span>
                      <span style={{ color: 'var(--accent-orange)' }}>মাস: {m.total_meals || 0}</span>
                    </div>
                  </div>
                ))}
                {members.length > 5 && <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>...আরও {members.length - 5} জন মেম্বার</div>}
              </div>
            </div>
          </div>

          <div className="card" style={{ background: 'rgba(255, 150, 0, 0.05)', border: '1px solid rgba(255, 150, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>📈 লাইভ স্ট্যাটাস</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>এই মাসের মোট মিল:</span>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-orange)' }}>{monthTotalMeals}</span>
            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');
        
        .meal-flow-container {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .member-meal-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          margin-bottom: 0.5rem;
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          transition: all 0.2s ease;
        }

        .member-meal-row:hover {
          background: var(--surface-hover);
          border-color: var(--accent-blue);
          transform: translateX(4px);
        }

        .member-info .name {
          font-weight: 700;
          font-size: 1rem;
        }

        .member-info .username {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .meal-input-group {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .meal-dropdown {
          width: 80px;
          padding: 0.5rem;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          font-weight: 700;
          font-size: 1.1rem;
          text-align: center;
          cursor: pointer;
          outline: none;
        }

        .action-btn {
          padding: 0.5rem 1rem;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--accent-blue), #0088ff);
          color: #000;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          min-width: 70px;
        }

        .action-btn.success {
          background: var(--accent-green);
          color: #fff;
        }

        .preview-card .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
        }

        .summary-item.main {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(0, 209, 255, 0.05);
          border-radius: 12px;
        }

        .summary-item .value {
          font-weight: 700;
          color: var(--text-primary);
        }

        .summary-item .value.big {
          font-size: 2.5rem;
          color: var(--accent-blue);
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          padding: 0.4rem 0;
          font-size: 0.9rem;
          border-bottom: 1px dashed rgba(255,255,255,0.05);
        }

        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid rgba(0, 209, 255, 0.2);
          border-top-color: var(--accent-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: inline-block;
        }

        .spinner-sm {
          width: 16px;
          height: 16px;
          border: 2px solid #000;
          border-top-color: transparent;
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
