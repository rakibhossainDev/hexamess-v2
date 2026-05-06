import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, increment, query, where } from '../firebase';
import { getTodayDateString, getTodayDisplay } from '../utils/monthUtils';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const MealTracking = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) {
      setTimeout(() => setLoading(false), 0);
      return;
    }
    const u1 = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setLoading(false);
    });
    const u2 = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { u1(); u2(); };
  }, []);

  // Load meals for selected date
  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    const mQ = query(collection(db, 'meals'), where('month_id', '==', mid), where('date', '==', selectedDate));
    const unsub = onSnapshot(mQ, snap => {
      const mealsMap = {};
      snap.docs.forEach(d => { const data = d.data(); mealsMap[data.user_id] = { docId: d.id, ...data }; });
      setTodayMeals(mealsMap);
    });
    return () => unsub();
  }, [config, selectedDate]);

  const getMealDocId = (userId) => `${config?.current_month_id}_${selectedDate}_${userId}`;

  const toggleMeal = async (userId, mealType) => {
    if (!config) return;
    const existing = todayMeals[userId];
    const currentVal = existing ? !!existing[mealType] : false;
    const newVal = !currentVal;
    const mealValue = mealType === 'breakfast' ? 0.5 : 1;
    const delta = newVal ? mealValue : -mealValue;

    try {
      const mealDocId = getMealDocId(userId);
      await setDoc(doc(db, 'meals', mealDocId), {
        month_id: config.current_month_id,
        date: selectedDate,
        user_id: userId,
        [mealType]: newVal,
        ...(existing ? {} : { breakfast: false, lunch: false, dinner: false, [mealType]: newVal }),
      }, { merge: true });
      await updateDoc(doc(db, 'users', userId), { total_meals: increment(delta) });
    } catch (err) {
      console.error('Meal toggle error:', err);
      showToast('মিল আপডেট ব্যর্থ।', 'error');
    }
  };

  const calcTotal = (userId) => {
    const m = todayMeals[userId];
    if (!m) return 0;
    let t = 0;
    if (m.breakfast) t += 0.5;
    if (m.lunch) t += 1;
    if (m.dinner) t += 1;
    return t;
  };

  const grandTotal = members.reduce((s, m) => s + calcTotal(m.id), 0);

  return (
    <div className="card" style={{ flex:1 }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
        <h2 style={{ fontSize:'1.25rem', fontWeight:'600' }}>🍽️ মিল ম্যানেজমেন্ট</h2>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>তারিখ নির্বাচন:</label>
            <input 
              type="date" 
              className="form-control" 
              style={{ padding: '0.4rem', fontSize: '0.875rem', width: 'auto' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <span style={{ fontSize:'0.875rem', fontWeight:'600', color:'var(--accent-blue)', background:'rgba(0,209,255,0.1)', padding:'0.4rem 0.75rem', borderRadius:'var(--radius-md)' }}>
            মোট মিল: {grandTotal}
          </span>
        </div>
      </div>

      {loading ? (
        <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>লোড হচ্ছে...</p>
      ) : members.length === 0 ? (
        <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>কোনো সদস্য পাওয়া যায়নি।</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>মেম্বার নাম</th>
                <th style={{ textAlign:'center' }}>সকাল (০.৫)</th>
                <th style={{ textAlign:'center' }}>দুপুর (১)</th>
                <th style={{ textAlign:'center' }}>রাত (১)</th>
                <th style={{ textAlign:'center' }}>আজকের মোট</th>
                <th style={{ textAlign:'center' }}>মাসিক মোট</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <td style={{ fontWeight:'500' }}>
                    {member.name}
                    {member.role === 'manager' && <span className="badge badge-manager" style={{ marginLeft:'0.5rem', fontSize:'0.65rem' }}>👑</span>}
                  </td>
                  {['breakfast', 'lunch', 'dinner'].map(type => (
                    <td key={type} style={{ textAlign:'center' }}>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={!!todayMeals[member.id]?.[type]} onChange={() => toggleMeal(member.id, type)} />
                        <span className="slider"></span>
                      </label>
                    </td>
                  ))}
                  <td style={{ textAlign:'center', fontWeight:'600', color:'var(--accent-blue)' }}>{calcTotal(member.id)}</td>
                  <td style={{ textAlign:'center', fontWeight:'600', color:'var(--accent-orange)' }}>{member.total_meals || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MealTracking;
