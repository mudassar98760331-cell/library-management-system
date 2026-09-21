import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/useToast";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !phone || !password) { toast.error("Please fill in all fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await register(name, email, password, phone);
      toast.success("Registration successful!");
      navigate("/student/dashboard");
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
          <h1>Create Your Account</h1>
          <p className="auth-subtitle">Join Lakshya Library and start your journey.</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" required />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label>Mobile Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter mobile number" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-field">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "\u{1F441}" : "\u{1F441}\u{200D}\u{1F5E8}\u{FE0F}"}</button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Creating Account..." : "Register"}
            </button>
          </form>
          <p className="auth-link">Already have an account? <Link to="/login">Login</Link></p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-quote">
          <h2>A Quiet Place For A Brighter You.</h2>
          <h3>Start Your Journey Today.</h3>
          <p>Join Lakshya Library and access the best study environment. Focus. Study. Grow.</p>
        </div>
      </div>
    </div>
  );
}

export default Register;
