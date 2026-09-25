import { useState, useEffect } from "react";
import { adminAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

const slotKey = (id) => `slot-${id}`;
const comboKey = (id) => `combo-${id}`;

function Pricing() {
  const toast = useToast();
  const [data, setData] = useState({ slots: [], combos: [] });
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    adminAPI.getSlotPricing()
      .then((d) => {
        setData(d);
        const initial = {};
        (d.slots || []).forEach((s) => { initial[slotKey(s.id)] = String(s.price); });
        (d.combos || []).forEach((c) => { initial[comboKey(c.id)] = String(c.price); });
        setDrafts(initial);
      })
      .catch(() => toast.error("Failed to load slot pricing"))
      .finally(() => setLoading(false));
  }, [toast]);

  const setDraft = (key, value) => setDrafts((prev) => ({ ...prev, [key]: value }));

  const validate = (raw) => {
    const price = Number(raw);
    if (raw === "" || !Number.isInteger(price) || price < 0) {
      toast.error("Price must be a non-negative whole number");
      return null;
    }
    return price;
  };

  const saveSlot = async (slot) => {
    const key = slotKey(slot.id);
    const price = validate(drafts[key]);
    if (price === null) return;
    setSavingId(key);
    try {
      const r = await adminAPI.updateSlotPrice(slot.id, price);
      setData((prev) => ({
        ...prev,
        slots: prev.slots.map((s) => (s.id === slot.id ? { ...s, price: r.slot.price, is_active: r.slot.is_active } : s)),
      }));
      toast.success(`Slot ${slot.slot_number} pricing updated`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const toggleSlotStatus = async (slot) => {
    const key = slotKey(slot.id);
    setSavingId(key);
    try {
      const r = await adminAPI.updateSlotStatus(slot.id, !slot.is_active);
      setData((prev) => ({
        ...prev,
        slots: prev.slots.map((s) => (s.id === slot.id ? { ...s, price: r.slot.price, is_active: r.slot.is_active } : s)),
      }));
      toast.success(`Slot ${slot.slot_number} ${r.slot.is_active ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const saveCombo = async (combo) => {
    const key = comboKey(combo.id);
    const price = validate(drafts[key]);
    if (price === null) return;
    setSavingId(key);
    try {
      const r = await adminAPI.updateSlotComboPrice(combo.id, price);
      setData((prev) => ({
        ...prev,
        combos: prev.combos.map((c) => (c.id === combo.id ? { ...c, price: r.combo.price, is_active: r.combo.is_active } : c)),
      }));
      toast.success(`${combo.label} pricing updated`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading pricing...</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Admin Panel</div>
          <h1>Slot Pricing</h1>
          <div className="subtitle">
            Control individual slot prices and special combination prices. Changes apply to new bookings only.
          </div>
        </div>
      </div>

      <div className="table-card" style={{ marginBottom: 16 }}>
        <h2>Individual Slots</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Slot</th>
                <th>Timing</th>
                <th>Price (&#8377;)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.slots.map((slot) => {
                const key = slotKey(slot.id);
                return (
                  <tr key={slot.id}>
                    <td data-label="Slot"><strong>Slot {slot.slot_number}</strong></td>
                    <td data-label="Timing">{slot.name}</td>
                    <td data-label="Price">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        style={{ width: 110 }}
                        value={drafts[key] ?? ""}
                        onChange={(e) => setDraft(key, e.target.value)}
                      />
                    </td>
                    <td data-label="Status">
                      <span className={`status-badge ${slot.is_active ? "status-active" : "status-rejected"}`}>
                        {slot.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveSlot(slot)}
                          disabled={savingId === key}
                        >
                          {savingId === key ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleSlotStatus(slot)}
                          disabled={savingId === key}
                        >
                          {slot.is_active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card">
        <h2>Combination Prices</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>
          A combination price replaces the sum of its individual slot prices whenever those slots are selected together.
        </p>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Combination</th>
                <th>Slots</th>
                <th>Price (&#8377;)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.combos.map((combo) => {
                const key = comboKey(combo.id);
                return (
                  <tr key={combo.id}>
                    <td data-label="Combination"><strong>{combo.label}</strong></td>
                    <td data-label="Slots">
                      {combo.slots.map((s) => `${s.slot_number} \u2014 ${s.name}`).join(" | ")}
                    </td>
                    <td data-label="Price">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        style={{ width: 110 }}
                        value={drafts[key] ?? ""}
                        onChange={(e) => setDraft(key, e.target.value)}
                      />
                    </td>
                    <td data-label="Status">
                      <span className={`status-badge ${combo.is_active ? "status-active" : "status-rejected"}`}>
                        {combo.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => saveCombo(combo)}
                        disabled={savingId === key}
                      >
                        {savingId === key ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Pricing;
