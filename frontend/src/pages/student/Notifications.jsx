import { useState, useEffect } from "react";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Notifications() {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { studentAPI.getNotifications().then(setNotifications).catch(() => {}).finally(() => setLoading(false)); }, []);

  const markRead = async (id) => { try { await studentAPI.markNotificationRead(id); setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n)); } catch { /* ignore */ } };
  const markAllRead = async () => { for (const n of notifications.filter(n => !n.is_read && n.user_id != null)) await markRead(n.id); toast.success("All notifications marked as read"); };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;
  const unread = notifications.filter(n => !n.is_read && n.user_id != null).length;

  return (
    <div>
      <div className="page-header">
        <div><div className="label">Student Portal</div><h1>&#128276; Notifications</h1><div className="subtitle">{unread > 0 ? `${unread} unread notification${unread > 1 ? "s" : ""}` : "All caught up!"}</div></div>
        {unread > 0 && <button className="btn btn-secondary btn-sm" onClick={markAllRead}>Mark All Read</button>}
      </div>
      <div className="notification-list">
        {notifications.length === 0 && <div className="empty-state"><h3>No notifications</h3><p>You'll see updates about your membership, payments, and bookings here.</p></div>}
        {notifications.map(n => (
          <div key={n.id} className={`notification-item ${(n.user_id != null && n.is_read) || n.user_id == null ? "read" : "unread"}`}>
            <div className="notification-content">
              <h3>{n.title}</h3>
              <p>{n.message}</p>
              <div className="notification-meta">{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
            {n.user_id != null && !n.is_read && <button className="btn btn-secondary btn-sm" onClick={() => markRead(n.id)}>Mark Read</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Notifications;
