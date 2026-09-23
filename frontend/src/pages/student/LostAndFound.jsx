import { useState, useEffect } from "react";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function LostAndFound() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("lost");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { studentAPI.getLostFound().then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemName.trim() || !description.trim()) { toast.error("Please fill in item name and description"); return; }
    setSubmitting(true);
    try { await studentAPI.submitLostFound({ item_name: itemName, description, location, status: type }); toast.success("Item reported!"); setItemName(""); setDescription(""); setLocation(""); setItems(await studentAPI.getLostFound()); }
    catch (err) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="page-header"><div><div className="label">Student Portal</div><h1>&#128270; Lost & Found</h1><div className="subtitle">Report lost items or claim found belongings</div></div></div>
      <div className="form-card">
        <h2>Report an Item</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Item Name</label><input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g., Blue water bottle" required /></div>
          <div className="form-group"><label>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the item..." rows={3} required /></div>
          <div className="form-group"><label>Location</label><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where was it lost/found?" /></div>
          <div className="form-group"><label>Type</label><select value={type} onChange={(e) => setType(e.target.value)}><option value="lost">Lost</option><option value="found">Found</option></select></div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Submitting..." : "Report Item"}</button>
        </form>
      </div>
      <div className="request-history">
        <h2 style={{ marginBottom: 12 }}>Recent Reports</h2>
        {loading ? <div className="empty-state"><div className="spinner" /></div> : items.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No reports yet.</p> : (
          <div className="item-list">
            {items.map(item => (
              <div key={item.id} className="item-card">
                <div className="item-header"><h3>{item.item_name}</h3><span className={`status-badge ${item.status === "found" || item.status === "returned" ? "status-active" : item.status === "closed" ? "status-closed" : "status-pending"}`}>{item.status}</span></div>
                <p style={{ fontSize: 13 }}>{item.description}</p>
                {item.location && <p className="item-location">&#128205; {item.location}</p>}
                <div className="item-meta">Reported by {item.reported_by || "Anonymous"} &bull; {new Date(item.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LostAndFound;
