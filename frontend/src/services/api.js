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
  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, config);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        "Cannot reach the server. If you just opened the app, the backend may be waking up — please retry in a few seconds.",
        { cause: err }
      );
    }
    throw err;
  }
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
  requestOtp: (email) =>
    request("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verifyOtp: (email, otp) =>
    request("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),
  setPassword: (setup_token, password, confirm_password) =>
    request("/auth/set-password", {
      method: "POST",
      body: JSON.stringify({ setup_token, password, confirm_password }),
    }),
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
  // Per-seat access-slot availability (status only, no prices)
  getSeatSlots: (seatId) => request(`/student/seats/${seatId}/slots`),
  // Backend-computed price for a slot selection — the client never sends an amount
  quoteSlots: (slotIds) =>
    request("/student/slots/quote", {
      method: "POST",
      body: JSON.stringify({ slot_ids: slotIds }),
    }),
  bookSeat: (seat_id, fee_plan_id) =>
    request("/student/book-seat", {
      method: "POST",
      body: JSON.stringify({ seat_id, fee_plan_id }),
    }),
  cancelBooking: (booking_id) =>
    request(`/student/booking/${booking_id}`, { method: "DELETE" }),
  getPaymentHistory: () => request("/student/payment-history"),
  // Single atomic call: membership (pending) + payment (UTR + screenshot) + booking (pending)
  submitPayment: ({ fee_plan_id, seat_id, slot_ids, utr_number, screenshot }) => {
    const formData = new FormData();
    formData.append("fee_plan_id", fee_plan_id);
    formData.append("seat_id", seat_id);
    if (slot_ids && slot_ids.length) {
      formData.append("slot_ids", JSON.stringify(slot_ids));
    }
    formData.append("utr_number", utr_number);
    formData.append("screenshot", screenshot);
    const token = localStorage.getItem("token");
    return fetch(`${API_BASE}/student/payment`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then((r) =>
      r.json().then((d) => {
        if (!r.ok) throw new Error(d.error || "Payment submission failed");
        return d;
      })
    );
  },
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
  submitHelp: (subject, message) =>
    request("/student/help", {
      method: "POST",
      body: JSON.stringify({ subject, message }),
    }),
  getHelp: () => request("/student/help"),
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
  // Screenshot lives in the DB behind auth — fetch as blob and create a local URL
  getPaymentScreenshot: async (id) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/admin/payments/${id}/screenshot`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = "No screenshot available";
      try {
        const d = await res.json();
        if (d.error) msg = d.error;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(msg);
    }
    return URL.createObjectURL(await res.blob());
  },
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
  getSettings: () => request("/admin/settings"),
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
  getHelp: () => request("/admin/help"),
  updateHelp: (id, data) =>
    request(`/admin/help/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getReports: () => request("/admin/reports"),
  renewMembership: (data) =>
    request("/admin/renew-membership", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // Slot booking + admin-controlled dynamic pricing
  getSlotPricing: () => request("/admin/slots"),
  updateSlotPrice: (id, price) =>
    request(`/admin/slots/${id}`, {
      method: "PUT",
      body: JSON.stringify({ price }),
    }),
  updateSlotStatus: (id, is_active) =>
    request(`/admin/slots/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_active }),
    }),
  updateSlotComboPrice: (id, price) =>
    request(`/admin/slot-combos/${id}`, {
      method: "PUT",
      body: JSON.stringify({ price }),
    }),
  getSeatSlots: (seatId) => request(`/admin/seats/${seatId}/slots`),
  quoteSlots: (slotIds) =>
    request("/admin/slots/quote", {
      method: "POST",
      body: JSON.stringify({ slot_ids: slotIds }),
    }),
};
