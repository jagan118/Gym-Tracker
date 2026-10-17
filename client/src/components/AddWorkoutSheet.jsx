import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { workoutAPI } from '../services/api';
import { MUSCLE_GROUPS, GROUP_COLORS } from '../constants/muscleGroups';

export default function AddWorkoutSheet({ onClose, onSaved, initialData, editId }) {
  const isEdit = Boolean(editId);

  const [muscleGroup, setMuscleGroup] = useState(initialData?.muscleGroup || 'Other');
  const [exerciseName, setExerciseName] = useState(initialData?.exerciseName || '');
  const [variation, setVariation] = useState(initialData?.variation || '');
  const [workoutDate, setWorkoutDate] = useState(
    initialData?.workoutDate
      ? format(new Date(initialData.workoutDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  );
  const [weightKg, setWeightKg] = useState(initialData?.weightKg ?? 20);
  const [sets, setSets] = useState(initialData?.sets ?? 3);
  const [repsPerSet, setRepsPerSet] = useState(initialData?.repsPerSet ?? 10);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeField, setActiveField] = useState(null);

  const exerciseRef = useRef(null);
  const variationRef = useRef(null);
  const dateRef = useRef(null);

  // Debounced exercise suggestions, scoped to the current muscle group
  useEffect(() => {
    if (activeField !== 'exercise' || !exerciseName.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionsError('');
      return;
    }
    let current = true; // guards against stale responses
    setSuggestionsError('');
    const t = setTimeout(async () => {
      try {
        const res = await workoutAPI.getExercises({ search: exerciseName });
        const all = res.data.exercises || [];
        const filtered = all.filter(e =>
          !muscleGroup || muscleGroup === 'Other' || e.muscleGroup === muscleGroup || !e.muscleGroup
        );
        if (current) {
          setSuggestions(filtered.length ? filtered : all);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error('Failed to load exercise suggestions', err);
        if (current) {
          setSuggestions([]);
          setSuggestionsError('Suggestions are unavailable. You can still enter a new exercise.');
        }
      }
    }, 250);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [activeField, exerciseName, muscleGroup]);

  const pickSuggestion = (item) => {
    setExerciseName(item.exerciseName);
    setVariation(item.variation || '');
    if (item.muscleGroup) setMuscleGroup(item.muscleGroup);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveField(null);
  };

  // Round to 1 decimal so 2.5 steps never drift (floating-point safe)
  const stepWeight = (delta) =>
    setWeightKg(prev => Math.max(0, Math.round((prev + delta) * 10) / 10));

  const handleSave = async () => {
    if (!exerciseName.trim()) { setError('Exercise name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const payload = {
        exerciseName: exerciseName.trim(),
        muscleGroup,
        variation: variation.trim(),
        workoutDate,
        weightKg: Number(weightKg),
        sets: Number(sets),
        repsPerSet: Number(repsPerSet),
      };
      if (isEdit) {
        await workoutAPI.update(editId, payload);
      } else {
        await workoutAPI.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = (() => {
    try { return format(new Date(workoutDate + 'T00:00:00'), 'MMM d, yyyy'); }
    catch { return workoutDate; }
  })();

  return (
    <div
      className="sheet-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-sheet-title"
    >
      <div className="sheet">
        <div className="sheet-handle" />

        <div className="sheet-header">
          <div id="workout-sheet-title" className="sheet-title">{isEdit ? 'Edit Record' : 'Log Exercise'}</div>
        </div>

        {error && <div className="sheet-error" role="alert">{error}</div>}

        {/* Muscle group chips */}
        {!isEdit && (
          <div style={{ padding: '0 16px 4px' }}>
            <div className="group-picker-label">Muscle Group</div>
            <div className="group-picker" role="group" aria-label="Choose a muscle group">
              {MUSCLE_GROUPS.map(g => {
                const active = muscleGroup === g;
                const color = GROUP_COLORS[g] || GROUP_COLORS.Other;
                return (
                  <button
                    key={g}
                    type="button"
                    className={`group-chip ${active ? 'active' : ''}`}
                    style={{ '--group-color': color }}
                    aria-pressed={active}
                    onClick={() => setMuscleGroup(g)}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Exercise / Variation / Date */}
        <div className="sheet-section">
          <div className="sheet-row" onClick={() => { setActiveField('exercise'); setTimeout(() => exerciseRef.current?.focus(), 0); }}>
            <span className="sheet-row-label">Exercise</span>
            {activeField === 'exercise' ? (
              <input
                ref={exerciseRef}
                className="sheet-input"
                value={exerciseName}
                onChange={e => setExerciseName(e.target.value)}
                // delay so a tap on a suggestion registers before the list closes
                onBlur={() => setTimeout(() => { setActiveField(null); setShowSuggestions(false); }, 200)}
                placeholder="Bench Press, Squat…"
                autoFocus
              />
            ) : (
              <span className="sheet-row-value">{exerciseName || <span style={{ color: 'var(--text-muted)' }}>Tap to set</span>}</span>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="sheet-autocomplete" role="listbox" aria-label="Exercise suggestions">
              {suggestions.slice(0, 5).map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="sheet-autocomplete-item"
                  role="option"
                  aria-selected="false"
                  onPointerDown={e => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                >
                  <span className="sheet-autocomplete-item-name">{s.exerciseName}</span>
                  {s.variation && <span className="sheet-autocomplete-item-variation">{s.variation}</span>}
                </button>
              ))}
            </div>
          )}
          {suggestionsError && <div className="sheet-hint" role="status" style={{ margin: 12 }}>{suggestionsError}</div>}

          <div className="sheet-row" onClick={() => { setActiveField('variation'); setTimeout(() => variationRef.current?.focus(), 0); }}>
            <span className="sheet-row-label">Variation</span>
            {activeField === 'variation' ? (
              <input
                ref={variationRef}
                className="sheet-input"
                value={variation}
                onChange={e => setVariation(e.target.value)}
                onBlur={() => setActiveField(null)}
                placeholder="Incline, Wide-grip…"
              />
            ) : (
              <span className="sheet-row-value">{variation || <span style={{ color: 'var(--text-muted)' }}>Optional</span>}</span>
            )}
          </div>

          <div className="sheet-row" onClick={() => { setActiveField('date'); setTimeout(() => dateRef.current?.showPicker?.(), 50); }}>
            <span className="sheet-row-label">Date</span>
            <span className="sheet-row-value" style={{ position: 'relative' }}>
              {formattedDate}
              <input
                ref={dateRef}
                type="date"
                value={workoutDate}
                onChange={e => setWorkoutDate(e.target.value)}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, top: 0, left: 0 }}
                tabIndex={-1}
              />
            </span>
          </div>
        </div>

        {/* Weight / Sets / Reps steppers */}
        <div className="sheet-section">
          <div className="sheet-row">
            <span className="sheet-row-label">Weight</span>
            <div className="stepper-group">
              <button type="button" className="stepper-btn" onClick={() => stepWeight(-2.5)} disabled={weightKg <= 0} aria-label="Decrease weight">−</button>
              <span className="sheet-stepper-value">{weightKg}</span>
              <span className="sheet-stepper-unit">kg</span>
              <button type="button" className="stepper-btn" onClick={() => stepWeight(2.5)} aria-label="Increase weight">+</button>
            </div>
          </div>

          <div className="sheet-row">
            <span className="sheet-row-label">Sets</span>
            <div className="stepper-group">
              <button type="button" className="stepper-btn" onClick={() => setSets(s => Math.max(1, s - 1))} disabled={sets <= 1} aria-label="Decrease sets">−</button>
              <span className="sheet-stepper-value">{sets}</span>
              <button type="button" className="stepper-btn" onClick={() => setSets(s => Math.min(100, s + 1))} aria-label="Increase sets">+</button>
            </div>
          </div>

          <div className="sheet-row">
            <span className="sheet-row-label">Reps</span>
            <div className="stepper-group">
              <button type="button" className="stepper-btn" onClick={() => setRepsPerSet(r => Math.max(1, r - 1))} disabled={repsPerSet <= 1} aria-label="Decrease reps">−</button>
              <span className="sheet-stepper-value">{repsPerSet}</span>
              <button type="button" className="stepper-btn" onClick={() => setRepsPerSet(r => Math.min(10000, r + 1))} aria-label="Increase reps">+</button>
            </div>
          </div>
        </div>

        <div className="sheet-buttons">
          <button className="sheet-save-btn" onClick={handleSave} disabled={loading}>
            {loading ? <span className="spinner" /> : isEdit ? 'Save Changes' : 'Save Workout'}
          </button>
          <button className="sheet-cancel-btn" onClick={onClose} disabled={loading}>Cancel</button>
        </div>
      </div>
    </div>
  );
}