import { useState } from "react";
import { studentAPI } from "../../services/api";
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
      await studentAPI.submitLostFound({
        item_name: `Help: ${subject}`,
        description: message,
        location: "Help Desk",
        status: "lost",
      });
      toast.success("Help request submitted successfully");
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
          <div className="label">Student Portal</div>
          <h1>Help Desk</h1>
          <div className="subtitle">Need help? Report a problem or ask a question</div>
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
        <h2>Quick Help</h2>
        <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.8 }}>
          <p><strong style={{ color: "var(--text-h)" }}>Booking Issues:</strong> If you face problems while booking a seat, try refreshing the page or contact support.</p>
          <p><strong style={{ color: "var(--text-h)" }}>Payment Issues:</strong> If your payment is not reflecting, allow up to 24 hours for admin verification.</p>
          <p><strong style={{ color: "var(--text-h)" }}>Membership:</strong> Contact the library administrator for membership-related queries.</p>
        </div>
      </div>
    </div>
  );
}

export default HelpDesk;
