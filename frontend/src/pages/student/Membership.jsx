import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { publicAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

// Per-timing-window presentation (no prices are ever shown on this page — the
// price for a seat/slot selection is calculated on the server at booking time).
const TIMING_META = {
  300: { icon: "\u{1F305}", desc: "Early morning study session. Beat the crowd.", color: "#f97316" },
  600: { icon: "\u{1F4DA}", desc: "Full day study session. Core library hours.", color: "#3b82f6" },
  1140: { icon: "\u{1F319}", desc: "Late evening study session. Night owl friendly.", color: "#6366f1" },
  0: { icon: "\u{1F570}\uFE0F", desc: "Night session. Quiet overnight study hours.", color: "#8b5cf6" },
};

function getTimingMeta(plan) {
  return TIMING_META[plan.start_minute] || { icon: "\u{1F552}", desc: plan.name || "Library access timing", color: "#3b82f6" };
}

function Membership() {
  const toast = useToast();
  const navigate = useNavigate();
  const [timings, setTimings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicAPI.getTimings()
      .then((d) => setTimings(d.timings || []))
      .catch(() => toast.error("Failed to load timings"))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading timings...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Student Portal</div>
          <h1>Choose Your Timing</h1>
          <div className="subtitle">1 Month Membership &mdash; Pick your slots while booking a seat</div>
        </div>
      </div>

      <div className="booking-stepper">
        <div className="stepper-step active"><div className="stepper-number">1</div><span>Membership</span></div>
        <div className="stepper-line" />
        <div
          className="stepper-step"
          onClick={() => navigate("/student/seat-booking")}
          style={{ cursor: "pointer" }}
        >
          <div className="stepper-number">2</div><span>Seat Selection</span>
        </div>
        <div className="stepper-line" />
        <div className="stepper-step"><div className="stepper-number">3</div><span>Payment</span></div>
        <div className="stepper-line" />
        <div className="stepper-step"><div className="stepper-number">4</div><span>Confirmation</span></div>
      </div>

      <div className="plans-grid">
        {timings.map((plan) => {
          const meta = getTimingMeta(plan);
          return (
            <div key={plan.id} className="plan-card">
              <div className="plan-icon-wrap" style={{ background: `${meta.color}18`, color: meta.color }}>
                <span className="plan-icon">{meta.icon}</span>
              </div>
              <h3>{plan.name.replace(/\s*to\s*/, " \u2013 ")}</h3>
              <p className="plan-desc">{meta.desc}</p>
              <div className="plan-timing">1 Month Membership</div>
            </div>
          );
        })}
      </div>

      <div className="summary-card" style={{ marginTop: 20 }}>
        <h3>Ready to Book?</h3>
        <div className="summary-item">
          <span>Next Step</span>
          <span>Choose your seat, then select one or more timing slots. The price is calculated for your selection.</span>
        </div>
        <button className="btn btn-primary btn-block" onClick={() => navigate("/student/seat-booking")}>
          Book a Seat &#8594;
        </button>
      </div>

      <div className="facilities-section">
        <h2 style={{ marginBottom: 14 }}>Library Facilities</h2>
        <div className="features-grid">
          <div className="feature-card"><span className="feature-icon">&#10052;&#65039;</span><h3>Air Conditioned</h3><p>Comfortable year-round temperature for focused study</p></div>
          <div className="feature-card"><span className="feature-icon">&#128246;</span><h3>Free WiFi</h3><p>High-speed internet for research and online resources</p></div>
          <div className="feature-card"><span className="feature-icon">&#128167;</span><h3>Purified Water</h3><p>RO purified drinking water available at all times</p></div>
          <div className="feature-card"><span className="feature-icon">&#128274;</span><h3>Secure Lockers</h3><p>Personal storage for your books and belongings</p></div>
          <div className="feature-card"><span className="feature-icon">&#128249;</span><h3>CCTV Surveillance</h3><p>24/7 CCTV surveillance for a secure and safe study environment</p></div>
          <div className="feature-card"><span className="feature-icon">&#128187;</span><h3>Power Backup</h3><p>Uninterrupted power supply for uninterrupted study</p></div>
        </div>
      </div>
    </div>
  );
}

export default Membership;
