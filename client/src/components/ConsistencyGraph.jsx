import { addDays, format, startOfWeek, subWeeks } from 'date-fns';

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

export default function ConsistencyGraph({ workoutDates, today }) {
  const firstWeek = startOfWeek(subWeeks(today, 11), { weekStartsOn: 1 });
  const datesWithWorkouts = new Set(workoutDates);
  const days = Array.from({ length: 12 * 7 }, (_, index) => addDays(firstWeek, index));
  const activeDays = days.filter(day =>
    day <= today && datesWithWorkouts.has(format(day, 'yyyy-MM-dd'))
  ).length;
  const weeks = Array.from({ length: 12 }, (_, weekIndex) =>
    days.slice(weekIndex * 7, weekIndex * 7 + 7)
  );

  return (
    <section className="consistency-graph-card" aria-label="Workout consistency over the last 12 weeks">
      <div className="consistency-graph-heading">
        <div>
          <h2 className="consistency-graph-title">Consistency</h2>
          <div className="consistency-graph-subtitle">Last 12 weeks · {activeDays} workout days</div>
        </div>
        <div className="consistency-legend"><span /> Workout</div>
      </div>
      <div className="consistency-graph" role="img" aria-label={`${activeDays} workout days in the last 12 weeks`}>
        <div className="consistency-day-labels" aria-hidden="true">
          {DAY_LABELS.map((label, index) => <span key={index}>{label}</span>)}
        </div>
        {weeks.map((week, weekIndex) => (
          <div className="consistency-week" key={weekIndex}>
            {week.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const complete = day <= today && datesWithWorkouts.has(dateKey);
              return (
                <span
                  key={dateKey}
                  className={`consistency-day ${complete ? 'active' : ''} ${day > today ? 'future' : ''}`}
                  title={`${format(day, 'MMM d, yyyy')}: ${complete ? 'workout logged' : 'no workout'}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      {activeDays === 0 && (
        <div className="consistency-graph-empty">Your workout history will build this graph.</div>
      )}
    </section>
  );
}
