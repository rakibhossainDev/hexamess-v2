import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { db, collection, getDocs, doc, getDoc } from '../firebase';
import { getMonthLabel } from '../utils/monthUtils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
    const doc = new jsPDF();
    const summary = historyData;

    doc.setFontSize(18);
    doc.text(`HexaMess Monthly Report - ${summary.month_name}`, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Total Meals: ${summary.total_meals}`, 14, 32);
    doc.text(`Total Market Cost: BDT ${summary.total_market}`, 14, 40);
    doc.text(`Total Fixed Cost: BDT ${summary.total_fixed}`, 100, 32);
    doc.text(`Meal Rate: BDT ${summary.meal_rate}`, 100, 40);

    const tableColumn = ["Name", "Deposit", "Meals", "Meal Cost", "Fixed Cost", "Final Balance"];
    const tableRows = [];

    summary.members.forEach(m => {
      tableRows.push([
        m.name,
        m.deposit,
        m.meals,
        m.meal_cost,
        m.fixed_cost,
        m.final_balance
      ]);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 209, 255] }
    });

    doc.save(`HexaMess_Report_${summary.month_id}.pdf`);
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

              {/* Summary Cards */}
              <div className="stats-grid">
                <div className="card glass-card" style={{ 
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))',
                  borderTop:'4px solid var(--accent-orange)' 
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>💰 মোট বাজার খরচ</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-orange)' }}>৳{Number(historyData.total_market).toLocaleString()}</p>
                </div>
                <div className="card glass-card" style={{ 
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.02))',
                  borderTop:'4px solid var(--accent-red)' 
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>🏠 মোট ফিক্সড বিল</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-red)' }}>৳{Number(historyData.total_fixed).toLocaleString()}</p>
                </div>
                <div className="card glass-card" style={{ 
                  background: 'linear-gradient(135deg, rgba(0,209,255,0.1), rgba(0,209,255,0.02))',
                  borderTop:'4px solid var(--accent-blue)' 
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>🍽️ মোট মিল</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{historyData.total_meals}</p>
                </div>
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
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>নাম</th>
                        <th style={{ textAlign: 'right' }}>জমা</th>
                        <th style={{ textAlign: 'center' }}>মিল</th>
                        <th style={{ textAlign: 'right' }}>মিল খরচ</th>
                        <th style={{ textAlign: 'right' }}>ফিক্সড খরচ</th>
                        <th style={{ textAlign: 'right' }}>ফাইনাল ব্যালেন্স</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.members.map(user => (
                        <tr key={user.id}>
                          <td style={{ fontWeight:'500' }}>{user.name}</td>
                          <td style={{ textAlign: 'right' }}>৳{user.deposit || 0}</td>
                          <td style={{ textAlign: 'center' }}>{user.meals || 0}</td>
                          <td style={{ textAlign: 'right' }}>৳{user.meal_cost || 0}</td>
                          <td style={{ textAlign: 'right' }}>৳{user.fixed_cost || 0}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: user.final_balance < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                            ৳{user.final_balance || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expense List */}
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem' }}>🛒 বাজার বিবরণ</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>তারিখ</th>
                        <th>আইটেম</th>
                        <th>বাজারকারী</th>
                        <th style={{ textAlign: 'right' }}>খরচ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(historyData.expenses || []).map((exp, idx) => (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-secondary)', fontSize:'0.875rem' }}>{exp.date}</td>
                          <td>
                            <div style={{ fontWeight:'600' }}>{exp.itemName || exp.details}</div>
                            {exp.quantity && <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{exp.quantity}</div>}
                          </td>
                          <td>{exp.shopperName || exp.shopper_name}</td>
                          <td style={{ textAlign: 'right', fontWeight:'600' }}>৳{exp.amount || exp.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color:'var(--text-secondary)', marginBottom:'1rem' }}>কোনো আর্কাইভ ডাটা পাওয়া যায়নি।</p>
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
