import { useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const studentLinks = [
  { to: "/student/dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
  { to: "/student/membership", label: "Membership", icon: "\u{1F4CB}" },
  { to: "/student/seat-booking", label: "Seats", icon: "\u{1F4BA}" },
  { to: "/student/payment-history", label: "Payments", icon: "\u{1F4B3}" },
  { to: "/student/lost-found", label: "Lost & Found", icon: "\u{1F50E}" },
  { to: "/student/help", label: "Help Desk", icon: "\u{1F6E0}\uFE0F" },
  { to: "/student/notifications", label: "Notifications", icon: "\u{1F514}" },
  { to: "/student/profile", label: "Profile", icon: "\u{1F464}" },
];

const adminLinks = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
  { to: "/admin/students", label: "Students", icon: "\u{1F465}" },
  { to: "/admin/seats", label: "Seats", icon: "\u{1F4BA}" },
  { to: "/admin/memberships", label: "Memberships", icon: "\u{1F4CB}" },
  { to: "/admin/payments", label: "Payments", icon: "\u{1F4B3}" },
  { to: "/admin/lost-found", label: "Lost & Found", icon: "\u{1F50E}" },
  { to: "/admin/help", label: "Help Desk", icon: "\u{1F6E0}\uFE0F" },
  { to: "/admin/notifications", label: "Notifications", icon: "\u{1F514}" },
  { to: "/admin/reports", label: "Reports", icon: "\u{1F4C8}" },
  { to: "/admin/settings", label: "Settings", icon: "\u2699\uFE0F" },
];

export default function Sidebar({ role, isOpen, onClose }) {
  const location = useLocation();
  const { logout } = useAuth();
  const links = role === "admin" ? adminLinks : studentLinks;

  useEffect(() => {
    if (onClose) onClose();
  }, [location.pathname, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleLogout = useCallback(() => {
    if (onClose) onClose();
    logout();
  }, [onClose, logout]);

  return (
    <>
      <div
        className={`mobile-sidebar-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? "open" : ""}`} role="navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">
            <span>&#128218;</span> Lakshya <span>Library</span>
          </div>
          <div className="sidebar-brand-sub">Study Today, A Brighter Tomorrow</div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-label">{role === "admin" ? "Admin Panel" : "Student Portal"}</div>
          {links.map((link) => (
            <Link key={link.to} to={link.to} className={`sidebar-link ${location.pathname === link.to ? "active" : ""}`}>
              <span className="sidebar-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="sidebar-footer">
          <Link to="/" className="sidebar-link" onClick={handleLogout}>
            <span className="sidebar-icon">&#128682;</span>
            Logout
          </Link>
        </div>
      </aside>
    </>
  );
}
