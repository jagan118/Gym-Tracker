import { GoogleLogin } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function GoogleAuthButton({ onSuccess, onError, disabled }) {
  // Fail loudly in dev if the env var is missing
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('your-google-client-id')) {
    return (
      <div className="alert alert-error" role="status">
        Google sign-in is not configured. Add your Google web client ID to
        client/.env and server/.env, then restart both servers.
      </div>
    );
  }

  return (
    <div className={`google-auth-button ${disabled ? 'google-auth-button--disabled' : ''}`}>
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
        text="continue_with"
        shape="pill"
        theme="filled_black"
        size="large"
        width="320"
        useOneTap={false}
      />
    </div>
  );
}