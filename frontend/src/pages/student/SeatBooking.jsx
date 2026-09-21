import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { studentAPI } from "../../services/api";
import { useToast } from "../../context/useToast";

const ROOM_LAYOUTS = {
  1: {
    name: "Room 1", totalSeats: 20,
    top: ["S-10", "S-18", "S-19", "S-01", "S-02"],
    left: ["S-11", "S-20", "S-21", "S-22", "S-23", "S-24"],
    right: ["S-03", "S-04", "S-05", "S-06", "S-07", "S-08", "S-09"],
    bottom: ["S-13", "S-12"],
  },
  2: {
    name: "Room 2", totalSeats: 19,
    top: ["S-31", "S-32", "S-33", "S-34", "S-35"],
    left: ["S-30", "S-29", "S-28", "S-27", "S-26", "S-25"],
    right: ["S-36", "S-37", "S-38", "S-39", "S-40", "S-41", "S-42"],
    bottom: ["S-43"],
  },
  3: {
    name: "Room 3", totalSeats: 4,
    top: [], left: [], right: [], bottom: [],
    middle: ["S3-14", "S3-15", "S3-16", "S3-17"],
  },
};

function seatDisplay(seatNum) {
  const match = seatNum.match(/\d+$/);
  return match ? match[0] : seatNum;
}

