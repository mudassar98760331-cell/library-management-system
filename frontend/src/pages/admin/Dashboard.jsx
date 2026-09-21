import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Dashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");

  useEffect(() => {
    adminAPI.getDashboard()
      .then(setStats)
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;
  if (!stats) return <div className="empty-state"><h3>Failed to load dashboard</h3></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Admin Dashboard</h1>
          <div className="subtitle">Overview of your library</div>
        </div>
        <div className="filter-bar">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="this_month">This Month</option>
            <option value="all_time">All Time</option>
          </select>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">&#128101;</div>
            <div>
              <div className="stat-card-value">{stats.totalStudents || 0}</div>
              <div className="stat-card-label">Total Students</div>
            </div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">&#128203;</div>
            <div>
              <div className="stat-card-value">{stats.activeMemberships || 0}</div>
              <div className="stat-card-label">Active Memberships</div>
            </div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">&#128179;</div>
            <div>
              <div className="stat-card-value">{stats.pendingPayments || 0}</div>
              <div className="stat-card-label">Pending Payments</div>
            </div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">&#128186;</div>
            <div>
              <div className="stat-card-value">{stats.availableSeats || 0}</div>
              <div className="stat-card-label">Available Seats</div>
            </div>
          </div>
        </div>
      </div>

      {stats.recentPayments && stats.recentPayments.length > 0 && (
        <div className="table-card seats-table-card">
          <h2>Recent Payments</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>#</th><th>Student</th><th>Amount</th><th>UTR</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {stats.recentPayments.map((p, idx) => (
                  <tr key={p.id}>
                    <td data-label="#">{idx + 1}</td>
                    <td data-label="Student">{p.user_name || "N/A"}</td>
                    <td data-label="Amount">&#8377;{p.amount}</td>
                    <td data-label="UTR">{p.utr_number || "\u2014"}</td>
                    <td data-label="Status"><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                    <td data-label="Action">
                      {p.status === "pending" && <button className="btn btn-primary btn-sm">Verify</button>}
                      {p.status === "approved" && <button className="btn btn-secondary btn-sm">View</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
