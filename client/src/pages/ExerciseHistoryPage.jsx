import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { workoutAPI } from '../services/api';
import TabBar from '../components/TabBar';
import AddWorkoutSheet from '../components/AddWorkoutSheet';
import ConfirmDialog from '../components/ConfirmDialog';

// ── Lightweight canvas line chart ─────────────────────────────────────────────
function ProgressChart({ records, filter }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // useMemo: without it `filtered` is a new array every render,
  // so the drawing effect below would re-run on every render.
  const filtered = useMemo(() => {
    const now = new Date();
    const days = filter === '1M' ? 30 : filter === '3M' ? 90 : 365;
    return records
      .filter(r => {
        const age = differenceInDays(now, new Date(r.workoutDate));
        return age >= 0 && age <= days;
      })
      .slice()
      .reverse(); // oldest -> newest, left to right
  }, [records, filter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || filtered.length < 1) return;

    // Scale by devicePixelRatio so the chart is crisp on retina screens
    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = 130;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const weights = filtered.map(r => r.weightKg);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;
    const padX = 14, padY = 24;
    const chartW = W - padX * 2;
    const chartH = H - padY * 2;

    const toX = i => padX + (i / Math.max(filtered.length - 1, 1)) * chartW;
    const toY = w => padY + chartH - ((w - minW) / range) * chartH;

    // Soft gradient under the line
    const grad = ctx.createLinearGradient(0, padY, 0, H);
    grad.addColorStop(0, 'rgba(203,255,71,0.28)');
    grad.addColorStop(1, 'rgba(203,255,71,0)');
    ctx.beginPath();
    filtered.forEach((r, i) => (i === 0 ? ctx.moveTo(toX(i), toY(r.weightKg)) : ctx.lineTo(toX(i), toY(r.weightKg))));
    ctx.lineTo(toX(filtered.length - 1), H);
    ctx.lineTo(toX(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line with glow
    ctx.beginPath();
    filtered.forEach((r, i) => (i === 0 ? ctx.moveTo(toX(i), toY(r.weightKg)) : ctx.lineTo(toX(i), toY(r.weightKg))));
    ctx.strokeStyle = '#cbff47';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(203,255,71,0.6)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dots + labels (thin out labels so they never overlap)
    const labelEvery = Math.max(1, Math.ceil(filtered.length / 6));
    filtered.forEach((r, i) => {
      const x = toX(i), y = toY(r.weightKg);
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#cbff47'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#131316'; ctx.fill();
      if (i % labelEvery !== 0 && i !== filtered.length - 1) return;
      ctx.fillStyle = '#cbff47';
      ctx.font = '700 11px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.weightKg}kg`, x, y - 11);
      ctx.fillStyle = '#63636b';
      ctx.font = '10px Inter,sans-serif';
      ctx.fillText(format(new Date(r.workoutDate), 'MMM d'), x, H - 3);
    });
  }, [filtered]);

  if (filtered.length === 0) return <div className="chart-empty">No data for this period</div>;

  return (
    <div ref={containerRef} style={{ width: '100%', paddingTop: 4 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}

// ── Inline edit row ───────────────────────────────────────────────────────────
function InlineEditCard({ record, isPR, onSaved, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [weightKg, setWeightKg] = useState(record.weightKg);
  const [sets, setSets] = useState(record.sets);
  const [repsPerSet, setRepsPerSet] = useState(record.repsPerSet);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const stepWeight = delta => setWeightKg(prev => Math.max(0, Math.round((prev + delta) * 10) / 10));

  const handleSave = async () => {
    setSaving(true);
    setActionError('');
    try {
      await workoutAPI.update(record._id, { weightKg: Number(weightKg), sets: Number(sets), repsPerSet: Number(repsPerSet) });
      setEditing(false);
      onSaved();
    } catch (err) {
      console.error('Update failed', err);
      setActionError(err.response?.data?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setActionError('');
    try {
      await workoutAPI.delete(record._id);
      onDelete(record._id);
    } catch (err) {
      console.error('Delete failed', err);
      setActionError(err.response?.data?.message || 'Could not delete this record. Please try again.');
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(false);
    }
  };

  const dateLabel = (() => {
    try { return format(new Date(record.workoutDate), 'MMM d, yyyy'); } catch { return ''; }
  })();

  return (
    <div className={`record-card ${editing ? 'record-card--editing' : ''}`}>
      {actionError && <div className="action-error" role="alert">{actionError}</div>}
      <div className="record-card-top">
        <div className="record-card-date">
          {dateLabel}
          {isPR && <span className="record-pr">PR</span>}
        </div>
        <div className="record-card-actions">
          {!editing && (
            <>
              <button
                className="record-action-btn"
                onClick={() => { setEditing(true); setActionError(''); setWeightKg(record.weightKg); setSets(record.sets); setRepsPerSet(record.repsPerSet); }}
                title="Edit" aria-label={`Edit record from ${dateLabel}`}
              ><Pencil size={15} aria-hidden="true" />Edit</button>
              <button className="record-action-btn danger" onClick={() => setConfirmDelete(true)} title="Delete" aria-label={`Delete record from ${dateLabel}`}>
                <Trash2 size={15} aria-hidden="true" />Delete
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="record-edit-body">
          <div className="record-edit-row">
            <span className="record-edit-label">Weight</span>
            <div className="stepper-group">
              <button className="stepper-btn" onClick={() => stepWeight(-2.5)} disabled={weightKg <= 0}>−</button>
              <span className="sheet-stepper-value">{weightKg}</span>
              <span className="sheet-stepper-unit">kg</span>
              <button className="stepper-btn" onClick={() => stepWeight(2.5)}>+</button>
            </div>
          </div>
          <div className="record-edit-row">
            <span className="record-edit-label">Sets</span>
            <div className="stepper-group">
              <button className="stepper-btn" onClick={() => setSets(s => Math.max(1, s - 1))} disabled={sets <= 1}>−</button>
              <span className="sheet-stepper-value">{sets}</span>
              <button className="stepper-btn" onClick={() => setSets(s => Math.min(100, s + 1))}>+</button>
            </div>
          </div>
          <div className="record-edit-row">
            <span className="record-edit-label">Reps</span>
            <div className="stepper-group">
              <button className="stepper-btn" onClick={() => setRepsPerSet(r => Math.max(1, r - 1))} disabled={repsPerSet <= 1}>−</button>
              <span className="sheet-stepper-value">{repsPerSet}</span>
              <button className="stepper-btn" onClick={() => setRepsPerSet(r => Math.min(10000, r + 1))}>+</button>
            </div>
          </div>
          <div className="record-edit-btns">
            <button className="record-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save Changes'}
            </button>
            <button className="record-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="record-view-body">
          <div className="record-weight">{record.weightKg}<span> kg</span></div>
          <div className="record-meta">{record.sets} sets <span className="dot">·</span> {record.repsPerSet} reps</div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Record"
          message={`Delete this ${dateLabel} record? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

// ── Main History Page ─────────────────────────────────────────────────────────
export default function ExerciseHistoryPage() {
  const { exerciseName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const variation = location.state?.variation || '';
  const muscleGroup = location.state?.muscleGroup || '';
  const decodedName = exerciseName;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [chartFilter, setChartFilter] = useState('1M');
  const [showAddSheet, setShowAddSheet] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await workoutAPI.getHistory(decodedName, { variation });
      setRecords(res.data.workouts || []);
    } catch (err) {
      console.error('Failed to load history', err);
      setLoadError('Could not load workout history. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [decodedName, variation]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleRecordDeleted = (id) => setRecords(prev => prev.filter(r => r._id !== id));

  const latest = records[0];
  const previous = records[1];
  const progressDiff = latest && previous
    ? Number((latest.weightKg - previous.weightKg).toFixed(1))
    : null;

  // Personal record = heaviest lift. Flag the most recent record that hit it.
  const bestWeight = useMemo(
    () => (records.length ? Math.max(...records.map(r => r.weightKg)) : 0),
    [records]
  );
  const prId = useMemo(
    () => (records.length > 1 ? records.find(r => r.weightKg === bestWeight)?._id : null),
    [records, bestWeight]
  );

  const progressClass = progressDiff === null ? '' : progressDiff > 0 ? '' : progressDiff < 0 ? 'down' : 'flat';

  return (
    <div className="app-shell">
      <div className="page">
        <div className="page-inner">
          <button className="back-nav" onClick={() => navigate(-1)}>
            {muscleGroup || 'My Workouts'}
          </button>

          <h1 className="history-exercise-title">{decodedName}</h1>
          {variation && <div className="history-variation">{variation}</div>}

          {loading ? (
            <div className="loading-center"><div className="spinner spinner-lg" /></div>
          ) : loadError ? (
            <div className="empty-state" role="alert">
              <div className="empty-state-title">{loadError}</div>
              <button className="retry-btn" onClick={loadHistory}>Try again</button>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No records yet</div>
              <div className="empty-state-text">Log a workout to start tracking your progress.</div>
            </div>
          ) : (
            <>
              {/* Latest highlight — the hero number */}
              {latest && (
                <div className="latest-section">
                  <div className="latest-label">Latest · {format(new Date(latest.workoutDate), 'MMM d')}</div>
                  <div className="latest-weight">{latest.weightKg}<span> kg</span></div>
                  <div className="latest-meta">{latest.sets} sets <span className="dot">·</span> {latest.repsPerSet} reps</div>
                  {progressDiff !== null && (
                    <div className={`progress-tag ${progressClass}`}>
                      {progressDiff > 0 ? '↑ +' : progressDiff < 0 ? '↓ ' : '→ '}{progressDiff} kg vs {format(new Date(previous.workoutDate), 'MMM d')}
                    </div>
                  )}
                </div>
              )}

              {/* Quick stats */}
              <div className="quick-stats">
                <div className="stat-tile">
                  <div className="stat-tile-value">{bestWeight}</div>
                  <div className="stat-tile-label">Best (kg)</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-value">{records.length}</div>
                  <div className="stat-tile-label">Sessions</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-value">{latest.sets * latest.repsPerSet}</div>
                  <div className="stat-tile-label">Last Total Reps</div>
                </div>
              </div>

              {/* Chart */}
              <div className="chart-section">
                <div className="chart-header">
                  <span className="chart-label">Weight Progress</span>
                  <div className="chart-filters">
                    {['1M', '3M', '1Y'].map(f => (
                      <button key={f} className={`chart-filter-btn ${chartFilter === f ? 'active' : ''}`} onClick={() => setChartFilter(f)}>{f}</button>
                    ))}
                  </div>
                </div>
                <ProgressChart records={records} filter={chartFilter} />
              </div>

              <div className="past-records-label">
                All Records <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({records.length})</span>
              </div>
              {records.map(record => (
                <InlineEditCard
                  key={record._id}
                  record={record}
                  isPR={record._id === prId}
                  onSaved={loadHistory}
                  onDelete={handleRecordDeleted}
                />
              ))}
            </>
          )}
        </div>

        <button className="add-exercise-btn" onClick={() => setShowAddSheet(true)}>
          + Log Workout
        </button>
      </div>

      <TabBar />

      {showAddSheet && (
        <AddWorkoutSheet
          initialData={{ exerciseName: decodedName, variation, muscleGroup }}
          onClose={() => setShowAddSheet(false)}
          onSaved={() => { setShowAddSheet(false); loadHistory(); }}
        />
      )}
    </div>
  );
}