import { format, getDay, getDaysInMonth, startOfMonth } from 'date-fns';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function ConsistencyGraph({ workoutDates, today }) {
  const datesWithWorkouts = new Set(workoutDates);
  const monthStart = startOfMonth(today);
  const daysInMonth = getDaysInMonth(today);
  const elapsedDays = today.getDate();
  const workoutDayCount = Array.from({ length: elapsedDays }, (_, index) => index + 1)
    .filter(day => datesWithWorkouts.has(format(new Date(today.getFullYear(), today.getMonth(), day), 'yyyy-MM-dd')))
    .length;
  const percentage = Math.round((workoutDayCount / elapsedDays) * 100);
  const calendarCells = [
    ...Array.from({ length: getDay(monthStart) }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <section className="consistency-graph-card" aria-label={`${format(today, 'MMMM')} workout consistency: ${percentage}%`}>
      <div className="consistency-graph-heading">
        <h2 className="consistency-graph-title">
          Consistency <span className="consistency-percentage">{percentage}%</span>
        </h2>
        <span className="consistency-month">{format(today, 'MMMM yyyy')}</span>
      </div>
      <div className="consistency-calendar" role="group" aria-label={`${format(today, 'MMMM')} workout calendar`}>
        {DAY_LABELS.map(label => (
          <span className="consistency-weekday" aria-hidden="true" key={label}>{label}</span>
        ))}
        {calendarCells.map((day, index) => {
          if (day === null) return <span className="consistency-calendar-empty" aria-hidden="true" key={`empty-${index}`} />;
          const date = new Date(today.getFullYear(), today.getMonth(), day);
          const dateKey = format(date, 'yyyy-MM-dd');
          const future = day > elapsedDays;
          const complete = !future && datesWithWorkouts.has(dateKey);
          return (
            <time
              className={`consistency-calendar-day ${future ? 'future' : complete ? 'complete' : 'missed'}`}
              dateTime={dateKey}
              aria-label={`${format(date, 'MMMM d')}: ${future ? 'upcoming' : complete ? 'workout logged' : 'no workout'}`}
              title={`${format(date, 'MMM d')}: ${future ? 'upcoming' : complete ? 'workout logged' : 'no workout'}`}
              key={dateKey}
            >
              {day}
            </time>
          );
        })}
      </div>
    </section>
  );
}
