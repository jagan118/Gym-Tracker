import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TabBar from '../components/TabBar';
import ConsistencyGraph from '../components/ConsistencyGraph';
import { authAPI, workoutAPI } from '../services/api';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [hasPassword, setHasPassword] = useState(Boolean(user?.hasPassword));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [consistencyRetry, setConsistencyRetry] = useState(0);
  const [consistency, setConsistency] = useState({ workoutDates: [], today: null, loading: true, error: '' });

  useEffect(() => {
    let active = true;
    workoutAPI.getConsistency()
      .then(response => {
        if (!active) return;
        setConsistency({
          workoutDates: response.data.workoutDates || [],
          today: new Date(),
          loading: false,
          error: '',
        });
      })
      .catch(error => {
        console.error('Failed to load account workout consistency', error);
        if (active) {
          setConsistency(current => ({
            ...current,
            loading: false,
            error: 'Workout consistency could not be loaded.',
          }));
        }
      });
    return () => { active = false; };
  }, [consistencyRetry]);

  // "Avula Jagan" -> "AJ"
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSetPassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (password.length < 8 || password.length > 128) {
      setPasswordError('Password must be between 8 and 128 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await authAPI.setPassword(password);
      setHasPassword(true);
      setPassword('');
      setConfirmPassword('');
      setPasswordMessage(response.data.message);
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Could not save password. Please try again.');
    } finally {
      setSavingPassword(false);
    }
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

          <section className="account-consistency" aria-label="Workout consistency">
            {consistency.today && (
              <ConsistencyGraph workoutDates={consistency.workoutDates} today={consistency.today} />
            )}
            {consistency.loading && <div className="account-consistency-message">Loading workout consistency…</div>}
            {consistency.error && (
              <div className="account-consistency-message" role="status">
                {consistency.error}
                <button
                  type="button"
                  className="account-consistency-retry"
                  onClick={() => setConsistencyRetry(retry => retry + 1)}
                >
                  Try again
                </button>
              </div>
            )}
          </section>

          {(user?.provider === 'google' || user?.provider === 'both') && (
            <section className="account-section account-password" aria-labelledby="account-password-title">
              <h2 id="account-password-title" className="account-password-title">
                {hasPassword ? 'Update password' : 'Set a password'}
              </h2>
              <p className="account-password-help">
                {hasPassword
                  ? 'Choose a new password for email sign-in.'
                  : 'Set a password to sign in with your email next time.'}
              </p>
              {passwordError && <div className="alert alert-error" role="alert">{passwordError}</div>}
              {passwordMessage && <div className="account-password-success" role="status">{passwordMessage}</div>}
              <form className="account-password-form" onSubmit={handleSetPassword}>
                <label className="form-label" htmlFor="account-password">New password</label>
                <input
                  id="account-password"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                />
                <label className="form-label" htmlFor="account-password-confirm">Confirm password</label>
                <input
                  id="account-password-confirm"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  required
                />
                <button className="btn-primary-auth" type="submit" disabled={savingPassword}>
                  {savingPassword ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}
                </button>
              </form>
            </section>
          )}

          <div className="account-section" style={{ marginTop: 16 }}>
            <button className="account-row danger" onClick={handleLogout} style={{ width: '100%', textAlign: 'left' }}>
              <LogOut size={18} aria-hidden="true" />
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