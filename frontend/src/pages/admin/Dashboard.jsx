import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Dashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("this_month");
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyScreenshot, setVerifyScreenshot] = useState(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadDashboard = () =>
    adminAPI.getDashboard()
      .then(setStats)
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadDashboard();
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const openVerify = async (p) => {
    setVerifyTarget(p);
    setVerifyScreenshot(null);
    setScreenshotLoading(true);
    try {
      const url = await adminAPI.getPaymentScreenshot(p.id);
      setVerifyScreenshot(url);
    } catch {
      setVerifyScreenshot(null);
    } finally {
      setScreenshotLoading(false);
    }
  };

  const closeVerify = () => {
    if (verifyScreenshot) URL.revokeObjectURL(verifyScreenshot);
    setVerifyTarget(null);
    setVerifyScreenshot(null);
    setShowReject(false);
    setRejectReason("");
  };

  const handleApprove = async () => {
    setActionId(verifyTarget.id);
    try {
      await adminAPI.approvePayment(verifyTarget.id);
      toast.success("Payment approved");
      closeVerify();
      loadDashboard();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async () => {
    setActionId(verifyTarget.id);
    try {
      await adminAPI.rejectPayment(verifyTarget.id, rejectReason);
      toast.success("Payment rejected");
      closeVerify();
      loadDashboard();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionId(null);
    }
  };

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
                      {p.status === "pending" && (
                        <button className="btn btn-primary btn-sm" onClick={() => openVerify(p)}>Verify</button>
                      )}
                      {p.status === "completed" && p.has_screenshot && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openVerify(p)}>View</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {verifyTarget && (
        <div className="modal-overlay" onClick={closeVerify}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Verify Payment</h2>
              <button className="modal-close" onClick={closeVerify}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gap: 8, marginBottom: 14, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Student</span>
                  <strong>{verifyTarget.user_name}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Phone</span>
                  <strong>{verifyTarget.user_phone || "\u2014"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Amount</span>
                  <strong>&#8377;{verifyTarget.amount}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Submitted UTR</span>
                  <strong style={{ wordBreak: "break-all", textAlign: "right" }}>{verifyTarget.utr_number || "\u2014"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Date</span>
                  <strong>{new Date(verifyTarget.created_at).toLocaleString("en-IN")}</strong>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>Payment Screenshot</div>
                {screenshotLoading ? (
                  <div style={{ padding: 24, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 8 }}>
                    <div className="spinner" />
                  </div>
                ) : verifyScreenshot ? (
                  <img src={verifyScreenshot} alt="Payment screenshot" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }} />
                ) : (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: 8 }}>
                    No screenshot uploaded
                  </div>
                )}
              </div>

              {verifyTarget.status === "pending" && (
                showReject ? (
                  <div>
                    <div className="form-group">
                      <label>Reason for Rejection</label>
                      <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason..." rows={3} />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="btn btn-secondary" onClick={() => setShowReject(false)}>Back</button>
                      <button className="btn btn-danger" onClick={handleReject} disabled={actionId === verifyTarget.id}>
                        {actionId === verifyTarget.id ? "Rejecting..." : "Confirm Reject"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleApprove} disabled={actionId === verifyTarget.id}>
                      {actionId === verifyTarget.id ? "Approving..." : "Approve"}
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setShowReject(true)} disabled={actionId === verifyTarget.id}>
                      Reject
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
