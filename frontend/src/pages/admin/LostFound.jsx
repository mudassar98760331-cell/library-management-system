import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function LostFound() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getLostFound()
      .then(setItems)
      .catch(() => toast.error("Failed to load items"))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleUpdate = async (id, status) => {
    try {
      await adminAPI.updateLostFound(id, status);
      toast.success("Status updated");
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Lost & Found</h1>
          <div className="subtitle">Manage lost and found items</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state"><h3>No items reported</h3></div>
      ) : (
        <div className="table-container seats-table-card">
          <table>
            <thead>
              <tr><th>Item</th><th>Reported By</th><th>Location</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td data-label="Item">
                    <div>{i.item_name}</div>
                    {i.description && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{i.description}</div>}
                  </td>
                  <td data-label="Reported By">{i.reported_by || "Anonymous"}</td>
                  <td data-label="Location">{i.location || "\u2014"}</td>
                  <td data-label="Status">
                    <span className={`status-badge ${i.status === "found" || i.status === "returned" ? "status-active" : i.status === "closed" ? "status-closed" : "status-pending"}`}>
                      {i.status}
                    </span>
                  </td>
                  <td data-label="Date">{new Date(i.created_at).toLocaleDateString()}</td>
                  <td data-label="Actions" className="actions-cell">
                    {i.status === "lost" && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(i.id, "found")}>Mark Found</button>
                    )}
                    {i.status === "found" && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(i.id, "returned")}>Returned</button>
                    )}
                    {i.status === "returned" && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleUpdate(i.id, "closed")}>Close</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LostFound;
