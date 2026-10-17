import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { workoutAPI } from '../services/api';
import TabBar from '../components/TabBar';
import AddWorkoutSheet from '../components/AddWorkoutSheet';
import { GROUP_COLORS } from '../constants/Musclegroups';

function GroupCard({ group, onClick }) {
  const color = GROUP_COLORS[group.muscleGroup] || GROUP_COLORS.Other;
  const dateStr = (() => {
    try { return format(new Date(group.lastDate), 'MMM d'); } catch { return ''; }
  })();

  return (
    <div
      className="group-card"
      style={{ '--c': color }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
    >
      <div className="group-card-body">
        <div className="group-card-name">{group.muscleGroup}</div>
        <div className="group-card-meta">
          {group.exerciseCount} exercise{group.exerciseCount !== 1 ? 's' : ''}
          <span className="dot"> · </span>
          {group.totalSessions} session{group.totalSessions !== 1 ? 's' : ''}
        </div>
        {dateStr && <div className="group-card-date">Last: {dateStr}</div>}
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSheet, setShowSheet] = useState(false);

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

  // Debounced search across all exercises
  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    let current = true;
    setSearchLoading(true);
    setSearchError('');
    const t = setTimeout(async () => {
      try {
        const res = await workoutAPI.getExercises({ search: query });
        if (current) setSearchResults(res.data.exercises || []);
      } catch (err) {
        console.error('Failed to search exercises', err);
        if (current) {
          setSearchResults([]);
          setSearchError('Could not search workouts. Check your connection and try again.');
        }
      } finally {
        if (current) setSearchLoading(false);
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [search]);

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

  return (
    <div className="app-shell">
      <div className="page">
        <div className="page-inner">
          <div className="hero-eyebrow">{format(new Date(), 'EEEE, MMM d')}</div>
          <h1 className="page-title">My Workouts</h1>

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
          ) : groups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No workouts yet</div>
              <div className="empty-state-text">
                Tap "Add Exercise", pick a muscle group, and log your first session.
              </div>
            </div>
          ) : (
            <div className="group-list">
              {groups.map(g => (
                <GroupCard
                  key={g.muscleGroup}
                  group={g}
                  onClick={() => navigate(`/group/${encodeURIComponent(g.muscleGroup)}`)}
                />
              ))}
            </div>
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
          onSaved={() => loadGroups()}
        />
      )}
    </div>
  );
}