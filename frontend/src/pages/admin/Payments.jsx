import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Payments() {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showOfflineForm, setShowOfflineForm] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showScreenshot, setShowScreenshot] = useState(null);
  const [offlineForm, setOfflineForm] = useState({
    student_email: "", fee_plan_id: "", seat_id: "", amount: "",
    payment_method: "cash", payment_date: new Date().toISOString().split("T")[0],
    start_date: "", end_date: "", notes: "",
  });
  const [feePlans, setFeePlans] = useState([]);
  const [seats, setSeats] = useState([]);
  const [submittingOffline, setSubmittingOffline] = useState(false);

  const fetchPayments = () => {
    adminAPI.getPayments()
      .then(setPayments)
      .catch(() => toast.error("Failed to load payments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    adminAPI.getPayments()
      .then(setPayments)
      .catch(() => toast.error("Failed to load payments"))
      .finally(() => setLoading(false));
    adminAPI.getFeePlans().then(setFeePlans).catch(() => {});
    adminAPI.getSeats().then(setSeats).catch(() => {});
  }, [toast]);

  const handleApprove = async (id) => {
    setActionId(id);
    try { await adminAPI.approvePayment(id); toast.success("Payment approved"); fetchPayments(); }
    catch (err) { toast.error(err.message); } finally { setActionId(null); }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setActionId(rejectId);
    try { await adminAPI.rejectPayment(rejectId, rejectReason); toast.success("Payment rejected"); setRejectId(null); setRejectReason(""); fetchPayments(); }
    catch (err) { toast.error(err.message); } finally { setActionId(null); }
  };

  const viewScreenshot = async (id) => {
    try {
      const url = await adminAPI.getPaymentScreenshot(id);
      setShowScreenshot(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closeScreenshot = () => {
    if (showScreenshot) URL.revokeObjectURL(showScreenshot);
    setShowScreenshot(null);
  };

  const handleOfflineSubmit = async (e) => {
    e.preventDefault();
    setSubmittingOffline(true);
    try {
      const payload = {
        ...offlineForm,
        seat_id: Number(offlineForm.seat_id),
        fee_plan_id: Number(offlineForm.fee_plan_id),
        amount: Number(offlineForm.amount),
      };
      await adminAPI.createOfflineBooking(payload);
      toast.success("Offline booking created!");
      setShowOfflineForm(false);
      setOfflineForm({ student_email: "", fee_plan_id: "", seat_id: "", amount: "", payment_method: "cash", payment_date: new Date().toISOString().split("T")[0], start_date: "", end_date: "", notes: "" });
      fetchPayments();
    } catch (err) { toast.error(err.message); } finally { setSubmittingOffline(false); }
  };

  const filtered = payments.filter((p) => {
    const matchesSearch = p.user_name?.toLowerCase().includes(search.toLowerCase()) || p.plan_name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || p.method === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Payments</h1>
          <div className="subtitle">{payments.length} total payments &bull; {pendingCount} pending</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowOfflineForm(!showOfflineForm)}>
          {showOfflineForm ? "Cancel" : "+ Offline Booking"}
        </button>
      </div>

      {showOfflineForm && (
        <div className="form-card" style={{ maxWidth: 600 }}>
          <h2>Create Offline Booking</h2>
          <form onSubmit={handleOfflineSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Student Email</label>
                <input type="email" value={offlineForm.student_email} onChange={(e) => setOfflineForm({ ...offlineForm, student_email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Fee Plan</label>
                <select value={offlineForm.fee_plan_id} onChange={(e) => setOfflineForm({ ...offlineForm, fee_plan_id: e.target.value })} required>
                  <option value="">Select Plan</option>
                  {feePlans.map((fp) => (<option key={fp.id} value={fp.id}>{fp.name} - &#8377;{fp.price}</option>))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Seat</label>
                <select value={offlineForm.seat_id} onChange={(e) => setOfflineForm({ ...offlineForm, seat_id: e.target.value })} required>
                  <option value="">Select Seat</option>
                  {seats.map((s) => (<option key={s.id} value={s.id}>{s.seat_number} ({s.room_name})</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input type="number" value={offlineForm.amount} onChange={(e) => setOfflineForm({ ...offlineForm, amount: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Payment Method</label>
                <select value={offlineForm.payment_method} onChange={(e) => setOfflineForm({ ...offlineForm, payment_method: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div className="form-group">
                <label>Payment Date</label>
                <input type="date" value={offlineForm.payment_date} onChange={(e) => setOfflineForm({ ...offlineForm, payment_date: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={offlineForm.start_date} onChange={(e) => setOfflineForm({ ...offlineForm, start_date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" value={offlineForm.end_date} onChange={(e) => setOfflineForm({ ...offlineForm, end_date: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={offlineForm.notes} onChange={(e) => setOfflineForm({ ...offlineForm, notes: e.target.value })} rows={3} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submittingOffline}>
              {submittingOffline ? "Creating..." : "Create Booking"}
            </button>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-bar" style={{ marginBottom: 0, flex: 1 }}>
          <input type="text" placeholder="Search by student or plan..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><h3>No payments found</h3></div>
      ) : (
        <div className="table-container seats-table-card">
          <table>
            <thead>
              <tr><th>Student</th><th>Plan</th><th>Amount</th><th>Type</th><th>Source</th><th>UTR</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td data-label="Student">{p.user_name}</td>
                  <td data-label="Plan">{p.plan_name}</td>
                  <td data-label="Amount">&#8377;{p.amount}</td>
                  <td data-label="Type">{p.method?.toUpperCase()}</td>
                  <td data-label="Source">
                    {p.booking_source ? (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.8em",
                        fontWeight: 600,
                        background: p.booking_source === "online" ? "#16a34a20" : "#f59e0b20",
                        color: p.booking_source === "online" ? "#16a34a" : "#f59e0b",
                      }}>
                        {p.booking_source === "online" ? "Online" : "Offline"}
                      </span>
                    ) : p.payment_type?.startsWith("offline") ? (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.8em",
                        fontWeight: 600,
                        background: "#f59e0b20",
                        color: "#f59e0b",
                      }}>
                        Offline
                      </span>
                    ) : "\u2014"}
                  </td>
                  <td data-label="UTR">{p.utr_number || "\u2014"}</td>
                  <td data-label="Status"><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                  <td data-label="Date">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td data-label="Actions" className="actions-cell">
                    {p.has_screenshot && (
                      <button className="btn btn-secondary btn-sm" onClick={() => viewScreenshot(p.id)}>View</button>
                    )}
                    {p.status === "pending" && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(p.id)} disabled={actionId === p.id}>
                          {actionId === p.id ? "..." : "Approve"}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setRejectId(p.id)}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectId && (
        <div className="modal-overlay" onClick={() => setRejectId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Payment</h2>
              <button className="modal-close" onClick={() => setRejectId(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Reason for Rejection</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason..." rows={3} />
              </div>
              <button className="btn btn-danger" onClick={handleReject} disabled={actionId === rejectId} style={{ marginTop: 12 }}>
                {actionId === rejectId ? "Rejecting..." : "Reject Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScreenshot && (
        <div className="modal-overlay" onClick={closeScreenshot}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Payment Screenshot</h2>
              <button className="modal-close" onClick={closeScreenshot}>&times;</button>
            </div>
            <div className="modal-body">
              <img src={showScreenshot} alt="Payment screenshot" style={{ width: "100%", borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments;
