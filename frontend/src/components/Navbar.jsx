import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar({ onMenuToggle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleHashNav = (hash) => {
    closeMobileMenu();
    if (location.pathname === "/") {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/#" + hash);
    }
  };

  return (
    <nav className="navbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {user && <button className="mobile-menu-btn" onClick={onMenuToggle} aria-label="Toggle menu">&#9776;</button>}
        {!user && <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">&#9776;</button>}
        <Link to={user ? (user.role === "admin" ? "/admin/dashboard" : "/student/dashboard") : "/"} className="brand">
          <span className="brand-icon">&#128218;</span>
          <span>Lakshya <span>Library</span></span>
        </Link>
      </div>
      {!user && (
        <>
          <div className="home-nav-links">
            <a href="#features" onClick={(e) => { e.preventDefault(); handleHashNav("features"); }}>Features</a>
            <a href="#membership" onClick={(e) => { e.preventDefault(); handleHashNav("membership"); }}>Membership</a>
            <Link to="/login">Login</Link>
            <Link to="/register" className="nav-btn">Get Membership</Link>
          </div>
          {mobileMenuOpen && (
            <div className="mobile-nav-overlay" onClick={closeMobileMenu}>
              <div className="mobile-nav-menu" onClick={(e) => e.stopPropagation()}>
                <a href="#features" onClick={(e) => { e.preventDefault(); handleHashNav("features"); }}>Features</a>
                <a href="#membership" onClick={(e) => { e.preventDefault(); handleHashNav("membership"); }}>Membership</a>
                <Link to="/login" onClick={closeMobileMenu}>Login</Link>
                <Link to="/register" className="nav-btn" onClick={closeMobileMenu}>Get Membership</Link>
              </div>
            </div>
          )}
        </>
      )}
      {user && (
        <div className="nav-right">
          <Link to={user.role === "student" ? "/student/notifications" : "/admin/notifications"} className="nav-notif-btn">
            &#128276;
          </Link>
          <div className="nav-avatar" onClick={() => navigate(user.role === "admin" ? "/admin/dashboard" : "/student/dashboard")}>
            <div className="nav-avatar-circle">{user.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U"}</div>
            <div className="nav-avatar-info">
              <span className="nav-avatar-name">{user.name}</span>
              <span className="nav-avatar-role">{user.role === "admin" ? "Admin" : "Student"}</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
