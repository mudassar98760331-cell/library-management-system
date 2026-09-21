import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Reports() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getReports()
      .then(setStats)
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  const cards = [
    { icon: "\u{1F465}", label: "Total Students", value: stats?.totalStudents || 0, color: "green" },
    { icon: "\u{1F4CB}", label: "Active Memberships", value: stats?.activeMemberships || 0, color: "blue" },
    { icon: "\u{1F4BA}", label: "Total Seats", value: stats?.totalSeats || 0, color: "blue" },
    { icon: "\u{1F4B0}", label: "Total Revenue", value: `\u20B9${stats?.totalRevenue || 0}`, color: "green" },
    { icon: "\u2705", label: "Completed Payments", value: stats?.totalPayments || 0, color: "green" },
    { icon: "\u{1F4C8}", label: "Total Bookings", value: stats?.totalBookings || 0, color: "blue" },
    { icon: "\u{1F50E}", label: "Lost & Found Reports", value: stats?.totalLostFound || 0, color: "orange" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Reports</h1>
          <div className="subtitle">Library analytics and statistics</div>
        </div>
      </div>

      <div className="admin-stat-grid">
        {cards.map((c, i) => (
          <div key={i} className="admin-stat-card">
            <div className="stat-card-header">
              <div className={`stat-card-icon ${c.color}`}>{c.icon}</div>
              <div>
                <div className="stat-card-value">{c.value}</div>
                <div className="stat-card-label">{c.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Reports;
