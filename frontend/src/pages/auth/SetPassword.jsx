import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function SetPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = email, 2 = OTP, 3 = new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Please enter your registered email"); return; }
    setLoading(true);
    try {
      const res = await authAPI.requestOtp(email.trim());
      toast.success(res.message || "If that account requires activation, a code has been sent.");
      setStep(2);
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) { toast.error("Please enter the OTP"); return; }
    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(email.trim(), otp.trim());
      setSetupToken(res.setup_token);
      setStep(3);
      toast.success("OTP verified. Set your new password.");
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) { toast.error("Please fill in both password fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await authAPI.setPassword(setupToken, password, confirmPassword);
      toast.success(res.message || "Password set successfully. Please log in.");
      navigate("/login");
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
          <h1>Set Password</h1>
          <p className="auth-subtitle">
            {step === 1 && "Activate your account using your registered email."}
            {step === 2 && `Enter the 6-digit code sent to ${email}.`}
            {step === 3 && "Choose a password for your account."}
          </p>

          {step === 1 && (
            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label>Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 6-digit OTP"
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                style={{ marginTop: 10 }}
                onClick={() => { setStep(1); setOtp(""); setSetupToken(""); }}
              >
                Use a different email
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSetPassword}>
              <div className="form-group">
                <label>New Password</label>
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "\u{1F441}" : "\u{1F441}\u{200D}\u{1F5E8}\u{FE0F}"}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? "Setting..." : "Set Password"}
              </button>
            </form>
          )}

          <p style={{ textAlign: "center", margin: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>
            Remember your password?
          </p>
          <p className="auth-link">
            <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-quote">
          <h2>Activate Your Account.</h2>
          <h3>Set a password only you know.</h3>
          <p>
            Created for an offline booking? Verify your email with a one-time code, then choose
            your own password to start logging in.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SetPassword;