function SeatBooking() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const plan = location.state?.plan || (() => {
    try { const s = sessionStorage.getItem("selectedPlan"); return s ? JSON.parse(s) : null; } catch { return null; }
  })();

  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState(null);

  useEffect(() => {
    if (!plan) { navigate("/student/membership"); return; }
    studentAPI.getSeats().then(setSeats).catch(() => toast.error("Failed to load seats")).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getSeatStatus = (num) => { const s = seats.find((s) => s.seat_number === num); return s ? s.status : "unavailable"; };
  const getSeatClass = (num) => {
    if (selectedSeat?.seat_number === num) return "seat selected";
    const st = getSeatStatus(num);
    return `seat ${st}`;
  };
  const canClick = (num) => getSeatStatus(num) === "available";

  const handleContinue = () => {
    if (!selectedSeat) { toast.error("Please select a seat"); return; }
    navigate("/student/payment", { state: { plan, seat: selectedSeat } });
  };

  const renderSeat = (num) => (
    <button key={num} className={getSeatClass(num)}
      onClick={() => canClick(num) && setSelectedSeat(seats.find((s) => s.seat_number === num))}
      title={`Seat ${seatDisplay(num)}`} disabled={!canClick(num) && selectedSeat?.seat_number !== num}>
      {seatDisplay(num)}
    </button>
  );

  const renderRoom = (id) => {
    const L = ROOM_LAYOUTS[id];
    const allSeats = [...L.top, ...L.left, ...L.right, ...L.bottom, ...(L.middle || [])];
    const stats = { available: 0, booked: 0, reserved: 0, unavailable: 0 };
    allSeats.forEach(n => {
      const st = getSeatStatus(n);
      if (stats[st] !== undefined) stats[st]++; else stats.unavailable++;
    });
    return (
      <div className="room-card" key={id}>
        <div className="room-header">
          <h3>{L.name}</h3>
          <span className="seat-count">{allSeats.length} Seats</span>
        </div>
        <div className="room-subtitle">
          {L.top.length > 0 && `Top: ${L.top.map(seatDisplay).join(", ")}`}
          {L.left.length > 0 && ` | Left: ${L.left.map(seatDisplay).join(", ")}`}
          {L.right.length > 0 && ` | Right: ${L.right.map(seatDisplay).join(", ")}`}
          {L.bottom.length > 0 && ` | Bottom: ${L.bottom.map(seatDisplay).join(", ")}`}
          {L.middle && L.middle.length > 0 && `Middle: ${L.middle.map(seatDisplay).join(", ")}`}
        </div>
        <div className="room-layout">
          {L.top.length > 0 && <div className="room-top-row">{L.top.map(renderSeat)}</div>}
          <div className="room-body">
            {L.left.length > 0 && <div className="room-left-col">{L.left.map(renderSeat)}</div>}
            <div className="room-center">
              {L.middle && L.middle.length > 0 ? (
                <div className="room-middle-seats">{L.middle.map(renderSeat)}</div>
              ) : (
                <div className="room-center-inner">
                  <div className="room-center-label">Study Area</div>
                </div>
              )}
            </div>
            {L.right.length > 0 && <div className="room-right-col">{L.right.map(renderSeat)}</div>}
          </div>
          {L.bottom.length > 0 && (
            <div className="room-bottom-row">
              <div className="entrance-gate">
                <span className="gate-arrow">&uarr;</span>
                <span>Entrance</span>
                <span>(Gate)</span>
              </div>
              {L.bottom.map(renderSeat)}
            </div>
          )}
          {id === 3 && (
            <div className="room-bottom-row" style={{ justifyContent: 'center' }}>
              <div className="entrance-gate">
                <span className="gate-arrow">&uarr;</span>
                <span>Entrance</span>
                <span>(Gate)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading seats...</p></div>;

  const totalSeats = seats.length;
  const availCount = seats.filter(s => s.status === "available").length;
  const bookedCount = seats.filter(s => s.status === "booked").length;
  const reservedCount = seats.filter(s => s.status === "reserved").length;
  const unavailCount = totalSeats - availCount - bookedCount - reservedCount;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="label">Student Portal</div>
          <h1>&#128186; Select Your Seat</h1>
          <div className="subtitle">
            {plan && <span>Plan: <strong>{plan.name}</strong> &mdash; </span>}
            Choose from 43 dedicated seats. Real room layout as per Lakshya Library.
          </div>
        </div>
      </div>

      <div className="booking-stepper">
        <div className="stepper-step completed" onClick={() => navigate("/student/membership", { state: { plan } })}>
          <div className="stepper-number">&#10003;</div><span>Membership</span>
        </div>
        <div className="stepper-line active" />
        <div className="stepper-step active"><div className="stepper-number">2</div><span>Seat Selection</span></div>
        <div className="stepper-line" />
        <div className="stepper-step"><div className="stepper-number">3</div><span>Payment</span></div>
        <div className="stepper-line" />
        <div className="stepper-step"><div className="stepper-number">4</div><span>Confirmation</span></div>
      </div>

      <div className="seat-legend">
        <div className="legend-item"><div className="legend-dot available" /><span>Available</span></div>
        <div className="legend-item"><div className="legend-dot booked" /><span>Occupied</span></div>
        <div className="legend-item"><div className="legend-dot reserved" /><span>Reserved</span></div>
        <div className="legend-item"><div className="legend-dot unavailable" /><span>Unavailable</span></div>
      </div>

      <div className="rooms-container">
        {renderRoom(1)}
        {renderRoom(2)}
        {renderRoom(3)}
      </div>

      {selectedSeat && (
        <div className="booking-panel">
          <div className="booking-info">
            <h3>Seat {seatDisplay(selectedSeat.seat_number)}</h3>
            <p>Room: {selectedSeat.room_name} &mdash; Plan: {plan?.name}</p>
          </div>
          <button className="btn btn-primary" onClick={handleContinue}>
            Continue to Payment &#8594;
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <div className="stat-card" style={{ flex: '1 1 120px', textAlign: 'center' }}>
          <span className="stat-icon">&#128186;</span>
          <span className="stat-number">{totalSeats}</span>
          <span className="stat-label">Total Seats</span>
        </div>
        <div className="stat-card" style={{ flex: '1 1 120px', textAlign: 'center' }}>
          <span className="stat-icon">&#127970;</span>
          <span className="stat-number">3</span>
          <span className="stat-label">Library Rooms</span>
        </div>
        <div className="stat-card" style={{ flex: '1 1 120px', textAlign: 'center' }}>
          <span className="stat-icon" style={{ color: 'var(--success)' }}>&#128186;</span>
          <span className="stat-number" style={{ color: 'var(--success)' }}>{availCount}</span>
          <span className="stat-label">Available Seats</span>
        </div>
        <div className="stat-card" style={{ flex: '1 1 120px', textAlign: 'center' }}>
          <span className="stat-icon" style={{ color: 'var(--danger)' }}>&#128186;</span>
          <span className="stat-number" style={{ color: 'var(--danger)' }}>{bookedCount}</span>
          <span className="stat-label">Occupied Seats</span>
        </div>
        <div className="stat-card" style={{ flex: '1 1 120px', textAlign: 'center' }}>
          <span className="stat-icon" style={{ color: 'var(--orange)' }}>&#128186;</span>
          <span className="stat-number" style={{ color: 'var(--orange)' }}>{reservedCount}</span>
          <span className="stat-label">Reserved Seats</span>
        </div>
        <div className="stat-card" style={{ flex: '1 1 120px', textAlign: 'center' }}>
          <span className="stat-icon" style={{ color: 'var(--warning)' }}>&#128186;</span>
          <span className="stat-number" style={{ color: 'var(--warning)' }}>{unavailCount}</span>
          <span className="stat-label">Unavailable Seats</span>
        </div>
      </div>
    </div>
  );
}

export default SeatBooking;
