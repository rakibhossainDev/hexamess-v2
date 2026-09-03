import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { db, collection, getDocs, doc, getDoc, writeBatch } from '../utils/firebase';
import html2pdf from 'html2pdf.js';

const HistoryArchive = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [months, setMonths] = useState([]);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userRole] = useState(localStorage.getItem('hexamess-user-role') || 'member');
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  const loadMonthData = async (monthId) => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'histories', monthId));
      if (snap.exists()) {
        setHistoryData({ id: snap.id, ...snap.data() });
      } else {
        setHistoryData(null);
      }
    } catch (err) {
      console.error(err);
      setHistoryData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const fetchAvailableMonths = async () => {
      try {
        const snap = await getDocs(collection(db, 'histories'));
        const uniqueMonths = snap.docs.map(d => d.id).sort().reverse();
        setMonths(uniqueMonths);
        // Do not auto-load the first month. Wait for user selection.
      } catch (err) { console.error(err); }
    };
    fetchAvailableMonths();
  }, []);

  const generatePDF = () => {
    if (!historyData) return;
    const element = document.getElementById('history-pdf-content');

    // Config for html2pdf
    const opt = {
      margin: 0.4,
      filename: `Hexamess_Session_Report_${historyData.month_id}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleRestoreSession = async () => {
    if (!historyData) return;

    const confirmUndo = window.confirm(
      "আপনি কি নিশ্চিত? এই সেশনটি রিস্টোর করলে এটি আর্কাইভ থেকে মুছে যাবে এবং এর সকল ডাটা (বাজার, মিল, খরচ, ইত্যাদি) মূল ড্যাশবোর্ডে ফিরে যাবে।"
    );
    if (!confirmUndo) return;

    setLoading(true);
    try {
      // Firebase batch limit is 500. We will chunk operations into groups of 400.
      const operations = [];

      // 1. Restore expenses (bazar_records)
      if (historyData.expenses && Array.isArray(historyData.expenses)) {
        historyData.expenses.forEach(exp => {
          if (exp.id) {
            operations.push({ ref: doc(db, 'bazar_records', String(exp.id)), data: exp, type: 'set' });
          }
        });
      }

      // 2. Restore fixed costs (fixed_expenses)
      if (historyData.fixed_costs && Array.isArray(historyData.fixed_costs)) {
        historyData.fixed_costs.forEach(f => {
          if (f.id) {
            operations.push({ ref: doc(db, 'fixed_expenses', String(f.id)), data: f, type: 'set' });
          }
        });
      }

      // 3. Restore meals (daily_meals)
      if (historyData.meals && Array.isArray(historyData.meals)) {
        historyData.meals.forEach(m => {
          if (m.id) {
            operations.push({ ref: doc(db, 'daily_meals', String(m.id)), data: m, type: 'set' });
          }
        });
      }

      // 4. Restore deposits (deposits)
      if (historyData.deposits && Array.isArray(historyData.deposits)) {
        historyData.deposits.forEach(d => {
          if (d.id) {
            operations.push({ ref: doc(db, 'deposits', String(d.id)), data: d, type: 'set' });
          }
        });
      }

      // 5. Restore member balances exactly as they were captured in the snapshot
      if (historyData.users_snapshot && Array.isArray(historyData.users_snapshot)) {
        for (const snap of historyData.users_snapshot) {
          const userDoc = await getDoc(doc(db, 'users', String(snap.id)));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const currentLifetimeMeals = Number(userData.lifetime_meals) || 0;
            const archivedMeals = Number(snap.total_meals) || 0;

            operations.push({
              ref: doc(db, 'users', String(snap.id)),
              data: {
                total_meals: Number(snap.total_meals) || 0,
                total_deposit: Number(snap.total_deposit) || 0,
                total_fixed_cost: Number(snap.total_fixed_cost) || 0,
                lifetime_meals: Math.max(0, currentLifetimeMeals - archivedMeals)
              },
              type: 'update'
            });
          }
        }
      }

      // 6. Delete from histories
      operations.push({ ref: doc(db, 'histories', String(historyData.id)), type: 'delete' });

      // Execute batches in chunks of 400
      const chunkSize = 400;
      for (let i = 0; i < operations.length; i += chunkSize) {
        const chunk = operations.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(op => {
          if (op.type === 'set') batch.set(op.ref, op.data);
          else if (op.type === 'update') batch.update(op.ref, op.data);
          else if (op.type === 'delete') batch.delete(op.ref);
        });
        await batch.commit();
      }

      alert("সেশন সফলভাবে রিস্টোর করা হয়েছে!");

      // Refresh
      const snap = await getDocs(collection(db, 'histories'));
      const uniqueMonths = snap.docs.map(d => d.id).sort().reverse();
      setMonths(uniqueMonths);
      setSelectedMonth('');
      setHistoryData(null);

    } catch (error) {
      console.error("Error restoring session:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isAdminPath ? "" : "app-layout"}>
      <main className="main-content" style={{ padding: isAdminPath ? 0 : '0 0 80px 0' }}>
        {!isAdminPath && <Navbar userName={localStorage.getItem('hexamess-user-name')} userRole={userRole === 'manager' ? 'ম্যানেজার' : 'সদস্য'} />}

        <div className="w-full overflow-x-hidden p-4 md:p-6 box-border">
          <div className="flex flex-row justify-between items-center w-full mb-6">
            <h2 className="text-2xl font-bold m-0">📅 হিস্টরি আর্কাইভ</h2>
            <div className="flex justify-end items-center gap-3">
              <label className="text-sm text-[var(--text-secondary)]">মাস:</label>
              <select
                className="form-control w-auto min-w-[150px]"
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); loadMonthData(e.target.value); }}
              >
                <option value="" disabled>মাস নির্বাচন করুন...</option>
                {months.length === 0 && <option value="" disabled>কোনো রেকর্ড নেই</option>}
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {!selectedMonth ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1.1rem' }}>দয়া করে উপরের মেনু থেকে একটি মাস নির্বাচন করুন।</p>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>লোড হচ্ছে...</div>
          ) : historyData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* The PDF Download Button has been moved into the Official Document Header */}

              {/* PDF Content Wrapper */}
              <div id="history-pdf-content" className="font-solaiman" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', background: 'var(--bg-primary)' }}>

                {/* Official Document Header */}
                <div className="w-full flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4 my-6 pb-4 border-b-2 border-[var(--border-color)]">
                  <h1 className="text-xl md:text-2xl font-extrabold text-[var(--accent-blue)] m-0 leading-none">Hexamess</h1>
                  <span className="text-slate-500 font-bold leading-none hidden md:inline">|</span>
                  <h2 className="text-lg md:text-xl font-bold text-white m-0 leading-none">Monthly Session Report</h2>
                  <span className="text-slate-500 font-bold leading-none hidden md:inline">|</span>
                  <p className="text-sm md:text-base text-slate-400 m-0 leading-none">সেশন: {historyData.month_name}</p>

                  {/* PDF Download Button and Restore Button */}
                  <div data-html2canvas-ignore="true" className="flex gap-2 mt-2 md:mt-0">
                    <button
                      className="btn btn-primary text-sm md:text-base px-4 py-2"
                      onClick={generatePDF}
                      style={{ background: 'var(--accent-blue)', color: '#000', fontWeight: '600' }}
                    >
                      📥 Download PDF
                    </button>
                    {userRole === 'manager' && (
                      <button
                        className="btn btn-secondary text-sm md:text-base px-4 py-2"
                        onClick={handleRestoreSession}
                        style={{ background: 'var(--accent-orange)', color: '#fff', fontWeight: '600', border: 'none' }}
                      >
                        ↺ রিস্টোর করুন (Undo)
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Total Deposit */}
                  <div className="card glass-card shadow-sm hover:shadow-md transition-shadow" style={{
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.02))',
                    borderTop: '4px solid #22c55e'
                  }}>
                    <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-1 md:mb-2">💵 মোট জমা</p>
                    <p className="text-lg md:text-xl font-extrabold text-[#22c55e]">৳{((historyData.members || []).reduce((sum, member) => sum + (Number(member.deposit) || 0), 0)).toLocaleString()}</p>
                  </div>
                  {/* Market Cost */}
                  <div className="card glass-card shadow-sm hover:shadow-md transition-shadow" style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))',
                    borderTop: '4px solid var(--accent-orange)'
                  }}>
                    <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-1 md:mb-2">💰 মোট বাজার খরচ</p>
                    <p className="text-lg md:text-xl font-extrabold text-[var(--accent-orange)]">৳{Number(historyData.total_market).toLocaleString()}</p>
                  </div>
                  {/* Cash Balance */}
                  <div className="card glass-card shadow-sm hover:shadow-md transition-shadow" style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))',
                    borderTop: '4px solid #6366f1'
                  }}>
                    <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-1 md:mb-2">🏦 ক্যাশ ব্যালেন্স</p>
                    <p className="text-lg md:text-xl font-extrabold text-[#6366f1]">
                      ৳{(((historyData.members || []).reduce((sum, member) => sum + (Number(member.deposit) || 0), 0)) - Number(historyData.total_market || 0)).toLocaleString()}
                    </p>
                  </div>
                  {/* Total Meals */}
                  <div className="card glass-card shadow-sm hover:shadow-md transition-shadow" style={{
                    background: 'linear-gradient(135deg, rgba(0,209,255,0.1), rgba(0,209,255,0.02))',
                    borderTop: '4px solid var(--accent-blue)'
                  }}>
                    <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-1 md:mb-2">🍽️ মোট মিল</p>
                    <p className="text-lg md:text-xl font-extrabold text-[var(--accent-blue)]">{historyData.total_meals}</p>
                  </div>
                  {/* Meal Rate */}
                  <div className="card glass-card shadow-sm hover:shadow-md transition-shadow" style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))',
                    borderTop: '4px solid var(--accent-green)'
                  }}>
                    <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-1 md:mb-2">📉 ফাইনাল মিল রেট</p>
                    <p className="text-lg md:text-xl font-extrabold text-[var(--accent-green)]">৳{historyData.meal_rate}</p>
                  </div>
                </div>

                {/* Member Report */}
                <div className="card">
                  <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📊 মেম্বার ক্লোজিং ব্যালেন্স</h3>
                  <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm md:text-base">
                      <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-xs font-semibold">
                        <tr>
                          <th className="border-b border-gray-100 px-4 py-3 text-left">Member Name</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-right">Total Deposit</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-right">Total Meals</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-right">Meal Rate</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-right">Meal Cost</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-right">Fixed Cost</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-right">Total Cost</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-right">Final Status (Refund/Due)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white text-slate-700">
                        {historyData.members.map(user => {
                          const totalCost = (user.meal_cost || 0) + (user.fixed_cost || 0);
                          const isRefund = (user.deposit || 0) >= totalCost;
                          const statusAmount = Math.abs((user.deposit || 0) - totalCost).toFixed(2);
                          const statusText = isRefund ? `+৳${statusAmount} পাবে` : `-৳${statusAmount} দিবে`;

                          return (
                            <tr key={user.id} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-left">{user.name}</td>
                              <td className="px-4 py-3 text-right">৳{user.deposit || 0}</td>
                              <td className="px-4 py-3 text-right">{user.meals || 0}</td>
                              <td className="px-4 py-3 text-right">৳{historyData.meal_rate || 0}</td>
                              <td className="px-4 py-3 text-right">৳{user.meal_cost || 0}</td>
                              <td className="px-4 py-3 text-right font-bold text-[var(--accent-green)]">৳{user.fixed_cost || 0}</td>
                              <td className="px-4 py-3 text-right font-bold text-[var(--accent-orange)]">৳{totalCost.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right">
                                {isRefund ? (
                                  <span className="px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">{statusText}</span>
                                ) : (
                                  <span className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">{statusText}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Expense List */}
                <div className="card">
                  <h3 style={{ marginBottom: '1.25rem' }}>🛒 বাজার বিবরণ</h3>
                  <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm md:text-base">
                      <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-xs font-semibold">
                        <tr>
                          <th className="border-b border-gray-100 px-4 py-3 whitespace-nowrap text-left">তারিখ</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-left">আইটেম</th>
                          <th className="border-b border-gray-100 px-4 py-3 whitespace-nowrap text-left">বাজারকারী</th>
                          <th className="border-b border-gray-100 px-4 py-3 text-right whitespace-nowrap">খরচ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white text-slate-700">
                        {[...(historyData.expenses || [])].sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0)).map((exp, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm whitespace-nowrap text-left">{exp.date}</td>
                            <td className="px-4 py-3 whitespace-normal break-words min-w-[200px] md:min-w-[300px] text-left">
                              <div className="font-semibold">{exp.itemName || exp.details}</div>
                              {exp.quantity && <div className="text-xs text-slate-500 mt-1">{exp.quantity}</div>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-left">{exp.managerName || exp.shopperName || exp.shopper_name || 'N/A'}</td>
                            <td className="px-4 py-3 text-right font-bold text-[var(--accent-blue)] whitespace-nowrap">৳{exp.amount || exp.cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>কোনো আর্কাইভ ডাটা পাওয়া জ্ঞায়নি।</p>
              <p style={{ fontSize: '0.875rem' }}>ম্যানেজার যখন নতুন মাস শুরু করবেন, তখন চলতি মাসের ডাটা এখানে সংরক্ষিত হবে।</p>
            </div>
          )}
        </div>
      </main>
      {!isAdminPath && <BottomNav isManager={userRole === 'manager'} />}
    </div>
  );
};

export default HistoryArchive;
