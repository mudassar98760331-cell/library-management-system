import { useState, useEffect, useRef } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function formatTiming(startMinute, endMinute, is24Hour) {
  if (is24Hour) return "24 Hours";
  const pad = (m) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };
  return `${pad(startMinute)} - ${pad(endMinute)}`;
}

function Seats() {
  const toast = useToast();
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineModal, setOfflineModal] = useState(null);
  const [feePlans, setFeePlans] = useState([]);
  const [submittingOffline, setSubmittingOffline] = useState(false);
  const [offlineSlots, setOfflineSlots] = useState([]);
  const [offlineSlotIds, setOfflineSlotIds] = useState([]);
  const [offlineQuote, setOfflineQuote] = useState(null);
  const [offlineQuoting, setOfflineQuoting] = useState(false);
  const offlineQuoteReqRef = useRef(0);
  // Ref (not state): consulted only inside handlers — tracks whether the
  // admin manually edited the amount (so quotes never overwrite their input).
  const offlineAmountTouchedRef = useRef(false);
  const [offlineForm, setOfflineForm] = useState({
    student_name: "",
    phone: "",
    student_email: "",
    seat_id: "",
    fee_plan_id: "",
    amount: "",
    payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0],
    start_date: "",
    end_date: "",
    notes: "",
  });

  const fetchSeats = () => {
    adminAPI.getSeats()
      .then(setSeats)
      .catch(() => toast.error("Failed to load seats"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    adminAPI.getSeats()
      .then(setSeats)
      .catch(() => toast.error("Failed to load seats"))
      .finally(() => setLoading(false));
    adminAPI.getFeePlans()
      .then((plans) => setFeePlans(plans.filter((p) => p.is_active)))
      .catch(() => { });
  }, [toast]);

  // The backend derives the membership's fee plan from the primary selected
  // slot — keep the dropdown truthful by auto-selecting the matching plan.
  const syncPlanToSlots = (ids, slotsArr) => {
    if (!ids.length) return;
    const primary = slotsArr.find((s) => s.id === ids[0]);
    if (!primary) return;
    const match = feePlans.find(
      (p) => p.start_minute === primary.start_minute && p.end_minute === primary.end_minute
    );
    if (match) setOfflineForm((prev) => ({ ...prev, fee_plan_id: String(match.id) }));
  };

  const handleStatusChange = async (seatId, newStatus) => {
    try {
      await adminAPI.updateSeatStatus(seatId, newStatus);
      toast.success("Seat status updated");
      setSeats((prev) => prev.map((s) => s.id === seatId ? { ...s, status: newStatus } : s));
    } catch (err) { toast.error(err.message); }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Cancel this booking and release the seat?")) return;
    try {
      await adminAPI.cancelBooking(bookingId);
      toast.success("Booking cancelled and seat released");
      fetchSeats();
    } catch (err) { toast.error(err.message); }
  };

  // Reference price from the backend (configured combination price). It is
  // displayed as the default/reference amount and prefills the editable
  // amount field until the admin changes it. The admin-entered amount is
  // the FINAL charged amount — the backend stores both values.
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

  const toggleOfflineSlot = (slot) => {
    if (slot.status !== "available") return;
    const next = offlineSlotIds.includes(slot.id)
      ? offlineSlotIds.filter((id) => id !== slot.id)
      : [...offlineSlotIds, slot.id].sort((a, b) => a - b);
    setOfflineSlotIds(next);
    syncPlanToSlots(next, offlineSlots);
    requestOfflineQuote(next);
  };

  const openOfflineModal = (seat) => {
    setOfflineForm({
      student_name: "",
      phone: "",
      student_email: "",
      seat_id: seat.id,
      fee_plan_id: "",
      amount: "",
      payment_method: "cash",
      payment_date: new Date().toISOString().split("T")[0],
      start_date: "",
      end_date: "",
      notes: "",
    });
    setOfflineSlots([]);
    setOfflineSlotIds([]);
    ++offlineQuoteReqRef.current;
    setOfflineQuote(null);
    setOfflineQuoting(false);
    offlineAmountTouchedRef.current = false;
    setOfflineModal(seat);
    adminAPI.getSeatSlots(seat.id)
      .then((d) => setOfflineSlots(d.slots || []))
      .catch(() => toast.error("Failed to load slot availability"));
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
      if (offlineSlotIds.length) payload.slot_ids = offlineSlotIds;
      await adminAPI.createOfflineBooking(payload);
      toast.success("Offline booking created successfully!");
      setOfflineModal(null);
      fetchSeats();
    } catch (err) { toast.error(err.message); }
    finally { setSubmittingOffline(false); }
  };

  const available = seats.filter((s) => s.status === "available").length;
  const booked = seats.filter((s) => s.status === "booked").length;
  const reserved = seats.filter((s) => s.status === "reserved").length;
  const disabled = seats.filter((s) => s.status === "disabled").length;

  const rooms = {};
  seats.forEach((s) => {
    if (!rooms[s.room_name]) rooms[s.room_name] = [];
    rooms[s.room_name].push(s);
  });

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Seats</h1>
          <div className="subtitle">Manage all {seats.length} seats across {Object.keys(rooms).length} rooms</div>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">&#128186;</div>
            <div><div className="stat-card-value">{available}</div><div className="stat-card-label">Available</div></div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">&#128186;</div>
            <div><div className="stat-card-value">{booked}</div><div className="stat-card-label">Booked</div></div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">&#128186;</div>
            <div><div className="stat-card-value">{reserved}</div><div className="stat-card-label">Reserved</div></div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">&#128683;</div>
            <div><div className="stat-card-value">{disabled}</div><div className="stat-card-label">Disabled</div></div>
          </div>
        </div>
      </div>

      {Object.entries(rooms).map(([roomName, roomSeats]) => (
        <div key={roomName} className="table-card seats-table-card" style={{ marginBottom: 16 }}>
          <h2>{roomName} ({roomSeats.length} seats)</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Seat</th>
                  <th>Status</th>
                  <th>Occupant</th>
                  <th>Booking Source</th>
                  <th>Membership</th>
                  <th>Timing</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roomSeats.map((s) => {
                  const source = s.booking_source;
                  const statusLabel = s.status === "booked" && source === "offline"
                    ? "Booked - Offline"
                    : s.status === "booked" && source === "online"
                      ? "Booked - Online"
                      : s.status.charAt(0).toUpperCase() + s.status.slice(1);

                  return (
                    <tr key={s.id}>
                      <td data-label="Seat"><strong>{s.seat_number}</strong></td>
                      <td data-label="Status">
                        <span className={`status-badge ${s.status === "available" ? "status-active" :
                            s.status === "booked" && source === "online" ? "status-rejected" :
                              s.status === "booked" && source === "offline" ? "status-pending" :
                                s.status === "reserved" ? "status-pending" :
                                  "status-pending"
                          }`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td data-label="Occupant">{s.occupied_by || "\u2014"}</td>
                      <td data-label="Source">
                        {source ? (
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: "0.8em",
                            fontWeight: 600,
                            background: source === "online" ? "#16a34a20" : "#f59e0b20",
                            color: source === "online" ? "#16a34a" : "#f59e0b",
                          }}>
                            {source === "online" ? "Online" : "Offline"}
                          </span>
                        ) : "\u2014"}
                      </td>
                      <td data-label="Membership">{s.fee_plan_name || "\u2014"}</td>
                      <td data-label="Timing">{s.start_minute != null ? formatTiming(s.start_minute, s.end_minute, s.is_24_hour) : "\u2014"}</td>
                      <td data-label="Payment">{s.payment_amount ? `₹${s.payment_amount}` : "\u2014"}</td>
                      <td data-label="Actions">
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {s.status === "available" && (
                            <>
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value === "disabled") handleStatusChange(s.id, "disabled");
                                  else if (e.target.value === "reserved") handleStatusChange(s.id, "reserved");
                                  else if (e.target.value === "offline") openOfflineModal(s);
                                }}
                                className="status-select"
                              >
                                <option value="">Actions...</option>
                                <option value="offline">Book Offline</option>
                                <option value="reserved">Reserve</option>
                                <option value="disabled">Disable</option>
                              </select>
                            </>
                          )}
                          {s.status === "booked" && (
                            <>
                              {s.booking_id && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleCancelBooking(s.booking_id)}
                                >
                                  Cancel
                                </button>
                              )}
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value === "disabled") handleStatusChange(s.id, "disabled");
                                  else if (e.target.value === "available") handleStatusChange(s.id, "available");
                                }}
                                className="status-select"
                              >
                                <option value="">Actions...</option>
                                <option value="available">Release Seat</option>
                                <option value="disabled">Disable</option>
                              </select>
                            </>
                          )}
                          {s.status === "reserved" && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value === "available") handleStatusChange(s.id, "available");
                                else if (e.target.value === "disabled") handleStatusChange(s.id, "disabled");
                                else if (e.target.value === "offline") openOfflineModal(s);
                              }}
                              className="status-select"
                            >
                              <option value="">Actions...</option>
                              <option value="offline">Book Offline</option>
                              <option value="available">Make Available</option>
                              <option value="disabled">Disable</option>
                            </select>
                          )}
                          {s.status === "disabled" && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value === "available") handleStatusChange(s.id, "available");
                                else if (e.target.value === "reserved") handleStatusChange(s.id, "reserved");
                              }}
                              className="status-select"
                            >
                              <option value="">Actions...</option>
                              <option value="available">Make Available</option>
                              <option value="reserved">Reserve</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {offlineModal && (
        <div className="modal-overlay" onClick={() => setOfflineModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>Offline Booking - {offlineModal.seat_number}</h2>
              <button className="modal-close" onClick={() => setOfflineModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleOfflineSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Student Name *</label>
                    <input type="text" value={offlineForm.student_name} onChange={(e) => setOfflineForm({ ...offlineForm, student_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Mobile Number *</label>
                    <input type="tel" value={offlineForm.phone} onChange={(e) => setOfflineForm({ ...offlineForm, phone: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Student Email</label>
                    <input type="email" value={offlineForm.student_email} onChange={(e) => setOfflineForm({ ...offlineForm, student_email: e.target.value })} placeholder="Optional - for account creation" />
                  </div>
                  <div className="form-group">
                    <label>Fee Plan *</label>
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
                  {offlineSlots.length === 0 && (
                    <div className="slot-empty">Loading availability&hellip;</div>
                  )}
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                    {offlineSlotIds.length
                      ? `Selected Slots: ${offlineSlots.filter((s) => offlineSlotIds.includes(s.id)).map((s) => s.name).join(", ")}`
                      : "No slots selected — the whole seat/day is not assumed to be booked."}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Final Amount Paid *</label>
                    <input
                      type="number"
                      min="1"
                      value={offlineForm.amount}
                      onChange={(e) => {
                        offlineAmountTouchedRef.current = true;
                        setOfflineForm({ ...offlineForm, amount: e.target.value });
                      }}
                      placeholder="Enter final amount to charge"
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
                  <div className="form-group">
                    <label>Payment Mode *</label>
                    <select value={offlineForm.payment_method} onChange={(e) => setOfflineForm({ ...offlineForm, payment_method: e.target.value })}>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input type="date" value={offlineForm.start_date} onChange={(e) => setOfflineForm({ ...offlineForm, start_date: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date *</label>
                    <input type="date" value={offlineForm.end_date} onChange={(e) => setOfflineForm({ ...offlineForm, end_date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea value={offlineForm.notes} onChange={(e) => setOfflineForm({ ...offlineForm, notes: e.target.value })} rows={3} placeholder="Optional notes..." />
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      submittingOffline ||
                      !offlineForm.amount ||
                      !Number.isInteger(Number(offlineForm.amount)) ||
                      Number(offlineForm.amount) < 0 ||
                      (offlineSlotIds.length > 0 && offlineQuoting)
                    }
                  >
                    {submittingOffline ? "Creating..." : "Create Offline Booking"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setOfflineModal(null)} style={{ marginLeft: 8 }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Seats;
