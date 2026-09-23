import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

const PLAN_META = {
  "24 Hours": { icon: "\u{1F570}\uFE0F", desc: "Full day and night access. Study anytime, 24/7.", color: "#8b5cf6" },
  "7AM-11PM": { icon: "\u2600\uFE0F", desc: "Extended day access. Maximum study hours.", color: "#f59e0b" },
  "5AM-10AM": { icon: "\u{1F305}", desc: "Early morning study session. Beat the crowd.", color: "#f97316" },
  "10AM-6:30PM": { icon: "\u{1F4DA}", desc: "Full day study session. Core library hours.", color: "#3b82f6" },
  "7PM-12AM": { icon: "\u{1F319}", desc: "Late evening study session. Night owl friendly.", color: "#6366f1" },
};

function getPlanMeta(plan) {
  for (const [key, val] of Object.entries(PLAN_META)) {
    if (plan.name?.includes(key) || plan.name?.includes(key.replace(":", ""))) return val;
  }
  if (plan.is_24_hour) return PLAN_META["24 Hours"];
  return { icon: "\u{1F552}", desc: plan.name || "Library access plan", color: "#3b82f6" };
}

function Membership() {
  const toast = useToast();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentAPI.getFeePlans()
      .then((data) => {
        setPlans(data);
        const stored = sessionStorage.getItem("selectedPlan");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const match = data.find((p) => p.id === parsed.id);
            if (match) setSelectedPlan(match);
          } catch { /* ignore parse errors */ }
        }
      })
      .catch(() => toast.error("Failed to load plans"))
      .finally(() => setLoading(false));
  }, [toast]);

  const formatTime = (m) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const ap = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${ap}`;
  };

  const handleContinue = () => {
    if (!selectedPlan) { toast.error("Please select a timing plan"); return; }
    sessionStorage.setItem("selectedPlan", JSON.stringify(selectedPlan));
    navigate("/student/seat-booking", { state: { plan: selectedPlan } });
  };

  const handleSeatStepClick = () => {
    const stored = sessionStorage.getItem("selectedPlan");
    const planToUse = selectedPlan || (stored ? JSON.parse(stored) : null);
    if (!planToUse) { toast.error("Please select a timing plan first"); return; }
    sessionStorage.setItem("selectedPlan", JSON.stringify(planToUse));
    navigate("/student/seat-booking", { state: { plan: planToUse } });
  };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading plans...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Student Portal</div>
          <h1>Choose Your Timing Plan</h1>
          <div className="subtitle">1 Month Membership &mdash; Select the schedule that fits you best</div>
        </div>
      </div>

      <div className="booking-stepper">
        <div className="stepper-step active"><div className="stepper-number">1</div><span>Membership</span></div>
        <div className="stepper-line" />
        <div className={`stepper-step${selectedPlan ? " completed" : ""}`} onClick={handleSeatStepClick} style={selectedPlan ? { cursor: "pointer" } : undefined}>
          <div className="stepper-number">2</div><span>Seat Selection</span>
        </div>
        <div className="stepper-line" />
        <div className="stepper-step"><div className="stepper-number">3</div><span>Payment</span></div>
        <div className="stepper-line" />
        <div className="stepper-step"><div className="stepper-number">4</div><span>Confirmation</span></div>
      </div>

      <div className="plans-grid">
        {plans.map((plan) => {
          const meta = getPlanMeta(plan);
          const isSelected = selectedPlan?.id === plan.id;
          return (
            <div
              key={plan.id}
              className={`plan-card ${isSelected ? "selected" : ""} ${plan.is_24_hour ? "featured" : ""}`}
              onClick={() => { setSelectedPlan(plan); sessionStorage.setItem("selectedPlan", JSON.stringify(plan)); }}
            >
              {plan.is_24_hour && <div className="popular-label">Popular</div>}
              {isSelected && <div className="selected-check">&#10003;</div>}
              <div className="plan-icon-wrap" style={{ background: `${meta.color}18`, color: meta.color }}>
                <span className="plan-icon">{meta.icon}</span>
              </div>
              <h3>{plan.name}</h3>
              <div className="price">&#8377;{plan.price}<span>/ 1 Month</span></div>
              <p className="plan-desc">{meta.desc}</p>
              <div className="plan-timing">
                {plan.is_24_hour ? "24 Hours Access" : `${formatTime(plan.start_minute)} \u2013 ${formatTime(plan.end_minute)}`}
              </div>
            </div>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="summary-card">
          <h3>Selected Plan</h3>
          <div className="summary-item"><span>Plan</span><span>{selectedPlan.name}</span></div>
          <div className="summary-item"><span>Price</span><span>&#8377;{selectedPlan.price} / 1 Month</span></div>
          <div className="summary-item">
            <span>Timing</span>
            <span>{selectedPlan.is_24_hour ? "24 Hours Access" : `${formatTime(selectedPlan.start_minute)} \u2013 ${formatTime(selectedPlan.end_minute)}`}</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={handleContinue}>
            Continue to Seat Selection &#8594;
          </button>
        </div>
      )}

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
