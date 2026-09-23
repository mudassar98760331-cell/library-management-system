const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(req, res, next) {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.push("Valid email is required");
  }
  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0] });
  }
  next();
}

export function validateLogin(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  next();
}

export function validateChangePassword(req, res, next) {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }
  if (current_password === new_password) {
    return res.status(400).json({ error: "New password must be different from current password" });
  }
  next();
}

export function validateRequestOtp(req, res, next) {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  next();
}

export function validateVerifyOtp(req, res, next) {
  const { email, otp } = req.body;
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
    return res.status(400).json({ error: "Valid 6-digit OTP is required" });
  }
  next();
}

export function validateSetPassword(req, res, next) {
  const { setup_token, password, confirm_password } = req.body;
  if (!setup_token || !password || !confirm_password) {
    return res.status(400).json({ error: "Setup token, password, and confirmation are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (password !== confirm_password) {
    return res.status(400).json({ error: "Passwords do not match" });
  }
  next();
}
