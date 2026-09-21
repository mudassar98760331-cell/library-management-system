import { useState, useEffect } from "react";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    studentAPI.getProfile().then((p) => { setProfile(p); setName(p.name || ""); setPhone(p.phone || ""); }).catch(() => toast.error("Failed to load profile")).finally(() => setLoading(false));
  }, [toast]);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await studentAPI.updateProfile({ name, phone }); toast.success("Profile updated!"); setEditing(false); setProfile(await studentAPI.getProfile()); }
    catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) { toast.error("Please fill in both fields"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try { await studentAPI.changePassword(currentPassword, newPassword); toast.success("Password changed!"); setCurrentPassword(""); setNewPassword(""); }
    catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;
  if (!profile) return <div className="empty-state"><h3>Failed to load profile</h3></div>;

  const initials = profile.name ? profile.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Student Portal</div>
          <h1>My Profile</h1>
          <div className="subtitle">Manage your account details</div>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-info">
          <h2>{profile.name}</h2>
          <p>Email Address</p>
          <p style={{ color: 'var(--text-h)', marginBottom: 4 }}>{profile.email}</p>
          {profile.phone && <><p>Mobile Number</p><p style={{ color: 'var(--text-h)' }}>+91 {profile.phone}</p></>}
        </div>
      </div>

      <div className="profile-stats-grid">
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 4 }}>Member Since</div>
          <div style={{ fontSize: 14, color: 'var(--text-h)' }}>{new Date(profile.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 4 }}>Membership Plan</div>
          <div style={{ fontSize: 14, color: 'var(--text-h)' }}>{profile.membership_plan || "—"}</div>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 4 }}>Membership Expiry</div>
          <div style={{ fontSize: 14, color: 'var(--text-h)' }}>{profile.membership_expiry ? new Date(profile.membership_expiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</div>
        </div>
      </div>

      <div className="form-card">
        <div className="form-header">
          <h2>Personal Information</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Change Password"}</button>
        </div>
        {editing ? (
          <form onSubmit={handleChangePassword}>
            <div className="form-group"><label>Current Password</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
            <div className="form-group"><label>New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Changing..." : "Change Password"}</button>
          </form>
        ) : (
          <form onSubmit={handleSave}>
            <div className="form-group"><label>Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="form-group"><label>Mobile Number</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Profile;
