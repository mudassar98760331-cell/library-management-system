import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

const STATUS_LABEL = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

function HelpDesk() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [actionId, setActionId] = useState(null);

  const loadRequests = () =>
    adminAPI.getHelp()
      .then(setRequests)
      .catch(() => toast.error("Failed to load help requests"))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadRequests();
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (id, status) => {
    setActionId(id);
    try {
      await adminAPI.updateHelp(id, { status });
      toast.success("Status updated");
      loadRequests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionId(null);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) { toast.error("Reply cannot be empty"); return; }
    setActionId(replyTarget.id);
    try {
      await adminAPI.updateHelp(replyTarget.id, { reply: replyText.trim() });
      toast.success("Reply sent to student");
      setReplyTarget(null);
      setReplyText("");
      loadRequests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Help Desk</h1>
          <div className="subtitle">{requests.length} request{requests.length !== 1 ? "s" : ""} &bull; {pendingCount} awaiting reply</div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <h3>No help requests</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>Student requests will appear here.</p>
        </div>
      ) : (
        <div className="item-list">
          {requests.map((r) => (
            <div key={r.id} className="item-card">
              <div className="item-header">
                <h3>{r.subject}</h3>
                <span className={`status-badge status-${r.status === "resolved" ? "active" : r.status === "in_progress" ? "pending" : "expired"}`}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
              <div className="item-meta" style={{ marginBottom: 8 }}>
                {r.student_name} &bull; {r.student_email} &bull; {new Date(r.created_at).toLocaleString("en-IN")}
              </div>
              <p style={{ fontSize: 13 }}>{r.message}</p>
              {r.admin_reply && (
                <div style={{
                  marginTop: 10, padding: "10px 12px", borderRadius: 8,
                  background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)",
                  fontSize: 13,
                }}>
                  <strong style={{ color: "var(--accent)", fontSize: 12 }}>Your reply:</strong>
                  <div style={{ marginTop: 4 }}>{r.admin_reply}</div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setReplyTarget(r); setReplyText(r.admin_reply || ""); }}
                >
                  {r.admin_reply ? "Edit Reply" : "Reply"}
                </button>
                <select
                  value={r.status}
                  onChange={(e) => handleStatusChange(r.id, e.target.value)}
                  disabled={actionId === r.id}
                  style={{
                    background: "var(--bg-card)", color: "var(--text)",
                    border: "1px solid var(--border)", borderRadius: 6,
                    padding: "6px 10px", fontSize: 12.5,
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {replyTarget && (
        <div className="modal-overlay" onClick={() => setReplyTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reply to {replyTarget.student_name}</h2>
              <button className="modal-close" onClick={() => setReplyTarget(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
                <strong style={{ color: "var(--text)" }}>{replyTarget.subject}</strong>
                <div style={{ marginTop: 4 }}>{replyTarget.message}</div>
              </div>
              <div className="form-group">
                <label>Your Reply</label>
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your reply..." rows={4} />
              </div>
              <button className="btn btn-primary" onClick={handleReply} disabled={actionId === replyTarget.id} style={{ marginTop: 8 }}>
                {actionId === replyTarget.id ? "Sending..." : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HelpDesk;
