import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return (
      <Navigate
        to={user.role === "admin" ? "/admin/dashboard" : "/student/dashboard"}
        replace
      />
    );
  }
  return children;
}
