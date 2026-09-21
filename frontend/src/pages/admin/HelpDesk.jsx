import { useState } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function HelpDesk() {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }
    setSubmitting(true);
    try {
      await adminAPI.sendNotification({ title: `Help: ${subject}`, message });
      toast.success("Help request submitted");
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Help Desk</h1>
          <div className="subtitle">Report issues or request assistance</div>
        </div>
      </div>

      <div className="form-card">
        <h2>Report a Problem</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of the issue" required />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the problem in detail..." rows={5} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>

      <div className="form-card" style={{ marginTop: 16 }}>
        <h2>Contact Information</h2>
        <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.8 }}>
          <p><strong style={{ color: "var(--text-h)" }}>Library Name:</strong> Lakshya Library</p>
          <p><strong style={{ color: "var(--text-h)" }}>Response Time:</strong> Within 24 hours</p>
          <p><strong style={{ color: "var(--text-h)" }}>Priority Issues:</strong> Contact the library administrator directly</p>
        </div>
      </div>
    </div>
  );
}

export default HelpDesk;
