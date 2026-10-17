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

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
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
          ? 'Could not reach the API. Check that the server is running and allows this local origin.'
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

        <div className="auth-title">Welcome back</div>
        <div className="auth-subtitle">Sign in to your account</div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

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

        <div className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="auth-link">Sign up</Link>
        </div>
      </div>
    </div>
  );
}