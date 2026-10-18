import { useState, FormEvent } from "react";
import { Gift, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../context/authContext";

export function AuthScreen() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error("Please enter your name.");
        }
        await signUpWithEmail(email, password, displayName.trim());
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Map common Firebase auth error codes
        if (err.message.includes("auth/invalid-credential")) {
          setError("Invalid email or password.");
        } else if (err.message.includes("auth/email-already-in-use")) {
          setError("This email is already registered. Please sign in instead.");
        } else if (err.message.includes("auth/weak-password")) {
          setError("Password should be at least 6 characters.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An error occurred during authentication.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Gift aria-hidden="true" />
          </div>
          <h1>{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-subtitle">
            {isSignUp
              ? "Join your family to share Christmas wishes with surprise privacy"
              : "Sign in to coordinate gift planning and share wishes"}
          </p>
        </div>

        {error && (
          <div className="auth-alert error" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg
            className="google-icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                type="text"
                required
                placeholder="e.g. Sarah Connor"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {isSignUp ? (
              <>
                <UserPlus aria-hidden="true" /> Create Account
              </>
            ) : (
              <>
                <LogIn aria-hidden="true" /> Sign In
              </>
            )}
          </button>
        </form>

        <div className="auth-toggle">
          {isSignUp ? (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                }}
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                }}
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
