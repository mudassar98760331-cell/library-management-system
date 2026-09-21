import { useState, useEffect } from "react";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function PaymentHistory() {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { studentAPI.getPaymentHistory().then(setPayments).catch(() => toast.error("Failed to load payment history")).finally(() => setLoading(false));   }, [toast]);

  const filtered = payments.filter(p => p.plan_name?.toLowerCase().includes(search.toLowerCase()) || p.utr_number?.toLowerCase().includes(search.toLowerCase()) || p.method?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header"><div><div className="label">Student Portal</div><h1>&#128179; Payment History</h1><div className="subtitle">View all your past payments</div></div></div>
      <div className="search-bar"><input type="text" placeholder="Search by plan, UTR, or method..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {filtered.length === 0 ? (
        <div className="empty-state"><h3>No payments found</h3><p>Your payment history will appear here.</p></div>
      ) : (
        <div className="table-container">
          <table><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th>UTR</th></tr></thead>
            <tbody>{filtered.map(p => (<tr key={p.id}><td>{new Date(p.created_at).toLocaleDateString()}</td><td>{p.plan_name}</td><td>&#8377;{p.amount}</td><td>{p.method?.toUpperCase()}</td><td><span className={`badge ${p.status}`}>{p.status}</span></td><td>{p.utr_number || "\u2014"}</td></tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PaymentHistory;
