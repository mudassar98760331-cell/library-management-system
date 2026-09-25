import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { publicAPI } from "../services/api";

// Descriptive copy per timing window (presentation only — the timing cards
// themselves come from GET /api/settings/timings; no prices are ever shown).
const TIMING_DESC = {
  300: "Early morning session",
  600: "Full day session",
  1140: "Late evening session",
  0: "Night session",
};

function Home() {
  const location = useLocation();
  const [timings, setTimings] = useState([]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  useEffect(() => {
    let cancelled = false;
    publicAPI.getTimings()
      .then((d) => {
        if (cancelled || !d?.timings?.length) return;
        setTimings(d.timings.map((t) => ({ ...t, desc: TIMING_DESC[t.start_minute] || t.name })));
      })
      .catch(() => { /* timings stay empty until the API responds */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">A Better Tomorrow Starts With Focus</div>
          <h1>Your Space to <span>Focus</span>.<br />Your Place to <span>Grow</span>.</h1>
          <p>A premium study environment with dedicated seats, flexible membership and everything you need to stay focused.</p>
          <div className="hero-buttons">
            <Link to="/register" className="primary-btn">Get Membership &rarr;</Link>
            <Link to="/login" className="secondary-btn">Explore Library</Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-visual-icon">&#128218;</div>
          <div className="hero-visual-quote">Discipline Today A Brighter Tomorrow.</div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-heading">
          <div className="label">Our Features</div>
          <h2>Everything You Need to Succeed</h2>
          <p>From seat booking to payments, we've got you covered.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">&#128186;</span>
            <h3>Seat Booking</h3>
            <p>Choose your preferred seat from 43 available seats across 3 floors.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">&#128101;</span>
            <h3>Membership Plans</h3>
            <p>Flexible plans to match your study goals.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">&#128274;</span>
            <h3>Locker Service</h3>
            <p>Secure lockers to keep your belongings safe during your study hours.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">&#128424;</span>
            <h3>Print & Scan</h3>
            <p>Quick and easy printing, scanning and photocopy services.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">&#128246;</span>
            <h3>High Speed Wi-Fi</h3>
            <p>Stay connected with reliable and fast internet.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">&#128179;</span>
            <h3>Easy Payments</h3>
            <p>Pay via UPI, cash, or QR online with instant confirmation.</p>
          </div>
        </div>
      </section>

      <section className="membership-section" id="membership">
        <div className="membership-section-left">
          <div className="label" style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Access Timings</div>
          <h2>Choose Your Study Timing</h2>
          <p>Four flexible access slots to match your schedule. Log in to check availability and book your slot.</p>
        </div>
        <div className="home-plans">
          {timings.map((plan) => (
            <div className="plan" key={plan.id}>
              <h3>{plan.name.replace(/\s*to\s*/, " \u2013 ")}</h3>
              <p>{plan.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to Start Studying?</h2>
        <p>Join Lakshya Library today and get access to the best study environment.</p>
        <Link to="/register" className="primary-btn">Get Membership &rarr;</Link>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>&#128218; Lakshya Library</h3>
            <p>Your Space to Focus. Your Place to Grow.</p>
            <div className="footer-social">
              <a href="https://www.instagram.com/lakashyaeducation?stkn=b213eHh1ZzZrYndi" target="_blank" rel="noopener noreferrer" className="footer-social-link">
                <span>&#128247;</span> Instagram
              </a>
              <a href="https://chat.whatsapp.com/KdqFlwHoXhv9LkN2M0n6f9?s=cl&p=a&mlu=4&ilr=4" target="_blank" rel="noopener noreferrer" className="footer-social-link">
                <span>&#128172;</span> WhatsApp Group
              </a>
            </div>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <Link to="/">Home</Link>
            <a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); }}>Features</a>
            <a href="#membership" onClick={(e) => { e.preventDefault(); document.getElementById("membership")?.scrollIntoView({ behavior: "smooth" }); }}>Membership</a>
            <Link to="/login">Login</Link>
            <Link to="/register">Get Membership</Link>
          </div>
          <div className="footer-section">
            <h4>Library Owner</h4>
            <p className="footer-owner-name">Nishant Sahu</p>
            <p>Phone: <a href="tel:+919109016627" className="footer-contact-link">+919109016627</a></p>
            <h4 style={{ marginTop: "14px" }}>Our Location</h4>
            <a href="https://maps.app.goo.gl/yfgRnGVTz8EKwYNC8?g_st=ac" target="_blank" rel="noopener noreferrer" className="footer-location-link">
              &#128205; View on Google Maps
            </a>
          </div>
          <div className="footer-section">
            <h4>Designed &amp; Developed By</h4>
            <p className="footer-dev-name">Mudassar Khan</p>
            <p>Email: <a href="mailto:mudassar98760331@gmail.com" className="footer-contact-link">mudassar98760331@gmail.com</a></p>
            <a href="https://www.instagram.com/Mudassarkhan.O" target="_blank" rel="noopener noreferrer" className="footer-social-link">
              <span>&#128247;</span> Mudassarkhan.O
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Lakshya Library. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default Home;
