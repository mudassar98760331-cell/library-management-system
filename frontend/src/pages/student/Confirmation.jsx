import { useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

function formatDate(value) {
  if (!value) return "\u2014";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-IN");
}

function Confirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { seat, slots = [], amount, utrNumber, timestamp, membershipStart, membershipExpiry } = location.state || {};

  useEffect(() => {
    if (!seat || !slots.length) { navigate("/student/seat-booking"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!seat || !slots.length) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Student Portal</div>
          <h1>&#10003; Booking Confirmed</h1>
          <div className="subtitle">Your membership and seat booking has been submitted</div>
        </div>
      </div>

      <div className="booking-stepper">
        <div className="stepper-step completed"><div className="stepper-number">&#10003;</div><span>Membership</span></div>
        <div className="stepper-line active" />
        <div className="stepper-step completed"><div className="stepper-number">&#10003;</div><span>Seat Selection</span></div>
        <div className="stepper-line active" />
        <div className="stepper-step completed"><div className="stepper-number">&#10003;</div><span>Payment</span></div>
        <div className="stepper-line active" />
        <div className="stepper-step active"><div className="stepper-number">4</div><span>Confirmation</span></div>
      </div>

      <div className="confirmation-card">
        <div className="confirmation-icon">&#10003;</div>
        <h2>Payment Submitted</h2>
        <p className="confirmation-subtitle">
          Your payment is being reviewed. You will be notified once the admin verifies it.
        </p>

        <div className="confirmation-details">
          <div className="confirmation-row">
            <span className="confirmation-label">Access Slots</span>
            <span className="confirmation-value">{slots.map((s) => s.name).join(", ")}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">Room</span>
            <span className="confirmation-value">{seat.room_name}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">Seat Number</span>
            <span className="confirmation-value">{seat.seat_number}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">Membership Start</span>
            <span className="confirmation-value">{formatDate(membershipStart)}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">Membership Expiry</span>
            <span className="confirmation-value">{formatDate(membershipExpiry)}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">Amount</span>
            <span className="confirmation-value amount">{amount != null ? `\u20B9${amount}` : "\u2014"}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">UTR / Reference</span>
            <span className="confirmation-value">{utrNumber || "\u2014"}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">Status</span>
            <span className="confirmation-value status-pending">Awaiting Verification</span>
          </div>
          {timestamp && (
            <div className="confirmation-row">
              <span className="confirmation-label">Submitted On</span>
              <span className="confirmation-value">{new Date(timestamp).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="confirmation-actions">
          <Link to="/student/dashboard" className="btn btn-primary">Go to Dashboard</Link>
          <Link to="/student/payment-history" className="btn btn-secondary">View Payment History</Link>
        </div>
      </div>
    </div>
  );
}

export default Confirmation;
