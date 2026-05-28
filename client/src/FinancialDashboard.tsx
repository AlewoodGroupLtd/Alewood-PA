import { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, PieChart, Activity } from 'lucide-react';

const SPREADSHEET_ID = '1AQZ854Zx8KCRG9EpiK0WnEuucI2qW7I-cQb1-k0fjP0';

export default function FinancialDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      const token = localStorage.getItem('googleAccessToken');
      if (!token) throw new Error("No Google access token found.");

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Summary!A:C`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sheetData = await res.json();
      
      if (!sheetData.values) throw new Error("No data found in Summary sheet.");

      const rows = sheetData.values;
      
      // Fixed cells
      const bankBalance = rows[1]?.[1] || '£0.00'; // B2 (index 1, 1)
      const directorsLoan = rows[2]?.[1] || '£0.00'; // B3 (index 2, 1)

      // Find dynamic tables by scanning column A
      let expenseBreakdownStartIndex = -1;
      let burnRateStartIndex = -1;
      let incomingsOutgoingsStartIndex = -1;

      for (let i = 0; i < rows.length; i++) {
        const val = (rows[i][0] || '').toString().toLowerCase();
        if (val.includes('expense breakdown')) expenseBreakdownStartIndex = i;
        else if (val.includes('burn rate')) burnRateStartIndex = i;
        else if (val.includes('incomings vs outgoings')) incomingsOutgoingsStartIndex = i;
      }

      // Extract Expense Breakdown (reads until empty row or next table)
      const expenseBreakdown = [];
      if (expenseBreakdownStartIndex !== -1) {
        for (let i = expenseBreakdownStartIndex + 2; i < rows.length; i++) {
          if (!rows[i][0] || rows[i][0] === 'Grand Total') break;
          expenseBreakdown.push({ category: rows[i][0], amount: rows[i][1] });
        }
      }

      // Extract Burn Rate
      const burnRate = [];
      if (burnRateStartIndex !== -1) {
        for (let i = burnRateStartIndex + 2; i < rows.length; i++) {
          if (!rows[i][0] || rows[i][0] === 'Grand Total') break;
          burnRate.push({ month: rows[i][0], amount: rows[i][1] });
        }
      }

      // Extract Incomings vs Outgoings
      const ioData = [];
      if (incomingsOutgoingsStartIndex !== -1) {
        for (let i = incomingsOutgoingsStartIndex + 2; i < rows.length; i++) {
          if (!rows[i][0] || rows[i][0] === 'Grand Total') break;
          ioData.push({ type: rows[i][0], amount: rows[i][1] });
        }
      }

      setData({
        bankBalance,
        directorsLoan,
        expenseBreakdown,
        burnRate,
        ioData
      });
    } catch (err: any) {
      console.error("Failed to fetch financial data:", err);
      setError(err.message || "Failed to load financial data.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Loading financial data...</div>;
  if (error) return <div style={{ padding: '1rem', color: 'var(--danger)' }}>{error}</div>;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="grid-2">
        <div className="list-item" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.5rem' }}>
            <DollarSign size={20} />
            <span style={{ fontWeight: 600 }}>Bank Balance</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>{data.bankBalance}</div>
        </div>

        <div className="list-item" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
            <Activity size={20} />
            <span style={{ fontWeight: 600 }}>Director's Loan Owed</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>{data.directorsLoan}</div>
          
          {/* Simple CSS Gauge / Progress bar representation */}
          <div style={{ marginTop: '0.8rem', width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: '65%', height: '100%', background: '#f59e0b', borderRadius: '4px' }}></div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="list-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.5rem' }}>
            <TrendingDown size={18} />
            <span style={{ fontWeight: 600 }}>Recent Burn Rate</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {data.burnRate.slice(-3).map((br: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{br.month}</span>
                <span style={{ color: '#fff' }}>{br.amount}</span>
              </div>
            ))}
            {data.burnRate.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No data</span>}
          </div>
        </div>

        <div className="list-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a855f7', marginBottom: '0.5rem' }}>
            <PieChart size={18} />
            <span style={{ fontWeight: 600 }}>Expense Breakdown</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {data.expenseBreakdown.slice(0, 4).map((exp: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{exp.category}</span>
                <span style={{ color: '#fff' }}>{exp.amount}</span>
              </div>
            ))}
            {data.expenseBreakdown.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No data</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
