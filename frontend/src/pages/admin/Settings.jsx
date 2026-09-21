import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState({
    qr_code_url: "", receiver_name: "NISHANT SAHU", upi_id: "", note: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);

  useEffect(() => {
    adminAPI.getSettings()
      .then(setSettings)
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await adminAPI.updateSettings(settings); toast.success("Settings saved!"); }
    catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleQRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File must be less than 5MB"); return; }
    setUploadingQR(true);
    try {
      const updated = await adminAPI.uploadQR(file);
      setSettings(updated);
      toast.success("QR code updated!");
    } catch (err) { toast.error(err.message); } finally { setUploadingQR(false); }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Settings</h1>
          <div className="subtitle">Manage payment configuration</div>
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: 560 }}>
        <h2>Payment Settings</h2>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>QR Code Image</label>
            {settings.qr_code_url && <img src={settings.qr_code_url} alt="Current QR" className="qr-preview" style={{ marginBottom: 10 }} />}
            <div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleQRUpload} disabled={uploadingQR} />
              {uploadingQR && <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "block" }}>Uploading...</span>}
            </div>
          </div>
          <div className="form-group">
            <label>Receiver Name</label>
            <input type="text" value={settings.receiver_name || ""} onChange={(e) => setSettings({ ...settings, receiver_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>UPI ID</label>
            <input type="text" value={settings.upi_id || ""} onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })} placeholder="yourname@upi" />
          </div>
          <div className="form-group">
            <label>Note</label>
            <textarea value={settings.note || ""} onChange={(e) => setSettings({ ...settings, note: e.target.value })} rows={3} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Settings;
