import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

// 1-month membership window (mirrors the backend's +1 month calculation).
// Used as the pre-submit preview; the Confirmation page shows the actual
// server-computed dates returned by submitPayment.
function defaultMembershipDates() {
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  return {
    start: start.toLocaleDateString("en-IN"),
    end: end.toLocaleDateString("en-IN"),
  };
}

function Payment() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const seat = location.state?.seat;
  const slots = location.state?.slots || [];
  const quoteFromState = location.state?.quote;

  const [amount, setAmount] = useState(quoteFromState ?? null);
  // When no quote was carried over, start in the "calculating" state and
  // request it below (set-state only ever happens in async callbacks).
  const [quoting, setQuoting] = useState(quoteFromState === null || quoteFromState === undefined);
  const [membershipDates] = useState(defaultMembershipDates);
  const [settings, setSettings] = useState(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!seat || !slots.length) { navigate("/student/seat-booking"); return; }
    fetch("/api/settings")
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => {
        if (!t) return;
        try { setSettings(JSON.parse(t)); } catch { /* ignore non-JSON */ }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    if (quoteFromState === null || quoteFromState === undefined) {
      studentAPI.quoteSlots(slots.map((s) => s.id))
        .then((d) => setAmount(d.price))
        .catch(() => toast.error("Could not calculate the price"))
        .finally(() => setQuoting(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScreenshot = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error("File must be less than 5MB"); return; }
      setScreenshot(file);
      const reader = new FileReader();
      reader.onload = (ev) => setScreenshotPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!utrNumber.trim()) { toast.error("UTR/Reference number is required"); return; }
    if (!screenshot) { toast.error("Payment screenshot is required"); return; }
    if (amount === null || quoting) { toast.error("Price is still being calculated"); return; }
    setSubmitting(true);
    try {
      // No fee_plan_id / amount: the backend derives the plan from the slots
      // and computes the final price server-side.
      const res = await studentAPI.submitPayment({
        seat_id: seat.id,
        slot_ids: slots.map((s) => s.id),
        utr_number: utrNumber.trim(),
        screenshot,
      });
      toast.success("Payment submitted successfully!");
      const membership = res?.membership;
      navigate("/student/confirmation", {
        state: {
          seat,
          slots,
          amount: res?.payment?.amount ?? amount,
          utrNumber,
          membershipStart: membership?.start_date || membershipDates.start,
          membershipExpiry: membership?.end_date || membershipDates.end,
          paymentSubmitted: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Student Portal</div>
          <h1>&#128179; Scan &amp; Pay</h1>
          <div className="subtitle">Complete your membership payment</div>
        </div>
      </div>

      <div className="booking-stepper">
        <div className="stepper-step completed" onClick={() => navigate("/student/membership")}>
          <div className="stepper-number">&#10003;</div><span>Membership</span>
        </div>
        <div className="stepper-line active" />
        <div className="stepper-step completed" onClick={() => navigate("/student/seat-booking")}>
          <div className="stepper-number">&#10003;</div><span>Seat Selection</span>
        </div>
        <div className="stepper-line active" />
        <div className="stepper-step active"><div className="stepper-number">3</div><span>Payment</span></div>
        <div className="stepper-line" />
        <div className="stepper-step"><div className="stepper-number">4</div><span>Confirmation</span></div>
      </div>

      <div className="payment-summary-card">
        <h3>Booking Summary</h3>
        <div className="payment-summary-grid">
          <div className="payment-summary-item">
            <span className="summary-label">Access Slots</span>
            <span className="summary-value">{slots.map((s) => s.name).join(", ")}</span>
          </div>
          <div className="payment-summary-item">
            <span className="summary-label">Seat</span>
            <span className="summary-value">{seat?.seat_number} &mdash; {seat?.room_name}</span>
          </div>
          <div className="payment-summary-item">
            <span className="summary-label">Membership Start</span>
            <span className="summary-value">{membershipDates.start}</span>
          </div>
          <div className="payment-summary-item">
            <span className="summary-label">Membership Expiry</span>
            <span className="summary-value">{membershipDates.end}</span>
          </div>
          <div className="payment-summary-item">
            <span className="summary-label">Amount</span>
            <span className="summary-value amount">
              {amount !== null ? `\u20B9${amount}` : quoting ? "Calculating\u2026" : "\u2014"}
            </span>
          </div>
        </div>
      </div>

      <div className="payment-warning">
        Before making payment, please verify that the beneficiary name is <strong>NISHANT SAHU</strong> and the UPI ID is <strong>9109016627@axl</strong>. Do not make payment if the details do not match.
      </div>

      <div className="payment-methods">
        <div className="qr-section">
          <h3>Scan QR Code</h3>
          {settings?.qr_code_url ? (
            <img src={settings.qr_code_url} alt="Payment QR" className="qr-image" />
          ) : (
            <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>QR code not configured</div>
          )}
          {settings?.upi_id && <p className="upi-id">{settings.upi_id}</p>}
        </div>
        <div className="upi-section">
          <h3>UPI Payment</h3>
          <div className="upi-id-label">UPI ID</div>
          <p className="upi-id">{settings?.upi_id || "Not configured"}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <span className="upi-badge">PhonePe</span>
            <span className="upi-badge">GPay</span>
            <span className="upi-badge">Paytm</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card" style={{ maxWidth: '100%' }}>
        <h2>Payment Details</h2>
        <div className="form-group">
          <label>UTR / Reference Number</label>
          <input
            type="text"
            value={utrNumber}
            onChange={(e) => setUtrNumber(e.target.value)}
            placeholder="e.g. 123456789012"
            required
          />
        </div>
        <div className="form-group">
          <label>Upload Payment Screenshot</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleScreenshot} />
          {screenshotPreview && <img src={screenshotPreview} alt="Preview" className="screenshot-preview" />}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || quoting || amount === null}>
          {submitting ? "Submitting..." : "Submit Payment"}
        </button>
      </form>

      <button className="btn btn-secondary btn-block" onClick={() => navigate("/student/seat-booking")}>
        &larr; Back to Seat Selection
      </button>
    </div>
  );
}

export default Payment;
