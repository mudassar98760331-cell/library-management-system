import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import SetPassword from "./pages/auth/SetPassword";

import StudentDashboard from "./pages/student/Dashboard";
import SeatBooking from "./pages/student/SeatBooking";
import Membership from "./pages/student/Membership";
import Payment from "./pages/student/Payment";
import Confirmation from "./pages/student/Confirmation";
import PaymentHistory from "./pages/student/PaymentHistory";
import LostAndFound from "./pages/student/LostAndFound";
import Notifications from "./pages/student/Notifications";
import Profile from "./pages/student/Profile";
import StudentHelpDesk from "./pages/student/HelpDesk";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminStudents from "./pages/admin/Students";
import AdminSeats from "./pages/admin/Seats";
import AdminMemberships from "./pages/admin/Memberships";
import AdminPayments from "./pages/admin/Payments";
import AdminLostFound from "./pages/admin/LostFound";
import AdminNotifications from "./pages/admin/Notifications";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import AdminHelpDesk from "./pages/admin/HelpDesk";

import "./App.css";

function StudentLayout({ children, sidebarOpen, onSidebarClose }) {
  return (
    <div className="app-layout">
      <Sidebar role="student" isOpen={sidebarOpen} onClose={onSidebarClose} />
      <main className="main-content">{children}</main>
    </div>
  );
}

function AdminLayout({ children, sidebarOpen, onSidebarClose }) {
  return (
    <div className="app-layout">
      <Sidebar role="admin" isOpen={sidebarOpen} onClose={onSidebarClose} />
      <main className="main-content">{children}</main>
    </div>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  if (user) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/student/dashboard"} replace />;
  }
  return <Home />;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
            <Routes>
              {/* Public */}
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/set-password" element={<SetPassword />} />

              {/* Student */}
              <Route path="/student/dashboard" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><StudentDashboard /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/seat-booking" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><SeatBooking /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/membership" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><Membership /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/payment" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><Payment /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/confirmation" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><Confirmation /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/payment-history" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><PaymentHistory /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/lost-found" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><LostAndFound /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/notifications" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><Notifications /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/profile" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><Profile /></StudentLayout></ProtectedRoute>} />
              <Route path="/student/help" element={<ProtectedRoute role="student"><StudentLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><StudentHelpDesk /></StudentLayout></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminDashboard /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/students" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminStudents /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/seats" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminSeats /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/memberships" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminMemberships /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/payments" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminPayments /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/lost-found" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminLostFound /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/notifications" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminNotifications /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/reports" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminReports /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminSettings /></AdminLayout></ProtectedRoute>} />
              <Route path="/admin/help" element={<ProtectedRoute role="admin"><AdminLayout sidebarOpen={sidebarOpen} onSidebarClose={closeSidebar}><AdminHelpDesk /></AdminLayout></ProtectedRoute>} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
