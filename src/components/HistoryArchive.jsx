import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { db, collection, getDocs, doc, getDoc } from '../firebase';
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
        if (uniqueMonths.length > 0) {
          setSelectedMonth(uniqueMonths[0]);
          loadMonthData(uniqueMonths[0]);
        }
      } catch (err) { console.error(err); }
    };
    fetchAvailableMonths();
  }, []);

  const generatePDF = () => {
    if (!historyData) return;
    const element = document.getElementById('history-pdf-content');
    
    // Config for html2pdf
    const opt = {
      margin:       0.4,
      filename:     `Hexamess_Session_Report_${historyData.month_id}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className={isAdminPath ? "" : "app-layout"}>
      <main className="main-content" style={{ padding: isAdminPath ? 0 : '0 0 80px 0' }}>
        {!isAdminPath && <Navbar userName={localStorage.getItem('hexamess-user-name')} userRole={userRole === 'manager' ? 'ম্যানেজার' : 'সদস্য'} />}
        
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>📅 হিস্টরি আর্কাইভ</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>মাস:</label>
              <select 
                className="form-control" 
                style={{ width: 'auto' }}
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); loadMonthData(e.target.value); }}
              >
                {months.length === 0 && <option value="">কোনো রেকর্ড নেই</option>}
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>লোড হচ্ছে...</div>
          ) : historyData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* PDF Download Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={generatePDF}
                  style={{ background: 'var(--accent-blue)', color: '#000', fontWeight: '600' }}
                >
                  📥 Download PDF
                </button>
              </div>

              {/* PDF Content Wrapper */}
              <div id="history-pdf-content" className="font-solaiman" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', background: 'var(--bg-primary)' }}>
                
                {/* Official Document Header */}
                <div className="flex flex-wrap justify-center items-center gap-3 mb-4 pb-4 border-b-2 border-[var(--border-color)]">
                  <h1 className="text-2xl font-extrabold text-[var(--accent-blue)] m-0 leading-none">Hexamess</h1>
                  <span className="text-slate-500 font-bold leading-none">|</span>
                  <h2 className="text-xl font-bold text-white m-0 leading-none">Monthly Session Report</h2>
                  <span className="text-slate-500 font-bold leading-none">|</span>
                  <p className="text-base text-slate-400 m-0 leading-none">সেশন: {historyData.month_name}</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Total Deposit */}
                  <div className="card glass-card" style={{ 
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.02))',
                    borderTop:'4px solid #22c55e' 
                  }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>💵 মোট জমা</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '800', color: '#22c55e' }}>৳{((historyData.members || []).reduce((sum, member) => sum + (Number(member.deposit) || 0), 0)).toLocaleString()}</p>
                  </div>
                  {/* Market Cost */}
                  <div className="card glass-card" style={{ 
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))',
                    borderTop:'4px solid var(--accent-orange)' 
                  }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>💰 মোট বাজার খরচ</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-orange)' }}>৳{Number(historyData.total_market).toLocaleString()}</p>
                  </div>
                  {/* Cash Balance */}
                  <div className="card glass-card" style={{ 
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))',
                    borderTop:'4px solid #6366f1' 
                  }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>🏦 ক্যাশ ব্যালেন্স</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '800', color: '#6366f1' }}>
                      ৳{(((historyData.members || []).reduce((sum, member) => sum + (Number(member.deposit) || 0), 0)) - Number(historyData.total_market || 0)).toLocaleString()}
                    </p>
                  </div>
                  {/* Total Meals */}
                  <div className="card glass-card" style={{ 
                    background: 'linear-gradient(135deg, rgba(0,209,255,0.1), rgba(0,209,255,0.02))',
                    borderTop:'4px solid var(--accent-blue)' 
                  }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>🍽️ মোট মিল</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{historyData.total_meals}</p>
                  </div>
                  {/* Meal Rate */}
                  <div className="card glass-card" style={{ 
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))',
                    borderTop:'4px solid var(--accent-green)' 
                  }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>📉 ফাইনাল মিল রেট</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-green)' }}>৳{historyData.meal_rate}</p>
                  </div>
                </div>

                {/* Member Report */}
                <div className="card">
                  <h3 style={{ marginBottom: '1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>📊 মেম্বার ক্লোজিং ব্যালেন্স</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-700 text-left text-sm md:text-base">
                      <thead className="bg-slate-800 text-slate-200">
                        <tr>
                          <th className="border border-slate-700 p-2">Member Name</th>
                          <th className="border border-slate-700 p-2 text-right">Total Deposit</th>
                          <th className="border border-slate-700 p-2 text-center">Total Meals</th>
                          <th className="border border-slate-700 p-2 text-right">Meal Rate</th>
                          <th className="border border-slate-700 p-2 text-right">Meal Cost</th>
                          <th className="border border-slate-700 p-2 text-right">Total Cost</th>
                          <th className="border border-slate-700 p-2 text-right">Final Status (Refund/Due)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-slate-900 text-slate-300">
                        {historyData.members.map(user => {
                          const totalCost = user.meal_cost || 0;
                          const isRefund = (user.deposit || 0) >= totalCost;
                          const statusAmount = Math.abs((user.deposit || 0) - totalCost).toFixed(2);
                          const statusText = isRefund ? `+৳${statusAmount} পাবে` : `-৳${statusAmount} দিবে`;
                          const statusColor = isRefund ? 'text-green-400' : 'text-red-400';

                          return (
                            <tr key={user.id} className="hover:bg-slate-800/50">
                              <td className="border border-slate-700 p-2 font-medium">{user.name}</td>
                              <td className="border border-slate-700 p-2 text-right">৳{user.deposit || 0}</td>
                              <td className="border border-slate-700 p-2 text-center">{user.meals || 0}</td>
                              <td className="border border-slate-700 p-2 text-right">৳{historyData.meal_rate || 0}</td>
                              <td className="border border-slate-700 p-2 text-right">৳{user.meal_cost || 0}</td>
                              <td className="border border-slate-700 p-2 text-right text-[var(--accent-orange)] font-bold">৳{totalCost.toFixed(2)}</td>
                              <td className={`border border-slate-700 p-2 text-right font-bold ${statusColor}`}>
                                {statusText}
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
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-700 text-left text-sm md:text-base">
                      <thead className="bg-slate-800 text-slate-200">
                        <tr>
                          <th className="border border-slate-700 p-3">তারিখ</th>
                          <th className="border border-slate-700 p-3">আইটেম</th>
                          <th className="border border-slate-700 p-3">বাজারকারী</th>
                          <th className="border border-slate-700 p-3 text-right">খরচ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-slate-900 text-slate-300">
                        {[...(historyData.expenses || [])].sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0)).map((exp, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/50 even:bg-slate-800/20">
                            <td className="border border-slate-700 p-3 text-slate-400 text-sm">{exp.date}</td>
                            <td className="border border-slate-700 p-3">
                              <div className="font-semibold">{exp.itemName || exp.details}</div>
                              {exp.quantity && <div className="text-xs text-slate-400 mt-1">{exp.quantity}</div>}
                            </td>
                            <td className="border border-slate-700 p-3">{exp.managerName || exp.shopperName || exp.shopper_name || 'N/A'}</td>
                            <td className="border border-slate-700 p-3 text-right font-bold text-[var(--accent-blue)]">৳{exp.amount || exp.cost}</td>
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
              <p style={{ color:'var(--text-secondary)', marginBottom:'1rem' }}>কোনো আর্কাইভ ডাটা পাওয়া জ্ঞায়নি।</p>
              <p style={{ fontSize:'0.875rem' }}>ম্যানেজার যখন নতুন মাস শুরু করবেন, তখন চলতি মাসের ডাটা এখানে সংরক্ষিত হবে।</p>
            </div>
          )}
        </div>
      </main>
      {!isAdminPath && <BottomNav isManager={userRole === 'manager'} />}
    </div>
  );
};

export default HistoryArchive;
