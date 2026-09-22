const API_BASE = "/api";

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  };
  if (options.body instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  const res = await fetch(`${API_BASE}${endpoint}`, config);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(res.ok ? "Invalid server response" : text);
    }
  } else if (res.ok) {
    return {};
  }
  if (!res.ok) throw new Error((data && data.error) || "Something went wrong");
  return data;
}

export const authAPI = {
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name, email, password, phone) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, phone }),
    }),
  getMe: () => request("/auth/me"),
};

export const studentAPI = {
  getDashboard: () => request("/student/dashboard"),
  getFeePlans: () => request("/student/fee-plans"),
  purchaseMembership: (fee_plan_id) =>
    request("/student/membership", {
      method: "POST",
      body: JSON.stringify({ fee_plan_id }),
    }),
  getSeats: () => request("/student/seats"),
  bookSeat: (seat_id, fee_plan_id) =>
    request("/student/book-seat", {
      method: "POST",
      body: JSON.stringify({ seat_id, fee_plan_id }),
    }),
  cancelBooking: (booking_id) =>
    request(`/student/booking/${booking_id}`, { method: "DELETE" }),
  getPaymentHistory: () => request("/student/payment-history"),
  uploadScreenshot: (paymentId, file) => {
    const formData = new FormData();
    formData.append("screenshot", file);
    formData.append("payment_id", paymentId);
    const token = localStorage.getItem("token");
    return fetch(`${API_BASE}/student/upload-screenshot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error || "Upload failed"); return d; }));
  },
  getProfile: () => request("/student/profile"),
  updateProfile: (data) =>
    request("/student/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  changePassword: (current_password, new_password) =>
    request("/student/change-password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    }),
  getNotifications: () => request("/student/notifications"),
  markNotificationRead: (id) =>
    request(`/student/notifications/${id}/read`, { method: "PUT" }),
  submitLostFound: (data) =>
    request("/student/lost-found", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLostFound: () => request("/student/lost-found"),
};

export const adminAPI = {
  getDashboard: () => request("/admin/dashboard"),
  getStudents: () => request("/admin/students"),
  getSeats: () => request("/admin/seats"),
  updateSeatStatus: (id, status) =>
    request(`/admin/seats/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  getPayments: () => request("/admin/payments"),
  approvePayment: (id) =>
    request(`/admin/payments/${id}/approve`, { method: "PUT" }),
  rejectPayment: (id, reason) =>
    request(`/admin/payments/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    }),
  createOfflineBooking: (data) =>
    request("/admin/offline-booking", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelBooking: (id) =>
    request(`/admin/bookings/${id}/cancel`, { method: "PUT" }),
  getAvailableSeats: () => request("/admin/available-seats"),
  assignSeat: (student_id, seat_id) =>
    request("/admin/assign-seat", {
      method: "POST",
      body: JSON.stringify({ student_id, seat_id }),
    }),
  deleteStudent: (id) =>
    request(`/admin/students/${id}`, { method: "DELETE" }),
  getFeePlans: () => request("/admin/fee-plans"),
  updateFeePlan: (id, data) =>
    request(`/admin/fee-plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getSettings: () =>
    request("/admin/settings").then((rows) => {
      const s = {};
      for (const r of rows) s[r.setting_key] = r.setting_value;
      return s;
    }),
  updateSettings: (data) =>
    request("/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ settings: data }),
    }),
  uploadQR: (file) => {
    const formData = new FormData();
    formData.append("qr", file);
    const token = localStorage.getItem("token");
    return fetch(`${API_BASE}/admin/upload-qr`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error || "Upload failed"); return d; }));
  },
  sendNotification: (data) =>
    request("/admin/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getNotifications: () => request("/admin/notifications"),
  getLostFound: () => request("/admin/lost-found"),
  updateLostFound: (id, status) =>
    request(`/admin/lost-found/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  getReports: () => request("/admin/reports"),
  renewMembership: (data) =>
    request("/admin/renew-membership", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
