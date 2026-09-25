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
    adminAPI.getFeePlans().then(setFeePlans).catch(() => { });
  }, [toast]);

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

  // Slot pricing always comes from the backend quote — the amount field becomes
  // read-only whenever slots are selected. The request id guard ensures a stale
  // response never overwrites a newer selection's price.
  const requestOfflineQuote = (ids) => {
    const reqId = ++offlineQuoteReqRef.current;
    if (!ids.length) {
      setOfflineQuote(null);
      setOfflineQuoting(false);
      return;
    }
    setOfflineQuoting(true);
    adminAPI.quoteSlots(ids)
      .then((d) => { if (reqId === offlineQuoteReqRef.current) setOfflineQuote(d.price); })
      .catch(() => {
        if (reqId === offlineQuoteReqRef.current) {
          setOfflineQuote(null);
          toast.error("Could not calculate the price");
        }
      })
      .finally(() => { if (reqId === offlineQuoteReqRef.current) setOfflineQuoting(false); });
  };

  const toggleOfflineSlot = (slot) => {
    if (slot.status !== "available") return;
    const next = offlineSlotIds.includes(slot.id)
      ? offlineSlotIds.filter((id) => id !== slot.id)
      : [...offlineSlotIds, slot.id].sort((a, b) => a - b);
    setOfflineSlotIds(next);
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
    setOfflineModal(seat);
    adminAPI.getSeatSlots(seat.id)
      .then((d) => setOfflineSlots(d.slots || []))
      .catch(() => toast.error("Failed to load slot availability"));
  };

  const handleOfflineSubmit = async (e) => {
    e.preventDefault();
    setSubmittingOffline(true);
    try {
      const hasSlots = offlineSlotIds.length > 0;
      const payload = {
        ...offlineForm,
        seat_id: Number(offlineForm.seat_id),
        fee_plan_id: Number(offlineForm.fee_plan_id),
        amount: hasSlots ? offlineQuote : Number(offlineForm.amount),
      };
      if (hasSlots) payload.slot_ids = offlineSlotIds;
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
                    <select value={offlineForm.fee_plan_id} onChange={(e) => setOfflineForm({ ...offlineForm, fee_plan_id: e.target.value })} required>
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
                          title={isBooked ? "Already booked for this seat" : slot.name}
                        >
                          <span className="slot-name">{slot.name}</span>
                          <span className="slot-status">
                            {isBooked ? "Booked" : isSelected ? "Selected" : "Available"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {offlineSlots.length === 0 && (
                    <div className="slot-empty">Loading availability&hellip;</div>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Amount Paid *</label>
                    <input
                      type="number"
                      value={offlineSlotIds.length ? (offlineQuote ?? "") : offlineForm.amount}
                      onChange={(e) => setOfflineForm({ ...offlineForm, amount: e.target.value })}
                      readOnly={offlineSlotIds.length > 0}
                      placeholder={offlineSlotIds.length ? "Calculated from slots" : ""}
                      required
                    />
                    {offlineSlotIds.length > 0 && (
                      <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {offlineQuoting ? "Calculating\u2026" : "Auto-calculated from the selected slots"}
                      </small>
                    )}
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
                    disabled={submittingOffline || (offlineSlotIds.length > 0 && (offlineQuoting || offlineQuote === null))}
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
