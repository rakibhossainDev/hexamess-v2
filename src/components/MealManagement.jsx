import { useState, useEffect, useMemo } from 'react';
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
  const [selectedDateISO, setSelectedDateISO] = useState(getTodayDateString());
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const { toasts, showToast, removeToast } = useToast();

  // Range: 0 to 10 in 0.5 increments
  const MEAL_OPTIONS = useMemo(() => {
    const options = [];
    for (let i = 0; i <= 10; i += 0.5) options.push(i);
    return options;
  }, []);

  // Format YYYY-MM-DD to DD/MM/YYYY for display and ID
  const slashDate = useMemo(() => {
    const [y, m, d] = selectedDateISO.split('-');
    return `${d}/${m}/${y}`;
  }, [selectedDateISO]);

  const dateIdFormat = useMemo(() => slashDate.replace(/\//g, '_'), [slashDate]);

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

  // 2. Data Fetching: Sync with Firestore whenever Date changes
  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    setMealsLoading(true);

    // Fetch meals for the selected date
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

    // Fetch month total for the header
    const unsubMonth = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('month_id', '==', mid)
    ), snap => {
      const total = snap.docs.reduce((s, d) => s + (Number(d.data().total) || 0), 0);
      setMonthTotalMeals(total);
    });

    return () => { unsubDaily(); unsubMonth(); };
  }, [config, slashDate]);

  // 3. Core Logic & Save
  const handleSaveMeal = async (userId, val) => {
    if (!config) return;
    setSavingId(userId);
    const numVal = Number(val) || 0;

    const existing = todayMeals[userId];
    const prevTotal = Number(existing?.total) || 0;
    const delta = numVal - prevTotal;

    // Unique document ID: meal_DD_MM_YYYY_memberId
    const mealDocId = `meal_${dateIdFormat}_${userId}`;
    const member = members.find(m => m.id === userId);

    const data = {
      month_id: config.current_month_id,
      date: slashDate,
      user_id: userId,
      total: numVal,
      // Compatibility fields
      breakfast: 0, lunch: numVal, dinner: 0
    };

    try {
      await setDoc(doc(db, 'daily_meals', mealDocId), data, { merge: true });
      await updateDoc(doc(db, 'users', userId), {
        total_meals: increment(delta)
      });

      setSuccessId(userId);
      setTimeout(() => setSuccessId(null), 3000);
      showToast(`সফল! ${member?.name}-এর আজকের মিল সেভ করা হয়েছে।`, 'success');
    } catch (err) {
      console.error("Save error:", err);
      showToast('সেভ ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const grandTotalToday = Object.values(todayMeals).reduce((s, m) => s + (Number(m.total) || 0), 0);

  return (
    <div className="advanced-meal-management" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Date & Global Stats Header */}
      <div className="card header-card" style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid var(--border-color)', background: 'linear-gradient(135deg, var(--surface-color), #1e1e1e)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0, color: 'var(--accent-blue)', letterSpacing: '-0.5px' }}>🍽️ মিল ম্যানেজমেন্ট সিস্টেম</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.95rem' }}>সদস্যদের প্রতিদিনের মিল নির্ভুলভাবে রেকর্ড করুন</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>সিলেক্টেড তারিখ</span>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-orange)' }}>{slashDate}</div>
            </div>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: 'auto', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.4rem 0.8rem' }}
              value={selectedDateISO}
              onChange={(e) => setSelectedDateISO(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="main-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
        
        {/* Left Side: Entry List */}
        <div className="entry-section">
          <div className="card list-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>সদস্য তালিকা</h3>
              <span className="badge" style={{ background: 'var(--accent-blue)', color: '#000', fontWeight: '700', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem' }}>{members.length} জন</span>
            </div>
            
            {(loading || mealsLoading) ? (
              <div style={{ padding: '5rem', textAlign: 'center' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>ডেটা লোড হচ্ছে...</p>
              </div>
            ) : (
              <div className="scroll-area" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1rem' }}>
                {members.map(m => {
                  const meal = todayMeals[m.id] || { total: 0 };
                  const isSaving = savingId === m.id;
                  const isSuccess = successId === m.id;

                  return (
                    <div key={m.id} className="member-entry-card">
                      <div className="member-id-info">
                        <div className="avatar" style={{ background: `linear-gradient(135deg, ${m.role === 'manager' ? '#ff9500' : '#00d1ff'}, #0044ff)` }}>
                          {m.name.charAt(0)}
                        </div>
                        <div className="details">
                          <span className="name">{m.name}</span>
                          <span className="username">@{m.username}</span>
                        </div>
                      </div>
                      
                      <div className="entry-controls">
                        <div className="input-wrapper">
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>কয়টা মিল</label>
                          <select 
                            className="advanced-select"
                            value={meal.total}
                            onChange={(e) => handleSaveMeal(m.id, e.target.value)}
                            disabled={isSaving}
                            style={{
                              borderColor: meal.total > 0 ? 'var(--accent-blue)' : 'var(--border-color)',
                              color: meal.total > 0 ? 'var(--accent-blue)' : 'var(--text-primary)',
                              background: meal.total > 0 ? 'rgba(0, 209, 255, 0.05)' : 'var(--bg-color)'
                            }}
                          >
                            {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                        
                        <button 
                          className={`save-btn ${isSuccess ? 'success' : ''}`}
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
        </div>

        {/* Right Side: Detailed Preview Sidebar */}
        <div className="preview-section" style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
          <div className="card preview-card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderTop: '4px solid var(--accent-blue)' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '800' }}>📊 আজকের প্রিভিউ</h3>
            
            <div className="stats-box">
              <div className="stat-row">
                <span style={{ color: 'var(--text-secondary)' }}>নির্বাচিত তারিখ:</span>
                <span style={{ fontWeight: '700' }}>{slashDate}</span>
              </div>
              <div className="stat-row main">
                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>আজকের মোট মিল:</span>
                <span style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent-blue)' }}>{grandTotalToday}</span>
              </div>
            </div>

            <div className="breakdown-section" style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>মেম্বার ব্রেকডাউন</h4>
                <span style={{ fontSize: '0.75rem', background: 'rgba(255,150,0,0.1)', color: 'var(--accent-orange)', padding: '2px 8px', borderRadius: '4px' }}>লাইভ স্ট্যাটাস</span>
              </div>
              
              <div className="breakdown-list">
                {members.map(m => (
                  <div key={m.id} className="breakdown-item">
                    <div className="name-box">
                      <span className="dot" style={{ background: (todayMeals[m.id]?.total > 0) ? 'var(--accent-green)' : 'var(--border-color)' }}></span>
                      <span className="m-name">{m.name}</span>
                    </div>
                    <div className="val-box">
                      <span className="today-val">আজ: <b>{todayMeals[m.id]?.total || 0}</b></span>
                      <span className="month-val">মাস: {m.total_meals || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="footer-stats" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>এই মাসের মোট মিল:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-orange)' }}>{monthTotalMeals}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');
        
        .advanced-meal-management {
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .member-entry-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: var(--surface-color);
          border-radius: 16px;
          margin-bottom: 0.75rem;
          border: 1px solid var(--border-color);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .member-entry-card:hover {
          transform: translateY(-2px) scale(1.01);
          border-color: var(--accent-blue);
          box-shadow: 0 10px 30px rgba(0, 209, 255, 0.1);
        }

        .member-id-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .member-id-info .avatar {
          width: 45px;
          height: 45px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          font-weight: 800;
          font-size: 1.25rem;
        }

        .member-id-info .details {
          display: flex;
          flex-direction: column;
        }

        .details .name {
          font-weight: 700;
          font-size: 1.05rem;
          color: var(--text-primary);
        }

        .details .username {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .entry-controls {
          display: flex;
          align-items: flex-end;
          gap: 1.25rem;
        }

        .advanced-select {
          width: 90px;
          padding: 0.5rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          font-weight: 700;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.2s;
          outline: none;
        }

        .save-btn {
          padding: 0.6rem 1.5rem;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent-blue), #0066ff);
          color: #000;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 90px;
          box-shadow: 0 4px 15px rgba(0, 209, 255, 0.2);
        }

        .save-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 209, 255, 0.3);
        }

        .save-btn.success {
          background: var(--accent-green);
          color: #fff;
          box-shadow: 0 4px 15px rgba(0, 255, 136, 0.2);
        }

        .stats-box .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
        }

        .stat-row.main {
          margin-top: 1rem;
          padding: 1.5rem;
          background: rgba(0, 209, 255, 0.04);
          border-radius: 20px;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }

        .name-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .name-box .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .name-box .m-name {
          font-weight: 600;
          font-size: 0.95rem;
        }

        .val-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .val-box .today-val {
          font-size: 0.9rem;
          color: var(--accent-blue);
        }

        .val-box .month-val {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .spinner {
          width: 35px;
          height: 35px;
          border: 3px solid rgba(0, 209, 255, 0.1);
          border-top-color: var(--accent-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: inline-block;
        }

        .spinner-sm {
          width: 18px;
          height: 18px;
          border: 2px solid #000;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .main-layout {
            grid-template_columns: 1fr;
          }
          .preview-section {
            position: static;
          }
        }
      `}} />
    </div>
  );
};

export default MealManagement;
