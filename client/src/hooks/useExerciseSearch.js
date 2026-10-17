import { useEffect, useState } from 'react';
import { Subject, catchError, concat, defer, distinctUntilChanged, filter, finalize, from, map, of, switchMap, debounceTime } from 'rxjs';
import { workoutAPI } from '../services/api';

const EMPTY_STATE = { query: '', results: [], loading: false, error: '' };
const searchCache = new Map();
const CACHE_TTL_MS = 30_000;

export const clearExerciseSearchCache = () => searchCache.clear();

export default function useExerciseSearch(query, { enabled = true, muscleGroup = '' } = {}) {
  const [state, setState] = useState(EMPTY_STATE);
  const [searchSubject] = useState(() => new Subject());

  useEffect(() => {
    const subscription = searchSubject.pipe(
      map(({ value, active, group }) => ({
        query: value.trim().toLowerCase(),
        active,
        group,
      })),
      debounceTime(250),
      distinctUntilChanged((previous, current) =>
        previous.query === current.query &&
        previous.active === current.active &&
        previous.group === current.group
      ),
      switchMap(({ query: normalizedQuery, active, group }) => {
        const stateKey = `${normalizedQuery}|${group}|${active}`;
        if (!active || !normalizedQuery) return of({ ...EMPTY_STATE, query: stateKey });

        const cacheKey = `${normalizedQuery}|${group}`;
        const cached = searchCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          return of({ query: stateKey, results: cached.results, loading: false, error: '' });
        }

        return concat(
          of({ query: stateKey, results: [], loading: true, error: '' }),
          of(normalizedQuery).pipe(
            filter((value) => value.length > 0),
            switchMap((searchTerm) => {
              const controller = new AbortController();
              return defer(() =>
                from(workoutAPI.getExercises(
                  { search: searchTerm },
                  { signal: controller.signal }
                ))
              ).pipe(
                map((response) => {
                  const exercises = response.data.exercises || [];
                  const matching = exercises.filter((exercise) =>
                    exercise.exerciseNameNormalized?.includes(searchTerm) ||
                    exercise.exerciseName?.toLowerCase().includes(searchTerm) ||
                    exercise.variation?.toLowerCase().includes(searchTerm)
                  );
                  const groupMatches = group && group !== 'Other'
                    ? matching.filter((exercise) => exercise.muscleGroup === group || !exercise.muscleGroup)
                    : matching;
                  const results = groupMatches.length ? groupMatches : matching;
                  searchCache.set(cacheKey, { results, timestamp: Date.now() });
                  if (searchCache.size > 100) searchCache.delete(searchCache.keys().next().value);
                  return { query: stateKey, results, loading: false, error: '' };
                }),
                catchError((error) => {
                  if (error.name === 'CanceledError' || error.name === 'AbortError') {
                    return of(EMPTY_STATE);
                  }
                  console.error('Failed to search exercises', error);
                  return of({
                    query: stateKey,
                    results: [],
                    loading: false,
                    error: 'Could not search workouts. Check your connection and try again.',
                  });
                }),
                finalize(() => controller.abort())
              );
            })
          )
        );
      })
    ).subscribe(setState);

    return () => subscription.unsubscribe();
  }, [searchSubject]);

  useEffect(() => {
    searchSubject.next({ value: query, active: enabled, group: muscleGroup });
  }, [searchSubject, query, enabled, muscleGroup]);

  const normalizedQuery = query.trim().toLowerCase();
  if (!enabled || !normalizedQuery) return EMPTY_STATE;
  const currentStateKey = `${normalizedQuery}|${muscleGroup}|true`;
  if (currentStateKey !== state.query) {
    return { query: currentStateKey, results: [], loading: true, error: '' };
  }
  return state;
}
