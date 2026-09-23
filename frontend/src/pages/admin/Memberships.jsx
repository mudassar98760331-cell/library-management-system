import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Memberships() {
  const toast = useToast();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getStudents()
      .then(setMemberships)
      .catch(() => toast.error("Failed to load memberships"))
      .finally(() => setLoading(false));
  }, [toast]);

  const active = memberships.filter((m) => m.membership_status === "active").length;
  const pending = memberships.filter((m) => m.membership_status === "pending").length;
  const expired = memberships.filter((m) => m.membership_status === "expired").length;
  const none = memberships.filter((m) => !m.membership_status || (m.membership_status !== "active" && m.membership_status !== "pending" && m.membership_status !== "expired")).length;

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Memberships</h1>
          <div className="subtitle">Manage student memberships</div>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">&#9989;</div>
            <div><div className="stat-card-value">{active}</div><div className="stat-card-label">Active</div></div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">&#9203;</div>
            <div><div className="stat-card-value">{pending}</div><div className="stat-card-label">Pending</div></div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">&#10060;</div>
            <div><div className="stat-card-value">{expired}</div><div className="stat-card-label">Expired</div></div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">&#128101;</div>
            <div><div className="stat-card-value">{none}</div><div className="stat-card-label">No Membership</div></div>
          </div>
        </div>
      </div>

      <div className="table-card seats-table-card">
        <h2>All Students</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Student</th><th>Plan</th><th>Status</th><th>Seat</th><th>Source</th><th>Expiry</th></tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id}>
                  <td data-label="Student">{m.name}</td>
                  <td data-label="Plan">{m.plan_name || "\u2014"}</td>
                  <td data-label="Status"><span className={`status-badge ${m.membership_status === "active" ? "status-active" : m.membership_status === "pending" ? "status-pending" : "status-expired"}`}>{m.membership_status || "None"}</span></td>
                  <td data-label="Seat">{m.current_seat || "\u2014"}</td>
                  <td data-label="Source">
                    {m.booking_source ? (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.8em",
                        fontWeight: 600,
                        background: m.booking_source === "online" ? "#16a34a20" : "#f59e0b20",
                        color: m.booking_source === "online" ? "#16a34a" : "#f59e0b",
                      }}>
                        {m.booking_source === "online" ? "Online" : "Offline"}
                      </span>
                    ) : "\u2014"}
                  </td>
                  <td data-label="Expiry">{m.membership_expiry ? new Date(m.membership_expiry).toLocaleDateString() : "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Memberships;
