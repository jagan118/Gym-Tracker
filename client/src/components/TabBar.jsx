import { useNavigate, useLocation } from 'react-router-dom';
import { Dumbbell, UserRound } from "lucide-react";
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
        <span className="tab-icon-wrap" aria-hidden="true">
          <Dumbbell size={21} strokeWidth={isWorkouts ? 2.4 : 1.8} />
        </span>
        Workouts
      </button>
      <button
        className={`tab-item ${isAccount ? 'active' : ''}`}
        onClick={() => navigate('/account')}
        aria-label="Account"
        aria-current={isAccount ? 'page' : undefined}
      >
        <span className="tab-icon-wrap" aria-hidden="true">
          <UserRound size={21} strokeWidth={isAccount ? 2.4 : 1.8} />
        </span>
        Account
      </button>
    </nav>
  );
}