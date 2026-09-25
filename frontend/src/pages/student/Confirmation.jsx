import { useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

function Confirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { plan, seat, slots = [], amount, utrNumber, timestamp } = location.state || {};

  useEffect(() => {
    if (!plan || !seat) { navigate("/student/membership"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan || !seat) return null;

  const formatTime = (m) => {
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
            <span className="confirmation-label">Membership Plan</span>
            <span className="confirmation-value">{plan.name}</span>
          </div>
          <div className="confirmation-row">
            <span className="confirmation-label">{slots.length ? "Access Slots" : "Timing"}</span>
            <span className="confirmation-value">
              {slots.length
                ? slots.map((s) => s.name).join(", ")
                : plan.is_24_hour
                  ? "24 Hours Access"
                  : `${formatTime(plan.start_minute)} \u2013 ${formatTime(plan.end_minute)}`}
            </span>
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
            <span className="confirmation-label">Amount</span>
            <span className="confirmation-value amount">&#8377;{amount ?? plan.price}</span>
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
