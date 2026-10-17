import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TabBar from '../components/TabBar';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // "Avula Jagan" -> "AJ"
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <div className="page">
        <div className="account-page">
          <h1 className="page-title">Account</h1>

          <div className="account-hero">
            <div className="account-avatar">{initials}</div>
            <div className="account-name">{user?.name || 'User'}</div>
            <div className="account-email">{user?.email || ''}</div>
          </div>

          <div className="account-section" style={{ marginTop: 28 }}>
            <div className="account-row">
              <span className="account-row-label">Name</span>
              <span className="account-row-value">{user?.name}</span>
            </div>
            <div className="account-row">
              <span className="account-row-label">Email</span>
              <span className="account-row-value">{user?.email}</span>
            </div>
          </div>

          <div className="account-section" style={{ marginTop: 16 }}>
            <button className="account-row danger" onClick={handleLogout} style={{ width: '100%', textAlign: 'left' }}>
              <span className="account-row-text">Sign Out</span>
            </button>
          </div>

          <p className="account-footer">GymLog — Personal Workout Tracker</p>
        </div>
      </div>
      <TabBar />
    </div>
  );
}