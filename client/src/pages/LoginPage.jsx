import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import GoogleAuthButton from '../components/GoogleAuthButton';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetNotice, setResetNotice] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
    if (resetNotice) setResetNotice('');
  };

  const handleRequestPasswordReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResetNotice('');
    try {
      const response = await authAPI.requestPasswordReset(form.email);
      setResetNotice(response.data.message);
      setAuthMode('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request a reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResetNotice('');
    try {
      const response = await authAPI.resetPassword({
        email: form.email,
        code: resetCode,
        password: newPassword,
      });
      setAuthMode('login');
      setResetCode('');
      setNewPassword('');
      setForm(current => ({ ...current, password: '' }));
      setResetNotice(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.login({ email: form.email, password: form.password });
      login(res.data.token, res.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    if (!credential) {
      setError('Google did not return a sign-in credential. Please try again.');
      return;
    }
    setGoogleLoading(true);
    setError('');
    try {
      const res = await authAPI.googleAuth(credential);
      login(res.data.token, res.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        (!err.response
          ? 'Could not reach the API. Check the deployed API URL and make sure the backend allows this site in its CORS settings.'
          : 'Google sign-in failed. Please try again.')
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-text">Gym<span>Log</span></div>
          <div className="auth-logo-sub">Track every rep. Crush every PR.</div>
        </div>

        <div className="auth-title">
          {authMode === 'login' ? 'Welcome back' : authMode === 'request' ? 'Forgot password' : 'Reset password'}
        </div>
        <div className="auth-subtitle">
          {authMode === 'login'
            ? 'Sign in to your account'
            : authMode === 'request'
              ? 'We’ll email a one-time reset code if your account exists.'
              : 'Enter the 6-digit code from your email and choose a new password.'}
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {resetNotice && <div className="alert alert-success" role="status">{resetNotice}</div>}

        {authMode === 'login' ? (
          <>
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  className="form-input"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  className="form-input"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button type="submit" className="btn-primary-auth" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Sign In'}
              </button>
            </form>

            <button
              type="button"
              className="auth-text-button"
              onClick={() => { setError(''); setResetNotice(''); setAuthMode('request'); }}
            >
              Forgot password?
            </button>
          </>
        ) : authMode === 'request' ? (
          <form className="auth-form" onSubmit={handleRequestPasswordReset}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>
            <button type="submit" className="btn-primary-auth" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send reset code'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-code">6-digit code</label>
              <input
                id="reset-code"
                className="form-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={resetCode}
                onChange={event => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-new-password">New password</label>
              <input
                id="reset-new-password"
                className="form-input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary-auth" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Reset password'}
            </button>
            <button
              type="button"
              className="auth-text-button"
              onClick={() => { setAuthMode('request'); setError(''); setResetNotice(''); }}
            >
              Request another code
            </button>
          </form>
        )}

        {authMode === 'login' && (
          <>
            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or continue with</span>
              <div className="auth-divider-line" />
            </div>

            <GoogleAuthButton
              disabled={googleLoading}
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in was cancelled or could not start. Please try again.')}
            />
          </>
        )}

        <div className="auth-footer">
          {authMode === 'login' ? (
            <>Don&apos;t have an account? <Link to="/register" className="auth-link">Sign up</Link></>
          ) : (
            <button
              type="button"
              className="auth-text-button"
              onClick={() => { setAuthMode('login'); setError(''); setResetNotice(''); }}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}