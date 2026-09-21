import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Dashboard() {
  const toast = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const hasShownToast = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load(isRetry) {
      if (!isRetry) setLoading(true);
      if (isRetry) setRetrying(true);
      setError(null);

      try {
        const data = await studentAPI.getDashboard();
        if (!cancelled) {
          setDashboard(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err.message || "Failed to load dashboard";
          setError(msg);
          if (!hasShownToast.current) {
            toast.error(msg);
            hasShownToast.current = true;
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRetrying(false);
        }
      }
    }

    load(false);
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    hasShownToast.current = false;
    setError(null);
    setRetrying(true);
    setLoading(false);

    studentAPI.getDashboard()
      .then((data) => {
        setDashboard(data);
        setError(null);
      })
      .catch((err) => {
        const msg = err.message || "Failed to load dashboard";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setLoading(false);
        setRetrying(false);
      });
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="empty-state">
        <h3>Failed to load dashboard</h3>
        <p style={{ color: "var(--text)", marginBottom: 16, fontSize: 13.5 }}>{error}</p>
        <button className="btn btn-primary" onClick={handleRetry} disabled={retrying}>
          {retrying ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="empty-state">
        <h3>No data available</h3>
        <p style={{ color: "var(--text)", marginBottom: 16, fontSize: 13.5 }}>Could not load dashboard data.</p>
        <button className="btn btn-primary" onClick={handleRetry} disabled={retrying}>
          {retrying ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  }

  const { user, membership, expired_membership, booking, payment, unreadNotifications } = dashboard;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const isExpired = !membership && expired_membership;

  const formatTime = (m) => {
    if (m == null) return "";
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const ap = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${ap}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Student Portal</div>
          <h1>{greeting}, {user?.name?.split(" ")[0] || "Student"} &#128075;</h1>
          <div className="subtitle">{isExpired ? "Your membership has expired. Renew to continue." : "Stay consistent, keep going!"}</div>
        </div>
      </div>

      {isExpired && (
        <div style={{
          background: "linear-gradient(135deg, #dc262620, #f59e0b20)",
          border: "1px solid #dc262640",
          borderRadius: "var(--radius)",
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 15 }}>&#9888; Membership Expired</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Your {expired_membership.plan_name} membership expired on {new Date(expired_membership.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
              {booking?.seat_number && ` Your seat ${booking.seat_number} has been released.`}
            </div>
          </div>
          <Link to="/student/membership" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
            Renew Membership &#8594;
          </Link>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-icon">&#128203;</div>
          <h3>Membership Status</h3>
          {membership ? (
            <>
              <div className="status-badge status-active">&#9989; Active</div>
              {membership.end_date && <p>Valid till {new Date(membership.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
            </>
          ) : expired_membership ? (
            <>
              <div className="status-badge status-expired">&#10060; Expired</div>
              <p>Expired on {new Date(expired_membership.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            </>
          ) : (
            <>
              <div className="status-badge status-expired">No Membership</div>
              <p><Link to="/student/membership" style={{ color: "var(--accent)" }}>Book your first seat</Link></p>
            </>
          )}
        </div>

        <div className="dashboard-card">
          <div className="card-icon">&#128186;</div>
          <h3>Assigned Seat</h3>
          {booking ? (
            <>
              <div className="status-badge status-active">R1 - {booking.seat_number}</div>
              {booking.room_name && <p>{booking.room_name}</p>}
              {booking.booking_source && (
                <p style={{ fontSize: 12, marginTop: 4 }}>
                  <span style={{
                    padding: "1px 6px", borderRadius: 4, fontWeight: 600,
                    background: booking.booking_source === "online" ? "#16a34a20" : "#f59e0b20",
                    color: booking.booking_source === "online" ? "#16a34a" : "#f59e0b",
                  }}>
                    {booking.booking_source === "online" ? "Online" : "Offline"}
                  </span>
                </p>
              )}
              {booking.plan_name && <p style={{ fontSize: 12, marginTop: 4 }}>{booking.plan_name}</p>}
              {booking.is_24_hour ? (
                <p style={{ fontSize: 12 }}>24 Hours Access</p>
              ) : (booking.start_minute != null && booking.end_minute != null) ? (
                <p style={{ fontSize: 12 }}>{formatTime(booking.start_minute)} – {formatTime(booking.end_minute)}</p>
              ) : null}
              {booking.booking_start && (
                <p style={{ fontSize: 12, marginTop: 2 }}>
                  {new Date(booking.booking_start).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {" – "}
                  {new Date(booking.booking_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="status-badge status-expired">{isExpired ? "Seat Released" : "No Seat"}</div>
              {isExpired && <p><Link to="/student/membership" style={{ color: "var(--accent)" }}>Book a new seat</Link></p>}
              {!isExpired && !membership && <p><Link to="/student/membership" style={{ color: "var(--accent)" }}>Select a plan to get started</Link></p>}
            </>
          )}
        </div>

        <div className="dashboard-card">
          <div className="card-icon">&#128179;</div>
          <h3>Payment Status</h3>
          <div className={`status-badge ${payment?.status === "completed" ? "status-active" : payment?.status === "pending" ? "status-pending" : "status-expired"}`}>
            {payment?.status === "completed" ? "\u2705 Verified" : payment?.status === "pending" ? "\u23F3 Pending" : "No Payment"}
          </div>
          {payment?.created_at && <p>Last payment: {new Date(payment.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
          {payment?.payment_type && payment.payment_type.startsWith("offline") && (
            <p style={{ fontSize: 12, marginTop: 2 }}>
              <span style={{
                padding: "1px 6px", borderRadius: 4, fontWeight: 600,
                background: "#f59e0b20", color: "#f59e0b",
              }}>
                {payment.method === "cash" ? "Cash" : "Offline UPI"}
              </span>
            </p>
          )}
        </div>

        <div className="dashboard-card">
          <div className="card-icon">&#128202;</div>
          <h3>Membership Plan</h3>
          <div className={`status-badge ${membership?.plan_name ? "status-active" : "status-expired"}`}>
            {membership?.plan_name || (expired_membership?.plan_name ? `${expired_membership.plan_name} (Expired)` : "No Plan")}
          </div>
          {membership?.plan_price && <p>&#8377;{membership.plan_price}</p>}
        </div>
      </div>

      <div className="dashboard-activity-grid">
        <div>
          <h2 style={{ marginBottom: 14 }}>Recent Activity</h2>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-card)', overflow: 'hidden' }}>
            {payment && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--success)' }}>&#10003;</span>
                  <span style={{ fontSize: 13 }}>Payment {payment.status}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(payment.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </div>
            )}
            {booking && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--accent)' }}>&#128186;</span>
                  <span style={{ fontSize: 13 }}>Seat assigned (R1 - {booking.seat_number})</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Today</span>
              </div>
            )}
            {membership && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--success)' }}>&#10003;</span>
                  <span style={{ fontSize: 13 }}>Membership activated</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{membership.created_at ? new Date(membership.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "\u2014"}</span>
              </div>
            )}
            {expired_membership && !membership && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#f59e0b' }}>&#9888;</span>
                  <span style={{ fontSize: 13 }}>Membership expired</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(expired_membership.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </div>
            )}
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--accent)' }}>&#128100;</span>
                <span style={{ fontSize: 13 }}>Account created</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "\u2014"}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: 14 }}>Quick Actions</h2>
          <div className="actions-grid">
            {isExpired ? (
              <Link to="/student/membership" className="action-card" style={{ border: '1px solid #f59e0b40', background: '#f59e0b08' }}>
                <div className="action-icon">&#128260;</div>
                <h3>Renew Membership</h3>
                <p>Book new seat</p>
              </Link>
            ) : (
              <Link to="/student/seat-booking" className="action-card">
                <div className="action-icon">&#128186;</div>
                <h3>View Seats</h3>
                <p>Browse and book</p>
              </Link>
            )}
            <Link to="/student/membership" className="action-card">
              <div className="action-icon">&#128179;</div>
              <h3>Make Payment</h3>
              <p>View plans</p>
            </Link>
            <Link to="/student/lost-found" className="action-card">
              <div className="action-icon">&#128270;</div>
              <h3>Lost & Found</h3>
              <p>Report items</p>
            </Link>
          </div>
        </div>
      </div>

      {unreadNotifications > 0 && (
        <div className="info-banner">
          <span>&#128232; You have {unreadNotifications} unread notification{unreadNotifications > 1 ? "s" : ""}</span>
          <Link to="/student/notifications" className="btn btn-secondary btn-sm">View</Link>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
