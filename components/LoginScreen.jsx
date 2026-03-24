import { useState } from "react";

const STATIC_USERNAME = "evlos";
const STATIC_PASSWORD = "evlos123";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (username === STATIC_USERNAME && password === STATIC_PASSWORD) {
      setError("");
      onLogin();
      return;
    }

    setError("Invalid username or password.");
  };

  return (
    <main className="login-page">
      <div className="login-glow" />
      <div className="login-glow-2" />

      <section className="login-shell">
        <div className="login-brand-panel">
          <img src="/evlos-logo.png" alt="Evlos" style={{ height: 54, width: "auto" }} />
          <div className="eyebrow">EVLOS ATS</div>
          <h1 className="login-title">Secure access for Evlos hiring operations</h1>
          <p className="login-text">
            Access the internal applicant screening workspace, review candidate fit,
            manage hiring history, and export interview-ready candidate packs.
          </p>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-title">Saved job definitions</div>
              <div className="subtle-text">Maintain repeatable hiring templates for recurring roles.</div>
            </div>
            <div className="feature-card">
              <div className="feature-title">Candidate history</div>
              <div className="subtle-text">Review past screening batches without rerunning everything.</div>
            </div>
            <div className="feature-card">
              <div className="feature-title">Interview exports</div>
              <div className="subtle-text">Download shortlists and candidate interview packs directly.</div>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="panel-overline">Protected Workspace</div>
          <h2 className="login-form-title">Sign in to continue</h2>
          <p className="subtle-text">Use your internal access credentials to enter the Evlos ATS.</p>

          <form onSubmit={handleSubmit} style={{ marginTop: 26 }}>
            <label className="field-wrap">
              <span className="field-label">Username</span>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Enter username"
              />
            </label>

            <label className="field-wrap">
              <span className="field-label">Password</span>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
              />
            </label>

            {error ? <div className="error-box">{error}</div> : null}

            <button type="submit" className="button" style={{ width: "100%", marginTop: 14 }}>
              Enter Evlos ATS
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}