import { useState, useEffect } from "react";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

const STATUS_LABEL = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

function HelpDesk() {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = () =>
    studentAPI.getHelp()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    loadRequests();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }
    setSubmitting(true);
    try {
      await studentAPI.submitHelp(subject.trim(), message.trim());
      toast.success("Help request submitted successfully");
      setSubject("");
      setMessage("");
      loadRequests();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Student Portal</div>
          <h1>Help Desk</h1>
          <div className="subtitle">Need help? Ask a question and the admin will reply</div>
        </div>
      </div>

      <div className="form-card">
        <h2>Report a Problem</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of the issue" required />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the problem in detail..." rows={5} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>

      <div className="request-history" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 12 }}>My Requests</h2>
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No help requests yet.</p>
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
                <p style={{ fontSize: 13 }}>{r.message}</p>
                {r.admin_reply && (
                  <div style={{
                    marginTop: 10, padding: "10px 12px", borderRadius: 8,
                    background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)",
                    fontSize: 13,
                  }}>
                    <strong style={{ color: "var(--accent)", fontSize: 12 }}>Admin reply{r.replied_at ? ` • ${new Date(r.replied_at).toLocaleDateString("en-IN")}` : ""}:</strong>
                    <div style={{ marginTop: 4 }}>{r.admin_reply}</div>
                  </div>
                )}
                <div className="item-meta">Raised {new Date(r.created_at).toLocaleDateString("en-IN")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-card" style={{ marginTop: 16 }}>
        <h2>Quick Help</h2>
        <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.8 }}>
          <p><strong style={{ color: "var(--text-h)" }}>Booking Issues:</strong> If you face problems while booking a seat, try refreshing the page or contact support.</p>
          <p><strong style={{ color: "var(--text-h)" }}>Payment Issues:</strong> If your payment is not reflecting, allow up to 24 hours for admin verification.</p>
          <p><strong style={{ color: "var(--text-h)" }}>Membership:</strong> Contact the library administrator for membership-related queries.</p>
        </div>
      </div>
    </div>
  );
}

export default HelpDesk;
