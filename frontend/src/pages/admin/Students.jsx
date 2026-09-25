import { useState, useEffect, useCallback, useRef } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

const pad2 = (n) => String(n).padStart(2, "0");

// Builds YYYY-MM-DD from local calendar parts (never via toISOString, which
// would shift the day near midnight for non-UTC timezones).
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const defaultRenewStartDate = () => toISODate(new Date());

const defaultRenewEndDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toISODate(d);
};

// Validates a strict YYYY-MM-DD calendar date (rejects e.g. 2026-02-30).
const isValidDateInput = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

function Students() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [assignModal, setAssignModal] = useState(null);
  const [availableSeats, setAvailableSeats] = useState([]);
  const [selectedSeatId, setSelectedSeatId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [viewModal, setViewModal] = useState(null);
  const [viewJoining, setViewJoining] = useState("");
  const [savingJoining, setSavingJoining] = useState(false);

  const [renewModal, setRenewModal] = useState(null);
  const [feePlans, setFeePlans] = useState([]);
  const [renewForm, setRenewForm] = useState({
    fee_plan_id: "",
    amount: "",
    admin_note: "",
    start_date: "",
    end_date: "",
  });
  const [renewing, setRenewing] = useState(false);
  const [renewSlots, setRenewSlots] = useState([]);
  const [renewSlotIds, setRenewSlotIds] = useState([]);
  const [renewQuote, setRenewQuote] = useState(null);
  const [renewQuoting, setRenewQuoting] = useState(false);
  // Ref (not state): only consulted inside handlers, never rendered.
  const renewAmountTouchedRef = useRef(false);
  const renewQuoteReqRef = useRef(0);

  const fetchStudents = useCallback(() => {
    adminAPI.getStudents()
      .then(setStudents)
      .catch(() => toast.error("Failed to load students"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search)
  );

  const openAssignModal = async (student) => {
    setAssignModal(student);
    setSelectedSeatId("");
    try {
      const seats = await adminAPI.getAvailableSeats();
      setAvailableSeats(seats);
    } catch {
      toast.error("Failed to load available seats");
    }
  };

  const handleAssignSeat = async () => {
    if (!selectedSeatId || !assignModal) return;
    const seat = availableSeats.find((s) => s.id === Number(selectedSeatId));
    if (!seat) return;

    const hasSeat = !!assignModal.current_seat;
    const confirmMsg = hasSeat
      ? `Change seat from ${assignModal.current_seat} to ${seat.seat_number}?`
      : `Assign seat ${seat.seat_number} to ${assignModal.name}?`;

    if (!window.confirm(confirmMsg)) return;

    setAssigning(true);
    try {
      const result = await adminAPI.assignSeat(assignModal.id, Number(selectedSeatId));
      toast.success(result.message);
      setAssignModal(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const openRenewModal = async (student) => {
    setRenewModal(student);
    // Dates are seeded once as editable defaults and are never overwritten
    // afterwards — only the admin's own selections change them.
    setRenewForm({
      fee_plan_id: "",
      amount: "",
      admin_note: "",
      start_date: defaultRenewStartDate(),
      end_date: defaultRenewEndDate(),
    });
    setRenewSlots([]);
    setRenewSlotIds([]);
    ++renewQuoteReqRef.current;
    setRenewQuote(null);
    setRenewQuoting(false);
    renewAmountTouchedRef.current = false;
    // Load per-slot availability for the student's current seat (if any).
    if (student.seat_id) {
      adminAPI.getSeatSlots(student.seat_id)
        .then((d) => setRenewSlots(d.slots || []))
        .catch(() => toast.error("Failed to load slot availability"));
    }
    try {
      const plans = await adminAPI.getFeePlans();
      setFeePlans(plans.filter((p) => p.is_active));
    } catch {
      toast.error("Failed to load fee plans");
    }
  };

  // Reference price = configured combination price from the backend quote.
  // It is shown to the admin as a reference only — the amount stays editable
  // and the admin-entered amount is the final charged amount.
  const requestRenewQuote = (ids) => {
    const reqId = ++renewQuoteReqRef.current;
    if (!ids.length) {
      setRenewQuote(null);
      setRenewQuoting(false);
      return;
    }
    setRenewQuoting(true);
    adminAPI.quoteSlots(ids)
      .then((d) => {
        if (reqId !== renewQuoteReqRef.current) return;
        setRenewQuote(d.price);
        if (!renewAmountTouchedRef.current) {
          setRenewForm((prev) => ({ ...prev, amount: String(d.price) }));
        }
      })
      .catch(() => {
        if (reqId !== renewQuoteReqRef.current) return;
        setRenewQuote(null);
        toast.error("Could not calculate the reference price");
      })
      .finally(() => { if (reqId === renewQuoteReqRef.current) setRenewQuoting(false); });
  };

  // The backend derives the renewal's fee plan from the primary selected
  // slot — keep the dropdown truthful by auto-selecting the matching plan.
  const syncRenewPlanToSlots = (ids) => {
    if (!ids.length) return;
    const primary = renewSlots.find((s) => s.id === ids[0]);
    if (!primary) return;
    const match = feePlans.find(
      (p) => p.start_minute === primary.start_minute && p.end_minute === primary.end_minute
    );
    if (match) {
      setRenewForm((prev) => ({ ...prev, fee_plan_id: String(match.id) }));
    }
  };

  const toggleRenewSlot = (slot) => {
    if (slot.status !== "available" && !renewSlotIds.includes(slot.id)) return;
    const next = renewSlotIds.includes(slot.id)
      ? renewSlotIds.filter((id) => id !== slot.id)
      : [...renewSlotIds, slot.id].sort((a, b) => a - b);
    setRenewSlotIds(next);
    syncRenewPlanToSlots(next);
    requestRenewQuote(next);
  };

  const handleRenewPlanChange = (planId) => {
    const plan = feePlans.find((p) => p.id === Number(planId));
    setRenewForm((prev) => ({
      ...prev,
      fee_plan_id: planId,
      amount: renewAmountTouchedRef.current
        ? prev.amount
        : String(renewQuote ?? (plan ? plan.price : "")),
    }));
  };

  const datesValid =
    isValidDateInput(renewForm.start_date) &&
    isValidDateInput(renewForm.end_date) &&
    renewForm.end_date > renewForm.start_date;

  const handleSaveJoining = async () => {
    if (!viewModal || !viewJoining || savingJoining) return;
    setSavingJoining(true);
    try {
      await adminAPI.updateStudent(viewModal.id, { joining_date: viewJoining });
      toast.success("Joining date updated");
      fetchStudents();
    } catch (err) {
      toast.error(err?.message || "Failed to update joining date");
    } finally {
      setSavingJoining(false);
    }
  };

  const handleRenew = async () => {
    if (!renewModal || !renewForm.fee_plan_id || !renewForm.amount) return;

    const renewAmountNum = Number(renewForm.amount);
    if (!Number.isInteger(renewAmountNum) || renewAmountNum < 0) {
      toast.error("Amount must be a whole number of rupees (0 or more)");
      return;
    }
    if (!renewForm.start_date || !isValidDateInput(renewForm.start_date)) {
      toast.error("Please select a valid Start Date");
      return;
    }
    if (!renewForm.end_date || !isValidDateInput(renewForm.end_date)) {
      toast.error("Please select a valid New Expiry Date");
      return;
    }
    if (renewForm.end_date <= renewForm.start_date) {
      toast.error("New Expiry Date must be after Start Date");
      return;
    }

    setRenewing(true);
    try {
      const payload = {
        student_id: renewModal.id,
        fee_plan_id: Number(renewForm.fee_plan_id),
        amount: Number(renewForm.amount),
        payment_method: "cash",
        admin_note: renewForm.admin_note,
        start_date: renewForm.start_date,
        end_date: renewForm.end_date,
      };
      if (renewSlotIds.length) payload.slot_ids = renewSlotIds;
      const result = await adminAPI.renewMembership(payload);
      toast.success(result.message);
      setRenewModal(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRenewing(false);
    }
  };

  const isExpired = (s) => s.membership_status !== "active" && s.membership_status !== "pending";
  const activeCount = students.filter((s) => s.membership_status === "active").length;

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Students</h1>
          <div className="subtitle">{students.length} student{students.length !== 1 ? "s" : ""} &bull; {activeCount} active member{activeCount !== 1 ? "s" : ""}</div>
        </div>
      </div>

      <div className="search-bar">
        <input type="text" placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><h3>No students found</h3></div>
      ) : (
        <div className="table-container seats-table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Membership</th>
                <th>Seat</th>
                <th>Source</th>
                <th>Expiry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td data-label="Name">{s.name}</td>
                  <td data-label="Email">{s.email}</td>
                  <td data-label="Phone">{s.phone || "\u2014"}</td>
                  <td data-label="Membership">
                    <span className={`status-badge ${s.membership_status === "active" ? "status-active" : s.membership_status === "pending" ? "status-pending" : s.membership_status === "expired" ? "status-expired" : "status-expired"}`}>
                      {s.membership_status || "None"}
                    </span>
                  </td>
                  <td data-label="Seat"><strong>{s.current_seat || "\u2014"}</strong></td>
                  <td data-label="Source">
                    {s.booking_source ? (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.8em",
                        fontWeight: 600,
                        background: s.booking_source === "online" ? "#16a34a20" : "#f59e0b20",
                        color: s.booking_source === "online" ? "#16a34a" : "#f59e0b",
                      }}>
                        {s.booking_source === "online" ? "Online" : "Offline"}
                      </span>
                    ) : "\u2014"}
                  </td>
                  <td data-label="Expiry">{s.membership_expiry ? new Date(s.membership_expiry).toLocaleDateString() : "\u2014"}</td>
                  <td data-label="Actions" className="actions-cell">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setViewModal(s);
                        setViewJoining(s.created_at ? toISODate(new Date(s.created_at)) : "");
                      }}
                      style={{ marginRight: 4 }}
                    >
                      View
                    </button>
                    {isExpired(s) ? (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => openRenewModal(s)}
                      >
                        Renew
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openAssignModal(s)}
                      >
                        {s.current_seat ? "Change Seat" : "Assign Seat"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{assignModal.current_seat ? "Change Seat" : "Assign Seat"}</h2>
              <button className="modal-close" onClick={() => setAssignModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p><strong>Student:</strong> {assignModal.name}</p>
              <p><strong>Email:</strong> {assignModal.email}</p>
              <p><strong>Current Seat:</strong> {assignModal.current_seat || "None"}</p>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Select Available Seat</label>
                <select
                  value={selectedSeatId}
                  onChange={(e) => setSelectedSeatId(e.target.value)}
                  className="form-control"
                >
                  <option value="">Choose a seat...</option>
                  {availableSeats.map((seat) => (
                    <option key={seat.id} value={seat.id}>
                      {seat.seat_number} ({seat.room_name})
                    </option>
                  ))}
                </select>
              </div>

              {availableSeats.length === 0 && (
                <p style={{ color: "#f59e0b", marginTop: 8 }}>No available seats at the moment.</p>
              )}

              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setAssignModal(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleAssignSeat}
                  disabled={!selectedSeatId || assigning}
                >
                  {assigning ? "Assigning..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Student Details</h2>
              <button className="modal-close" onClick={() => setViewModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p><strong>Name:</strong> {viewModal.name}</p>
              <p><strong>Email:</strong> {viewModal.email}</p>
              <p><strong>Phone:</strong> {viewModal.phone || "\u2014"}</p>
              <p style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>Joining Date:</strong>
                <input
                  type="date"
                  className="form-control"
                  style={{ width: "auto", padding: "4px 8px" }}
                  value={viewJoining}
                  onChange={(e) => setViewJoining(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveJoining}
                  disabled={!viewJoining || savingJoining}
                >
                  {savingJoining ? "Saving..." : "Save"}
                </button>
              </p>
              <p><strong>Membership:</strong> {viewModal.membership_status || "None"}</p>
              <p><strong>Plan:</strong> {viewModal.plan_name || "\u2014"}</p>
              <p><strong>Membership Start:</strong> {viewModal.membership_start_label || "\u2014"}</p>
              <p><strong>Membership Expiry:</strong> {viewModal.membership_expiry_label || "\u2014"}</p>
              <p><strong>Selected Slots:</strong> {viewModal.current_slots || "\u2014"}</p>
              <p><strong>Seat:</strong> {viewModal.current_seat || "No Active Seat"}</p>
              <p><strong>Room:</strong> {viewModal.current_room || "\u2014"}</p>
              <p><strong>Booking Source:</strong> {viewModal.booking_source ? (viewModal.booking_source === "online" ? "Online" : "Offline") : "\u2014"}</p>
              <p><strong>Booking Status:</strong> {viewModal.booking_status ? viewModal.booking_status.charAt(0).toUpperCase() + viewModal.booking_status.slice(1) : "\u2014"}</p>
              <p><strong>Booked On:</strong> {viewModal.booked_at ? new Date(viewModal.booked_at).toLocaleDateString() : "\u2014"}</p>
              <p><strong>Booking Period:</strong> {viewModal.booking_start && viewModal.booking_end ? `${new Date(viewModal.booking_start).toLocaleDateString()} \u2013 ${new Date(viewModal.booking_end).toLocaleDateString()}` : "\u2014"}</p>
              <p><strong>Payment Status:</strong> {viewModal.payment_status ? viewModal.payment_status.charAt(0).toUpperCase() + viewModal.payment_status.slice(1) : "\u2014"}</p>
              <p><strong>Payment Date:</strong> {viewModal.payment_date ? new Date(viewModal.payment_date).toLocaleDateString() : "\u2014"}</p>
              <p>
                <strong>Actual Payment Amount:</strong>{" "}
                {viewModal.payment_amount != null
                  ? `\u20B9${viewModal.payment_amount}${viewModal.payment_reference_amount != null && viewModal.payment_reference_amount !== viewModal.payment_amount ? ` (reference: \u20B9${viewModal.payment_reference_amount})` : ""}`
                  : "\u2014"}
              </p>
              <p><strong>Account:</strong> {viewModal.password_set === false ? "Password Not Set" : "Password Set"}</p>

              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setViewModal(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renewModal && (
        <div className="modal-overlay" onClick={() => setRenewModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Renew Membership</h2>
              <button className="modal-close" onClick={() => setRenewModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p><strong>Student:</strong> {renewModal.name}</p>
              <p><strong>Email:</strong> {renewModal.email}</p>
              <p>
                <strong>Current Status:</strong>{" "}
                <span className={`status-badge status-expired`}>
                  {renewModal.membership_status || "None"}
                </span>
              </p>
              <p><strong>Current Expiry:</strong> {renewModal.membership_expiry_label || (renewModal.membership_expiry ? new Date(renewModal.membership_expiry).toLocaleDateString("en-IN") : "\u2014")}</p>
              <p><strong>Seat:</strong> {renewModal.current_seat ? `${renewModal.current_seat}${renewModal.current_room ? ` \u2014 ${renewModal.current_room}` : ""}` : "No seat on record"}</p>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Timing / Fee Plan</label>
                <select
                  value={renewForm.fee_plan_id}
                  onChange={(e) => handleRenewPlanChange(e.target.value)}
                  className="form-control"
                >
                  <option value="">Select a plan...</option>
                  {feePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — ₹{plan.price}
                    </option>
                  ))}
                </select>
              </div>

              {renewModal.seat_id ? (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Available Slots</label>
                  <div className="slot-options">
                    {renewSlots.map((slot) => {
                      const isSelected = renewSlotIds.includes(slot.id);
                      const isBooked = slot.status !== "available" && !isSelected;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          className={`slot-option${isSelected ? " selected" : ""}${isBooked ? " unavailable" : ""}`}
                          disabled={isBooked}
                          onClick={() => toggleRenewSlot(slot)}
                          title={slot.booked_by ? `Booked by ${slot.booked_by}` : slot.name}
                        >
                          <span className="slot-name">{slot.name}</span>
                          <span className="slot-status">
                            {isSelected ? "Selected" : slot.booked_by ? `Booked — ${slot.booked_by}` : isBooked ? "Booked" : "Available"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {renewSlots.length === 0 && (
                    <div className="slot-empty">Loading availability&hellip;</div>
                  )}
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                    {renewSlotIds.length
                      ? `Selected Slots: ${renewSlots.filter((s) => renewSlotIds.includes(s.id)).map((s) => s.name).join(", ")}`
                      : "No slots selected — the seat/day is not assumed to be fully booked."}
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Slots</label>
                  <div className="slot-empty">No seat on record — assign a seat to select slots.</div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Amount (₹) — Final amount charged</label>
                <input
                  type="number"
                  value={renewForm.amount}
                  onChange={(e) => {
                    renewAmountTouchedRef.current = true;
                    setRenewForm((prev) => ({ ...prev, amount: e.target.value }));
                  }}
                  className="form-control"
                  min="1"
                />
                <small style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {renewSlotIds.length
                    ? renewQuoting
                      ? "Calculating reference price\u2026"
                      : renewQuote !== null
                        ? `Default / reference price: ₹${renewQuote} — editable`
                        : "Reference price unavailable — the amount you enter is final."
                    : renewForm.fee_plan_id && renewQuote === null
                      ? `Default / reference price: ₹${feePlans.find((p) => p.id === Number(renewForm.fee_plan_id))?.price ?? "\u2014"} — editable`
                      : "The amount you enter is the final charged amount."}
                </small>
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Payment Method</label>
                <input
                  type="text"
                  value="Offline / Cash"
                  className="form-control"
                  readOnly
                  style={{ opacity: 0.7, cursor: "not-allowed" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={renewForm.start_date}
                    onChange={(e) => setRenewForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="form-control"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>New Expiry Date</label>
                  <input
                    type="date"
                    value={renewForm.end_date}
                    onChange={(e) => setRenewForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="form-control"
                  />
                </div>
              </div>

              {renewForm.start_date && renewForm.end_date && !datesValid && (
                <p style={{ color: "#ef4444", marginTop: 8, fontSize: 13 }}>
                  New Expiry Date must be a valid date after Start Date.
                </p>
              )}

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Admin Note (optional)</label>
                <textarea
                  value={renewForm.admin_note}
                  onChange={(e) => setRenewForm((prev) => ({ ...prev, admin_note: e.target.value }))}
                  className="form-control"
                  rows={2}
                  placeholder="Optional note..."
                />
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setRenewModal(null)}>Cancel</button>
                <button
                  className="btn btn-success"
                  onClick={handleRenew}
                  disabled={!renewForm.fee_plan_id || !renewForm.amount || !datesValid || renewing}
                >
                  {renewing ? "Renewing..." : "Confirm Renewal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Students;
