import { useState, useEffect, useRef } from "react";
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
    student_name: "", student_email: "", phone: "",
    fee_plan_id: "", seat_id: "", amount: "",
    payment_method: "cash", payment_date: new Date().toISOString().split("T")[0],
    start_date: "", end_date: "", notes: "",
  });
  const [feePlans, setFeePlans] = useState([]);
  const [seats, setSeats] = useState([]);
  const [submittingOffline, setSubmittingOffline] = useState(false);
  // Slot selection for the offline booking (mirrors the Seats page modal)
  const [offlineSlots, setOfflineSlots] = useState([]);
  const [offlineSlotIds, setOfflineSlotIds] = useState([]);
  const [offlineQuote, setOfflineQuote] = useState(null);
  const [offlineQuoting, setOfflineQuoting] = useState(false);
  const offlineQuoteReqRef = useRef(0);
  // Ref (not state): consulted only inside handlers — tracks whether the
  // admin manually edited the amount (so quotes never overwrite their input).
  const offlineAmountTouchedRef = useRef(false);

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
    adminAPI.getFeePlans()
      .then((plans) => setFeePlans(plans.filter((p) => p.is_active)))
      .catch(() => {});
    adminAPI.getSeats().then(setSeats).catch(() => {});
  }, [toast]);

  // Reference price from the backend (configured combination price). It
  // prefills the editable amount field until the admin changes it — the
  // admin-entered amount stays the FINAL charged amount.
  const requestOfflineQuote = (ids) => {
    const reqId = ++offlineQuoteReqRef.current;
    if (!ids.length) {
      setOfflineQuote(null);
      setOfflineQuoting(false);
      return;
    }
    setOfflineQuoting(true);
    adminAPI.quoteSlots(ids)
      .then((d) => {
        if (reqId !== offlineQuoteReqRef.current) return;
        setOfflineQuote(d.price);
        if (!offlineAmountTouchedRef.current) {
          setOfflineForm((prev) => ({ ...prev, amount: String(d.price) }));
        }
      })
      .catch(() => {
        if (reqId !== offlineQuoteReqRef.current) return;
        setOfflineQuote(null);
        toast.error("Could not calculate the reference price");
      })
      .finally(() => { if (reqId === offlineQuoteReqRef.current) setOfflineQuoting(false); });
  };

  // The backend derives the membership's fee plan from the primary selected
  // slot — keep the dropdown truthful by auto-selecting the matching plan.
  const syncPlanToSlots = (ids) => {
    if (!ids.length) return;
    const primary = offlineSlots.find((s) => s.id === ids[0]);
    if (!primary) return;
    const match = feePlans.find(
      (p) => p.start_minute === primary.start_minute && p.end_minute === primary.end_minute
    );
    if (match) setOfflineForm((prev) => ({ ...prev, fee_plan_id: String(match.id) }));
  };

  const toggleOfflineSlot = (slot) => {
    if (slot.status !== "available") return;
    const next = offlineSlotIds.includes(slot.id)
      ? offlineSlotIds.filter((id) => id !== slot.id)
      : [...offlineSlotIds, slot.id].sort((a, b) => a - b);
    setOfflineSlotIds(next);
    syncPlanToSlots(next);
    requestOfflineQuote(next);
  };

  const handleOfflineSeatChange = (seatId) => {
    setOfflineForm((prev) => ({
      ...prev,
      seat_id: seatId,
      amount: offlineAmountTouchedRef.current ? prev.amount : "",
    }));
    setOfflineSlotIds([]);
    ++offlineQuoteReqRef.current;
    setOfflineQuote(null);
    setOfflineQuoting(false);
    setOfflineSlots([]);
    if (!seatId) return;
    adminAPI.getSeatSlots(Number(seatId))
      .then((d) => setOfflineSlots(d.slots || []))
      .catch(() => toast.error("Failed to load slot availability"));
  };

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
        student_email: offlineForm.student_email.trim(),
        student_name: offlineForm.student_name.trim(),
        phone: offlineForm.phone.trim(),
        seat_id: Number(offlineForm.seat_id),
        fee_plan_id: Number(offlineForm.fee_plan_id),
        amount: Number(offlineForm.amount),
      };
      if (offlineSlotIds.length) payload.slot_ids = offlineSlotIds;
      const res = await adminAPI.createOfflineBooking(payload);
      toast.success(res?.message || "Offline booking created successfully.");
      setShowOfflineForm(false);
      setOfflineForm({
        student_name: "", student_email: "", phone: "",
        fee_plan_id: "", seat_id: "", amount: "",
        payment_method: "cash", payment_date: new Date().toISOString().split("T")[0],
        start_date: "", end_date: "", notes: "",
      });
      setOfflineSlots([]);
      setOfflineSlotIds([]);
      ++offlineQuoteReqRef.current;
      setOfflineQuote(null);
      setOfflineQuoting(false);
      offlineAmountTouchedRef.current = false;
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
        <button
          className="btn btn-primary"
          onClick={() => {
            const next = !showOfflineForm;
            setShowOfflineForm(next);
            if (!next) {
              setOfflineSlots([]);
              setOfflineSlotIds([]);
              ++offlineQuoteReqRef.current;
              setOfflineQuote(null);
              setOfflineQuoting(false);
              offlineAmountTouchedRef.current = false;
            }
          }}
        >
          {showOfflineForm ? "Cancel" : "+ Offline Booking"}
        </button>
      </div>

      {showOfflineForm && (
        <div className="form-card" style={{ maxWidth: 600 }}>
          <h2>Create Offline Booking</h2>
          <form onSubmit={handleOfflineSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Student Name</label>
                <input type="text" value={offlineForm.student_name} onChange={(e) => setOfflineForm({ ...offlineForm, student_name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Student Email</label>
                <input type="email" value={offlineForm.student_email} onChange={(e) => setOfflineForm({ ...offlineForm, student_email: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone Number</label>
                <input type="tel" value={offlineForm.phone} onChange={(e) => setOfflineForm({ ...offlineForm, phone: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Fee Plan</label>
                <select
                  value={offlineForm.fee_plan_id}
                  onChange={(e) => {
                    const plan = feePlans.find((p) => p.id === Number(e.target.value));
                    setOfflineForm((prev) => ({
                      ...prev,
                      fee_plan_id: e.target.value,
                      amount:
                        offlineAmountTouchedRef.current || !plan || offlineSlotIds.length
                          ? prev.amount
                          : String(plan.price),
                    }));
                  }}
                  required
                >
                  <option value="">Select Plan</option>
                  {feePlans.map((fp) => (<option key={fp.id} value={fp.id}>{fp.name} - &#8377;{fp.price}</option>))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Seat</label>
                <select value={offlineForm.seat_id} onChange={(e) => handleOfflineSeatChange(e.target.value)} required>
                  <option value="">Select Seat</option>
                  {seats.map((s) => (<option key={s.id} value={s.id}>{s.seat_number} ({s.room_name})</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>Final Amount Paid</label>
                <input
                  type="number"
                  min="1"
                  value={offlineForm.amount}
                  onChange={(e) => {
                    offlineAmountTouchedRef.current = true;
                    setOfflineForm({ ...offlineForm, amount: e.target.value });
                  }}
                  required
                />
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {offlineSlotIds.length
                    ? offlineQuoting
                      ? "Calculating reference price\u2026"
                      : offlineQuote !== null
                        ? `Default / reference price: \u20B9${offlineQuote} \u2014 editable`
                        : "Reference price unavailable \u2014 the amount you enter is final."
                    : offlineForm.fee_plan_id
                      ? `Default / reference price: \u20B9${feePlans.find((p) => p.id === Number(offlineForm.fee_plan_id))?.price ?? "\u2014"} \u2014 editable`
                      : "The amount you enter is the final charged amount."}
                </small>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 4 }}>
              <label>Access Slots (optional — books only the selected timings)</label>
              <div className="slot-options">
                {offlineSlots.map((slot) => {
                  const isSelected = offlineSlotIds.includes(slot.id);
                  const isBooked = slot.status !== "available";
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`slot-option${isSelected ? " selected" : ""}${isBooked ? " unavailable" : ""}`}
                      disabled={isBooked}
                      onClick={() => toggleOfflineSlot(slot)}
                      title={slot.booked_by ? `Booked by ${slot.booked_by}` : slot.name}
                    >
                      <span className="slot-name">{slot.name}</span>
                      <span className="slot-status">
                        {isSelected
                          ? "Selected"
                          : isBooked
                            ? slot.booked_by ? `Booked — ${slot.booked_by}` : "Booked"
                            : "Available"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {offlineForm.seat_id && offlineSlots.length === 0 && (
                <div className="slot-empty">Loading availability&hellip;</div>
              )}
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                {offlineSlotIds.length
                  ? `Selected Slots: ${offlineSlots.filter((s) => offlineSlotIds.includes(s.id)).map((s) => s.name).join(", ")}`
                  : "No slots selected — pick a Fee Plan above for a plan-based booking."}
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                submittingOffline ||
                offlineQuoting ||
                !offlineForm.amount ||
                !Number.isInteger(Number(offlineForm.amount)) ||
                Number(offlineForm.amount) < 0
              }
            >
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
