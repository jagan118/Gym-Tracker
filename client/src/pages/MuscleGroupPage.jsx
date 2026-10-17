import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { workoutAPI } from '../services/api';
import TabBar from '../components/TabBar';
import AddWorkoutSheet from '../components/AddWorkoutSheet';
import { GROUP_COLORS } from '../constants/Musclegroups';

export default function MuscleGroupPage() {
  const { group } = useParams();
  const navigate = useNavigate();
  const decodedGroup = group;

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAddSheet, setShowAddSheet] = useState(false);

  const color = GROUP_COLORS[decodedGroup] || GROUP_COLORS.Other;

  const loadExercises = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await workoutAPI.getGroupExercises(decodedGroup);
      setExercises(res.data.exercises || []);
    } catch (err) {
      console.error('Failed to load group exercises', err);
      setLoadError('Could not load these exercises. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [decodedGroup]);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  const goToHistory = (ex) => {
    navigate(`/exercise/${encodeURIComponent(ex.exerciseName)}`, {
      state: { variation: ex.variation || '', muscleGroup: decodedGroup },
    });
  };

  return (
    <div className="app-shell">
      <div className="page">
        <div className="page-inner">
          <button className="back-nav" onClick={() => navigate(-1)}>My Workouts</button>

          <div className="group-header">
            <h1 className="history-exercise-title" style={{ margin: 0, color }}>
              {decodedGroup}
            </h1>
          </div>

          {loading ? (
            <div className="loading-center"><div className="spinner spinner-lg" /></div>
          ) : loadError ? (
            <div className="empty-state" role="alert">
              <div className="empty-state-title">{loadError}</div>
              <button className="retry-btn" onClick={loadExercises}>Try again</button>
            </div>
          ) : exercises.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No {decodedGroup} exercises yet</div>
              <div className="empty-state-text">
                Tap "Add Exercise" to log your first {decodedGroup.toLowerCase()} workout.
              </div>
            </div>
          ) : (
            <div className="exercise-list">
              {exercises.map(ex => {
                const dateStr = (() => {
                  try { return format(new Date(ex.lastDate), 'MMM d'); } catch { return ''; }
                })();
                return (
                  <div
                    key={`${ex.exerciseNameNormalized}|${ex.variation || ''}`}
                    className="exercise-card"
                    onClick={() => goToHistory(ex)}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && goToHistory(ex)}
                  >
                    <div className="exercise-card-left">
                      <div className="exercise-card-name">{ex.exerciseName}</div>
                      {decodedGroup === 'Cardio' ? (
                        <>
                          <div className="exercise-card-weight">{ex.lastSteps ? ex.lastSteps.toLocaleString() : '—'}<span> steps</span></div>
                          {(ex.lastCardioExerciseName || ex.lastCardioExerciseInfo) && (
                            <div className="exercise-card-meta">
                              {ex.lastCardioExerciseName}
                              {ex.lastCardioExerciseName && ex.lastCardioExerciseInfo ? ' · ' : ''}
                              {ex.lastCardioExerciseInfo}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="exercise-weight-row">
                            <div className="exercise-card-weight">{ex.lastWeight}<span> kg</span></div>
                            {Number.isFinite(ex.previousWeight) && ex.lastWeight !== ex.previousWeight && (
                              <span
                                className={`exercise-weight-change ${ex.lastWeight > ex.previousWeight ? 'increased' : 'decreased'}`}
                                aria-label={ex.lastWeight > ex.previousWeight
                                  ? `Weight increased by ${Number((ex.lastWeight - ex.previousWeight).toFixed(1))} kilograms`
                                  : `Weight decreased by ${Number((ex.previousWeight - ex.lastWeight).toFixed(1))} kilograms`}
                                title={ex.lastWeight > ex.previousWeight
                                  ? `Up ${Number((ex.lastWeight - ex.previousWeight).toFixed(1))} kg since previous session`
                                  : `Down ${Number((ex.previousWeight - ex.lastWeight).toFixed(1))} kg since previous session`}
                              >
                                {ex.lastWeight > ex.previousWeight ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                          <div className="exercise-card-meta">
                            {ex.lastSets} sets <span className="dot">·</span> {ex.lastReps} reps
                          </div>
                        </>
                      )}
                      <div className="exercise-card-variation">
                        {dateStr && <span>{dateStr}</span>}
                        {dateStr && ex.variation ? ' · ' : ''}
                        {ex.variation && <span>{ex.variation}</span>}
                        {ex.totalSessions > 1 && (
                          <span style={{ color: 'var(--accent)', marginLeft: 6, fontWeight: 600 }}>
                            {ex.totalSessions} sessions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          className="add-exercise-btn"
          onClick={() => setShowAddSheet(true)}
          aria-label={`Add ${decodedGroup} exercise`}
        >
          Add {decodedGroup} Exercise
        </button>
      </div>

      <TabBar />

      {showAddSheet && (
        <AddWorkoutSheet
          initialData={{ muscleGroup: decodedGroup }}
          onClose={() => setShowAddSheet(false)}
          onSaved={() => { setShowAddSheet(false); loadExercises(); }}
        />
      )}
    </div>
  );
}