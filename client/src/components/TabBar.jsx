import { useNavigate, useLocation } from 'react-router-dom';

export default function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isWorkouts =
    location.pathname === '/' ||
    location.pathname.startsWith('/group/') ||
    location.pathname.startsWith('/exercise/');
  const isAccount = location.pathname === '/account';

  return (
    <nav className="tab-bar" aria-label="Main navigation">
      <button
        className={`tab-item ${isWorkouts ? 'active' : ''}`}
        onClick={() => navigate('/')}
        aria-label="My Workouts"
        aria-current={isWorkouts ? 'page' : undefined}
      >
        Workouts
      </button>
      <button
        className={`tab-item ${isAccount ? 'active' : ''}`}
        onClick={() => navigate('/account')}
        aria-label="Account"
        aria-current={isAccount ? 'page' : undefined}
      >
        Account
      </button>
    </nav>
  );
}