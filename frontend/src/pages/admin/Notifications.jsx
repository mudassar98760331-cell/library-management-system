import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Notifications() {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    adminAPI.getNotifications()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { toast.error("Please fill in all fields"); return; }
    setSending(true);
    try {
      await adminAPI.sendNotification({ title, message });
      toast.success("Notification sent!");
      setTitle("");
      setMessage("");
      const updated = await adminAPI.getNotifications();
      setNotifications(updated);
    } catch (err) { toast.error(err.message); } finally { setSending(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Notifications</h1>
          <div className="subtitle">Send and manage notifications</div>
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: 560 }}>
        <h2>Send Notification</h2>
        <form onSubmit={handleSend}>
          <div className="form-group">
            <label>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" required />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Notification message..." rows={4} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Sending..." : "Send Notification"}
          </button>
        </form>
      </div>

      <div className="table-card" style={{ marginTop: 20 }}>
        <h2>Notification History</h2>
        {loading ? (
          <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>
        ) : notifications.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No notifications sent yet.</p>
        ) : (
          <div className="notification-list">
            {notifications.map((n) => (
              <div key={n.id} className="notification-item read">
                <div className="notification-content">
                  <h3>{n.title}</h3>
                  <p>{n.message}</p>
                  <div className="notification-meta">{new Date(n.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Notifications;
