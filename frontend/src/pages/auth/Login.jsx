import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/useToast";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success("Login successful!");
      navigate(user.role === "admin" ? "/admin/dashboard" : "/student/dashboard");
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-form-container">
          <Link to="/" className="brand">
            <span className="brand-icon">&#128218;</span>
            <span>Lakshya <span>Library</span></span>
          </Link>
          <h1>Welcome Back</h1>
          <p className="auth-subtitle">Continue your focused study journey.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-field">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "\u{1F441}" : "\u{1F441}\u{200D}\u{1F5E8}\u{FE0F}"}</button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
          <p style={{ textAlign: 'center', margin: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>Or</p>
          <p className="auth-link">Have an offline booking? <Link to="/set-password">Set Password / Activate Account</Link></p>
          <p className="auth-link">Don't have an account? <Link to="/register">Create one</Link></p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-quote">
          <h2>Good Students Build Habits.</h2>
          <h3>Great Students Use The Right Environment.</h3>
          <p>Login to continue your journey at Lakshya Library. Focus, study, and grow with us.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
