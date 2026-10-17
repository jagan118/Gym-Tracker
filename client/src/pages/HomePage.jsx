import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, parseISO, startOfWeek, subDays } from 'date-fns';
import { workoutAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TabBar from '../components/TabBar';
import AddWorkoutSheet from '../components/AddWorkoutSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import WorkoutReminderSettings from '../components/WorkoutReminderSettings';
import useExerciseSearch from '../hooks/useExerciseSearch';
import { GROUP_COLORS } from '../constants/Musclegroups';
import {
  notifyReminderSettingsChanged,
  notifyWorkoutDataChanged,
  readWorkoutReminderSettings,
} from '../utils/workoutReminders';

function readHiddenGroups(storageKey) {
  try {
    const savedGroups = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(savedGroups) ? savedGroups.filter(group => typeof group === 'string') : [];
  } catch (error) {
    console.warn('Could not read hidden muscle groups', error);
    return [];
  }
}

function readWeeklyGoal(storageKey) {
  try {
    const value = Number(localStorage.getItem(storageKey));
    return Number.isInteger(value) && value >= 1 && value <= 7 ? value : 3;
  } catch (error) {
    console.warn('Could not read weekly workout goal', error);
    return 3;
  }
}

function GroupCard({ group, onOpen, onHide }) {
  const color = GROUP_COLORS[group.muscleGroup] || GROUP_COLORS.Other;
  const dateStr = (() => {
    try { return format(new Date(group.lastDate), 'MMM d'); } catch { return ''; }
  })();

  return (
    <div className="group-card" style={{ '--c': color }}>
      <button type="button" className="group-card-main" onClick={onOpen}>
        <div className="group-card-body">
          <div className="group-card-name">{group.muscleGroup}</div>
          <div className="group-card-meta">
            {group.exerciseCount} exercise{group.exerciseCount !== 1 ? 's' : ''}
            <span className="dot"> · </span>
            {group.totalSessions} session{group.totalSessions !== 1 ? 's' : ''}
          </div>
          {dateStr && <div className="group-card-date">Last: {dateStr}</div>}
        </div>
      </button>
      <button
        type="button"
        className="group-hide-btn"
        onClick={onHide}
        aria-label={`Hide ${group.muscleGroup} from home`}
      >
        Hide
      </button>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || user?._id || 'unknown';
  const hiddenGroupsKey = `gymlog_hidden_groups_${userId}`;
  const weeklyGoalKey = `gymlog_weekly_goal_${userId}`;
  const reminderSettingsKey = `gymlog_workout_reminders_${userId}`;
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [hiddenGroups, setHiddenGroups] = useState(() => readHiddenGroups(hiddenGroupsKey));
  const [weeklyGoal, setWeeklyGoal] = useState(() => readWeeklyGoal(weeklyGoalKey));
  const [reminderSettings, setReminderSettings] = useState(() =>
    readWorkoutReminderSettings(reminderSettingsKey)
  );
  const [consistency, setConsistency] = useState({ workoutDates: [], invalidGroupCount: 0 });
  const [consistencyError, setConsistencyError] = useState('');
  const [cleanupError, setCleanupError] = useState('');
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const {
    results: searchResults,
    loading: searchLoading,
    error: searchError,
  } = useExerciseSearch(search);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await workoutAPI.getGroups();
      setGroups(res.data.groups || []);
    } catch (err) {
      console.error('Failed to load groups', err);
      setLoadError('Could not load your workouts. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const loadConsistency = useCallback(async () => {
    setConsistencyError('');
    try {
      const response = await workoutAPI.getConsistency();
      setConsistency({
        workoutDates: response.data.workoutDates || [],
        invalidGroupCount: response.data.invalidGroupCount || 0,
      });
    } catch (error) {
      console.error('Failed to load workout consistency', error);
      setConsistencyError('Weekly goal and streak data could not be loaded.');
    }
  }, []);

  useEffect(() => { loadConsistency(); }, [loadConsistency]);

  useEffect(() => {
    try {
      localStorage.setItem(hiddenGroupsKey, JSON.stringify(hiddenGroups));
    } catch (error) {
      console.error('Could not save hidden muscle groups', error);
    }
  }, [hiddenGroups, hiddenGroupsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(weeklyGoalKey, String(weeklyGoal));
    } catch (error) {
      console.error('Could not save weekly workout goal', error);
    }
  }, [weeklyGoal, weeklyGoalKey]);

  useEffect(() => {
    try {
      localStorage.setItem(reminderSettingsKey, JSON.stringify(reminderSettings));
    } catch (error) {
      console.error('Could not save workout reminder settings', error);
    }
    notifyReminderSettingsChanged(userId, reminderSettings);
  }, [reminderSettings, reminderSettingsKey, userId]);

  const visibleGroups = useMemo(
    () => groups.filter(group => !hiddenGroups.includes(group.muscleGroup)),
    [groups, hiddenGroups]
  );
  const hiddenExistingGroups = useMemo(
    () => groups.filter(group => hiddenGroups.includes(group.muscleGroup)),
    [groups, hiddenGroups]
  );

  const hideGroup = (muscleGroup) => {
    setHiddenGroups(current => current.includes(muscleGroup) ? current : [...current, muscleGroup]);
  };

  const showGroup = (muscleGroup) => {
    setHiddenGroups(current => current.filter(group => group !== muscleGroup));
  };

  const goToHistory = (w) => {
    navigate(`/exercise/${encodeURIComponent(w.exerciseName)}`, {
      state: { variation: w.variation || '', muscleGroup: w.muscleGroup },
    });
  };

  // Totals for the stats strip, derived from data we already have
  const totals = useMemo(() => ({
    sessions: groups.reduce((n, g) => n + (g.totalSessions || 0), 0),
    exercises: groups.reduce((n, g) => n + (g.exerciseCount || 0), 0),
    groups: groups.length,
  }), [groups]);

  const weeklyStats = useMemo(() => {
    const workoutDays = new Set(consistency.workoutDates);
    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const thisWeekCount = new Set(consistency.workoutDates.filter(date => {
      const workoutDay = parseISO(date);
      return workoutDay >= weekStart && workoutDay <= today;
    })).size;
    let streak = 0;
    let streakDay = workoutDays.has(todayKey) ? today : subDays(today, 1);
    while (workoutDays.has(format(streakDay, 'yyyy-MM-dd'))) {
      streak += 1;
      streakDay = subDays(streakDay, 1);
    }
    return {
      thisWeekCount,
      streak,
      weekStartLabel: format(weekStart, 'MMM d'),
      weekEndLabel: format(weekEnd, 'MMM d'),
    };
  }, [consistency.workoutDates]);

  const handleCleanupInvalidGroups = async () => {
    setCleanupLoading(true);
    setCleanupError('');
    try {
      const response = await workoutAPI.deleteLegacyGroupWorkouts();
      if (response.data.deletedCount > 0) notifyWorkoutDataChanged();
      setShowCleanupConfirm(false);
      await Promise.all([loadGroups(), loadConsistency()]);
      if (response.data.deletedCount === 0) {
        setCleanupError('No ungrouped workout records were found.');
      }
    } catch (error) {
      console.error('Failed to remove ungrouped workouts', error);
      setCleanupError(error.response?.data?.message || 'Could not delete ungrouped records. Please try again.');
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="page">
        <div className="page-inner">
          <div className="home-heading">
            <div>
              <div className="hero-eyebrow">{format(new Date(), 'EEEE, MMM d')}</div>
              <h1 className="page-title">My Workouts</h1>
            </div>
            <div className="welcome-message">
              <span>Welcome</span>
              <strong>{user?.name?.split(/\s+/)[0] || 'back'}</strong>
            </div>
          </div>

          {!search.trim() && (
            <section className="consistency-card" aria-label="Weekly workout goal and streak">
              <div className="consistency-main">
                <div className="consistency-heading">
                  <div>
                    <div className="consistency-title">Weekly goal</div>
                    <div className="consistency-dates">{weeklyStats.weekStartLabel} – {weeklyStats.weekEndLabel}</div>
                  </div>
                  <label className="weekly-goal-select-label">
                    <span className="sr-only">Workouts per week goal</span>
                    <select
                      className="weekly-goal-select"
                      value={weeklyGoal}
                      onChange={event => setWeeklyGoal(Number(event.target.value))}
                      aria-label="Set weekly workout goal"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(goal => (
                        <option value={goal} key={goal}>{goal} / week</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="goal-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={weeklyGoal} aria-valuenow={Math.min(weeklyStats.thisWeekCount, weeklyGoal)}>
                  <div className="goal-progress-fill" style={{ width: `${Math.min(100, (weeklyStats.thisWeekCount / weeklyGoal) * 100)}%` }} />
                </div>
                <div className="consistency-footer">
                  <span>{weeklyStats.thisWeekCount} of {weeklyGoal} workouts</span>
                  <span>{weeklyStats.thisWeekCount >= weeklyGoal ? 'Goal reached' : `${weeklyGoal - weeklyStats.thisWeekCount} to go`}</span>
                </div>
              </div>
              <div className="streak-stat">
                <strong>{weeklyStats.streak}</strong>
                <span>day streak</span>
              </div>
              {consistencyError && <div className="home-inline-error" role="status">{consistencyError}</div>}
            </section>
          )}

          {!search.trim() && (
            <WorkoutReminderSettings
              settings={reminderSettings}
              onChange={setReminderSettings}
            />
          )}

          {/* Stats strip — only when there's data and no active search */}
          {!loading && !loadError && groups.length > 0 && !search.trim() && (
            <div className="stats-strip">
              <div className="stat-tile">
                <div className="stat-tile-value">{totals.sessions}</div>
                <div className="stat-tile-label">Sessions</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-value">{totals.exercises}</div>
                <div className="stat-tile-label">Exercises</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-value">{totals.groups}</div>
                <div className="stat-tile-label">Muscle Groups</div>
              </div>
            </div>
          )}

          {!search.trim() && consistency.invalidGroupCount > 0 && (
            <section className="legacy-workouts-notice">
              <div>
                <strong>{consistency.invalidGroupCount} ungrouped workout{consistency.invalidGroupCount === 1 ? '' : 's'}</strong>
                <span>These older records have no valid muscle group.</span>
              </div>
              <button type="button" className="legacy-delete-btn" onClick={() => setShowCleanupConfirm(true)}>
                Delete
              </button>
            </section>
          )}
          {cleanupError && <div className="home-inline-error" role="alert">{cleanupError}</div>}

          <div className="search-bar">
            <input
              type="search"
              placeholder="Search any exercise…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search exercises"
            />
          </div>

          {search.trim() ? (
            searchLoading ? (
              <div className="loading-center"><div className="spinner spinner-lg" /></div>
            ) : searchError ? (
              <div className="empty-state" role="alert">
                <div className="empty-state-title">{searchError}</div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No results for "{search}"</div>
              </div>
            ) : (
              <div className="exercise-list">
                {searchResults.map(w => (
                  <div
                    key={`${w.exerciseNameNormalized}|${w.variation || ''}`}
                    className="exercise-card"
                    onClick={() => goToHistory(w)}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && goToHistory(w)}
                  >
                    <div className="exercise-card-left">
                      <div style={{ fontSize: 11, color: GROUP_COLORS[w.muscleGroup] || GROUP_COLORS.Other, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>
                        {w.muscleGroup || 'Other'}
                      </div>
                      <div className="exercise-card-name">{w.exerciseName}</div>
                      <div className="exercise-card-weight">{w.weightKg}<span> kg</span></div>
                      <div className="exercise-card-meta">{w.sets} sets <span className="dot">·</span> {w.repsPerSet} reps</div>
                      {w.variation && <div className="exercise-card-variation">{w.variation}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : loading ? (
            <div className="loading-center">
              <div className="spinner spinner-lg" />
              <p>Loading workouts…</p>
            </div>
          ) : loadError ? (
            <div className="empty-state" role="alert">
              <div className="empty-state-title">{loadError}</div>
              <button className="retry-btn" onClick={loadGroups}>Try again</button>
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{groups.length ? 'All muscle groups are hidden' : 'No workouts yet'}</div>
              <div className="empty-state-text">
                {groups.length
                  ? 'Use the Show button below to add a group back to your home page.'
                  : 'Tap "Add Exercise", pick a muscle group, and log your first session.'}
              </div>
            </div>
          ) : (
            <div className="group-list">
              {visibleGroups.map(g => (
                <GroupCard
                  key={g.muscleGroup}
                  group={g}
                  onOpen={() => navigate(`/group/${encodeURIComponent(g.muscleGroup)}`)}
                  onHide={() => hideGroup(g.muscleGroup)}
                />
              ))}
            </div>
          )}

          {!search.trim() && hiddenExistingGroups.length > 0 && (
            <section className="hidden-groups-section" aria-label="Hidden muscle groups">
              <h2 className="hidden-groups-title">Hidden groups</h2>
              <div className="hidden-groups-list">
                {hiddenExistingGroups.map(group => (
                  <div className="hidden-group-row" key={group.muscleGroup}>
                    <span>{group.muscleGroup}</span>
                    <button type="button" className="group-show-btn" onClick={() => showGroup(group.muscleGroup)}>
                      Show
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <button className="add-exercise-btn" onClick={() => setShowSheet(true)} aria-label="Add exercise">
          Add Exercise
        </button>
      </div>

      <TabBar />

      {showSheet && (
        <AddWorkoutSheet
          onClose={() => setShowSheet(false)}
          onSaved={() => {
            loadGroups();
            loadConsistency();
          }}
        />
      )}
      {showCleanupConfirm && (
        <ConfirmDialog
          title="Delete ungrouped workouts?"
          message={`This permanently deletes ${consistency.invalidGroupCount} workout record${consistency.invalidGroupCount === 1 ? '' : 's'} with a missing or invalid muscle group. Other records are not affected.`}
          onConfirm={handleCleanupInvalidGroups}
          onCancel={() => setShowCleanupConfirm(false)}
          loading={cleanupLoading}
        />
      )}
    </div>
  );
}