"use client";

import { useEffect, useMemo, useState } from "react";
import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
}

const STATIC_USERNAME = "evlos";
const STATIC_PASSWORD = "evlos123";
const SESSION_KEY = "evlos_ats_logged_in";

function scoreColor(score) {
  if (score >= 80) return "#d6b36a";
  if (score >= 60) return "#cbd5e1";
  return "#94a3b8";
}

async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += `\n${pageText}`;
  }

  return text.trim();
}

async function extractTextFromDocx(file) {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}

async function extractTextFromTxt(file) {
  return (await file.text()).trim();
}

async function extractCvText(file) {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".pdf")) return extractTextFromPdf(file);
  if (lower.endsWith(".docx")) return extractTextFromDocx(file);
  if (lower.endsWith(".txt")) return extractTextFromTxt(file);

  throw new Error(`Unsupported file format for ${file.name}. Use PDF, DOCX, or TXT.`);
}

function MetricCard({ label, value }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
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
    <main style={loginPageStyle}>
      <div style={loginGlowOneStyle} />
      <div style={loginGlowTwoStyle} />

      <section style={loginShellStyle}>
        <div style={loginBrandPanelStyle}>
          <div style={loginBrandInnerStyle}>
            <img
              src="/evlos-logo.png"
              alt="Evlos"
              style={{ height: 52, width: "auto", objectFit: "contain" }}
            />
            <div style={eyebrowStyle}>EVLOS ATS</div>
            <h1 style={loginTitleStyle}>Internal hiring workspace</h1>
            <p style={loginTextStyle}>
              Sign in to access candidate screening, role setup, and structured applicant review.
            </p>
          </div>
        </div>

        <div style={loginFormPanelStyle}>
          <div style={panelEyebrowStyle}>Protected Access</div>
          <h2 style={loginFormTitleStyle}>Sign in</h2>
          <p style={loginFormTextStyle}>Use your internal access credentials.</p>

          <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            <label style={fieldWrapStyle}>
              <div style={fieldLabelStyle}>Username</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={inputStyle}
                autoComplete="username"
                placeholder="Enter username"
              />
            </label>

            <label style={fieldWrapStyle}>
              <div style={fieldLabelStyle}>Password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete="current-password"
                placeholder="Enter password"
              />
            </label>

            {error ? <div style={errorBoxStyle}>{error}</div> : null}

            <button type="submit" style={ctaButtonStyle}>
              Enter Evlos ATS
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function AtsDashboard({ onLogout }) {
  const [jobTitle, setJobTitle] = useState("Senior Backend Engineer");
  const [jobDescription, setJobDescription] = useState(
    "We are hiring a senior backend engineer with strong experience in distributed systems, PostgreSQL, API design, security, and Python. Experience with audit logging, IAM, cloud deployment, and AI product integration is preferred."
  );
  const [mustHaveSkills, setMustHaveSkills] = useState(
    "PostgreSQL, API Design, Python, Security, System Design"
  );
  const [niceToHaveSkills, setNiceToHaveSkills] = useState(
    "LLM Integration, React, Docker, AWS, Audit Logging"
  );
  const [weightings, setWeightings] = useState({
    skills: 30,
    experience: 30,
    education: 10,
    domain: 15,
    communication: 5,
    stability: 10
  });
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalWeight = useMemo(
    () => Object.values(weightings).reduce((a, b) => a + Number(b || 0), 0),
    [weightings]
  );

  const onChangeWeight = (key, value) => {
    setWeightings((prev) => ({
      ...prev,
      [key]: Number(value)
    }));
  };

  async function onAnalyze() {
    try {
      setLoading(true);
      setError("");
      setResults([]);
      setSummary(null);

      if (!files.length) {
        throw new Error("Please upload at least one CV.");
      }

      if (totalWeight !== 100) {
        throw new Error("Weightings must add up to exactly 100.");
      }

      const candidates = [];

      for (const file of files) {
        const text = await extractCvText(file);
        candidates.push({
          fileName: file.name,
          text: text.slice(0, 50000)
        });
      }

      const response = await fetch("/api/screen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          job: {
            title: jobTitle,
            description: jobDescription,
            mustHaveSkills: mustHaveSkills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            niceToHaveSkills: niceToHaveSkills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            weightings
          },
          candidates
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze candidates.");
      }

      setResults(data.rankings || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={minimalHeaderStyle}>
        <div style={headerLeftStyle}>
          <img
            src="/evlos-logo.png"
            alt="Evlos"
            style={{ height: 34, width: "auto", objectFit: "contain" }}
          />
          <div style={headerTitleStyle}>Evlos ATS</div>
        </div>

        <button onClick={onLogout} style={secondaryButtonStyle}>
          Log out
        </button>
      </div>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelEyebrowStyle}>Role</div>
              <h3 style={panelTitleStyle}>Job definition</h3>
            </div>
          </div>

          <label style={fieldWrapStyle}>
            <div style={fieldLabelStyle}>Job title</div>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldWrapStyle}>
            <div style={fieldLabelStyle}>Job description</div>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={8}
              style={textareaStyle}
            />
          </label>

          <label style={fieldWrapStyle}>
            <div style={fieldLabelStyle}>Must-have skills</div>
            <input
              value={mustHaveSkills}
              onChange={(e) => setMustHaveSkills(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldWrapStyle}>
            <div style={fieldLabelStyle}>Nice-to-have skills</div>
            <input
              value={niceToHaveSkills}
              onChange={(e) => setNiceToHaveSkills(e.target.value)}
              style={inputStyle}
            />
          </label>

          <div style={{ marginTop: 24 }}>
            <div style={subsectionTitleStyle}>Weightings</div>
            <div style={weightsGridStyle}>
              {Object.entries(weightings).map(([key, value]) => (
                <label key={key} style={weightInputWrapStyle}>
                  <div style={smallLabelStyle}>{key}</div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => onChangeWeight(key, e.target.value)}
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>

            <div
              style={{
                marginTop: 10,
                color: totalWeight === 100 ? "#d6b36a" : "#fca5a5",
                fontWeight: 600
              }}
            >
              Total: {totalWeight}
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelEyebrowStyle}>Candidates</div>
              <h3 style={panelTitleStyle}>Upload CVs</h3>
            </div>
          </div>

          <div style={uploadCardStyle}>
            <div style={uploadTitleStyle}>Select candidate files</div>
            <div style={uploadSubtextStyle}>Accepted formats: PDF, DOCX, TXT</div>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              style={{ marginTop: 14 }}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={subsectionTitleStyle}>Selected files</div>
            <div style={fileListStyle}>
              {files.length ? (
                files.map((f) => (
                  <div key={f.name} style={filePillStyle}>
                    {f.name}
                  </div>
                ))
              ) : (
                <div style={{ color: "#94a3b8" }}>No CVs selected yet.</div>
              )}
            </div>
          </div>

          <button onClick={onAnalyze} disabled={loading} style={ctaButtonStyle}>
            {loading ? "Processing..." : "Run Screening"}
          </button>

          {error ? <div style={errorBoxStyle}>{error}</div> : null}

          {summary ? (
            <div style={summaryBoxStyle}>
              <div style={subsectionTitleStyle}>Batch summary</div>
              <div style={summaryRowStyle}>
                <span style={summaryLabelStyle}>Recommended candidate</span>
                <span>{summary.recommendedCandidate}</span>
              </div>
              <div style={summaryTextStyle}>{summary.overallObservation}</div>
              <div style={{ ...summaryTextStyle, marginTop: 10, color: "#cbd5e1" }}>
                {summary.riskNote}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section style={{ marginTop: 30 }}>
        <div style={resultsHeaderStyle}>
          <h2 style={{ margin: 0 }}>Results</h2>
          <div style={{ color: "#94a3b8" }}>{results.length} candidate(s)</div>
        </div>

        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {results.map((candidate, index) => (
            <article key={candidate.fileName} style={resultCardStyle}>
              <div style={resultHeaderStyle}>
                <div>
                  <div style={rankTextStyle}>Rank #{index + 1}</div>
                  <h3 style={{ margin: "4px 0 0 0", fontSize: 22 }}>
                    {candidate.candidateName || candidate.fileName}
                  </h3>
                  <div style={{ color: "#9ca3af", marginTop: 6 }}>{candidate.fileName}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={overallScoreLabelStyle}>Overall score</div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 700,
                      color: scoreColor(candidate.overallScore)
                    }}
                  >
                    {candidate.overallScore}
                  </div>
                </div>
              </div>

              <div style={metricsGridStyle}>
                {Object.entries(candidate.metrics).map(([metric, value]) => (
                  <MetricCard key={metric} label={metric} value={value} />
                ))}
              </div>

              <div style={detailsGridStyle}>
                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Recommendation</div>
                  <div style={detailValueStyle}>{candidate.recommendation}</div>
                </div>

                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Experience</div>
                  <div style={detailValueStyle}>{candidate.yearsExperience} years</div>
                </div>

                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Matched skills</div>
                  <div style={detailTextStyle}>
                    {candidate.matchedSkills.join(", ") || "None"}
                  </div>
                </div>

                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Missing skills</div>
                  <div style={detailTextStyle}>
                    {candidate.missingSkills.join(", ") || "None"}
                  </div>
                </div>
              </div>

              <div style={insightGridStyle}>
                <div style={insightBoxStyle}>
                  <div style={insightTitleStyle}>Strengths</div>
                  <ul style={listStyle}>
                    {candidate.strengths.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div style={insightBoxStyle}>
                  <div style={insightTitleStyle}>Risks</div>
                  <ul style={listStyle}>
                    {candidate.risks.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={summaryCandidateStyle}>
                <div style={insightTitleStyle}>Candidate summary</div>
                <p style={{ margin: "10px 0 0 0", color: "#d1d5db", lineHeight: 1.7 }}>
                  {candidate.summary}
                </p>
              </div>
            </article>
          ))}

          {!results.length ? (
            <div style={emptyStateStyle}>
              No results yet. Upload CVs and run the screening.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function HomePage() {
  const [hydrated, setHydrated] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SESSION_KEY);
    setIsLoggedIn(saved === "true");
    setHydrated(true);
  }, []);

  const handleLogin = () => {
    window.localStorage.setItem(SESSION_KEY, "true");
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setIsLoggedIn(false);
  };

  if (!hydrated) {
    return <main style={loginPageStyle} />;
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <AtsDashboard onLogout={handleLogout} />;
}

const pageStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(214,179,106,0.10), transparent 22%), linear-gradient(180deg, #05070b 0%, #0a0f16 42%, #05070b 100%)",
  color: "#f8fafc",
  padding: "24px"
};

const loginPageStyle = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at top left, rgba(214,179,106,0.14), transparent 22%), radial-gradient(circle at bottom right, rgba(214,179,106,0.1), transparent 24%), linear-gradient(180deg, #040608 0%, #0a0f16 100%)",
  color: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24
};

const loginGlowOneStyle = {
  position: "absolute",
  top: -120,
  left: -80,
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(214,179,106,0.18), transparent 70%)"
};

const loginGlowTwoStyle = {
  position: "absolute",
  bottom: -140,
  right: -80,
  width: 380,
  height: 380,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(214,179,106,0.14), transparent 70%)"
};

const loginShellStyle = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: 1100,
  display: "grid",
  gridTemplateColumns: "1fr 0.9fr",
  background: "linear-gradient(180deg, rgba(10,15,22,0.96), rgba(6,9,14,0.98))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 28,
  overflow: "hidden",
  boxShadow: "0 30px 100px rgba(0,0,0,0.45)"
};

const loginBrandPanelStyle = {
  padding: "40px 36px",
  borderRight: "1px solid rgba(255,255,255,0.07)",
  background:
    "linear-gradient(135deg, rgba(214,179,106,0.08), rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.01))"
};

const loginBrandInnerStyle = {
  maxWidth: 520
};

const loginTitleStyle = {
  margin: "16px 0 0 0",
  fontSize: "clamp(2rem, 4vw, 3.4rem)",
  lineHeight: 1.02,
  letterSpacing: "-0.04em"
};

const loginTextStyle = {
  marginTop: 18,
  color: "#cbd5e1",
  fontSize: 17,
  lineHeight: 1.75,
  maxWidth: 480
};

const loginFormPanelStyle = {
  padding: "40px 36px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center"
};

const loginFormTitleStyle = {
  margin: "6px 0 0 0",
  fontSize: 32
};

const loginFormTextStyle = {
  marginTop: 12,
  color: "#cbd5e1",
  lineHeight: 1.7
};

const minimalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 20,
  padding: "14px 18px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)"
};

const headerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: 14
};

const headerTitleStyle = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-0.02em"
};

const eyebrowStyle = {
  color: "#d6b36a",
  fontSize: 12,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  fontWeight: 700,
  marginTop: 14
};

const mainGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.08fr 0.92fr",
  gap: 20,
  alignItems: "start"
};

const panelStyle = {
  background: "linear-gradient(180deg, rgba(13,18,27,0.98), rgba(8,12,19,0.98))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 18px 50px rgba(0,0,0,0.22)"
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  marginBottom: 20
};

const panelEyebrowStyle = {
  color: "#d6b36a",
  fontSize: 12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: 6
};

const panelTitleStyle = {
  margin: 0,
  fontSize: 24
};

const fieldWrapStyle = {
  display: "block",
  marginBottom: 16
};

const fieldLabelStyle = {
  marginBottom: 8,
  color: "#e5e7eb",
  fontWeight: 600
};

const subsectionTitleStyle = {
  fontSize: 17,
  fontWeight: 700,
  marginBottom: 12
};

const weightsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12
};

const weightInputWrapStyle = {
  display: "block"
};

const smallLabelStyle = {
  marginBottom: 8,
  color: "#aeb9c9",
  textTransform: "capitalize"
};

const uploadCardStyle = {
  borderRadius: 18,
  border: "1px dashed rgba(214,179,106,0.35)",
  background: "rgba(214,179,106,0.05)",
  padding: 18
};

const uploadTitleStyle = {
  fontSize: 18,
  fontWeight: 700
};

const uploadSubtextStyle = {
  marginTop: 6,
  color: "#cbd5e1"
};

const fileListStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  minHeight: 40
};

const filePillStyle = {
  padding: "10px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e5e7eb",
  fontSize: 14
};

const ctaButtonStyle = {
  marginTop: 22,
  width: "100%",
  border: 0,
  borderRadius: 14,
  padding: "15px 18px",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  background: "linear-gradient(135deg, #d6b36a, #b78a3e)",
  color: "#0b1020"
};

const secondaryButtonStyle = {
  borderRadius: 14,
  padding: "12px 14px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  background: "rgba(255,255,255,0.04)",
  color: "#f8fafc",
  border: "1px solid rgba(255,255,255,0.08)"
};

const errorBoxStyle = {
  marginTop: 16,
  borderRadius: 14,
  padding: 14,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.22)",
  color: "#fecaca"
};

const summaryBoxStyle = {
  marginTop: 18,
  borderRadius: 18,
  padding: 18,
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)"
};

const summaryRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap"
};

const summaryLabelStyle = {
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontSize: 12
};

const summaryTextStyle = {
  marginTop: 12,
  color: "#e5e7eb",
  lineHeight: 1.7
};

const resultsHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12
};

const resultCardStyle = {
  background: "linear-gradient(180deg, rgba(11,16,25,0.98), rgba(7,11,18,0.98))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 18px 50px rgba(0,0,0,0.2)"
};

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
  alignItems: "end"
};

const rankTextStyle = {
  color: "#d6b36a",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontSize: 12,
  fontWeight: 700
};

const overallScoreLabelStyle = {
  color: "#9ca3af",
  fontSize: 12,
  letterSpacing: "0.12em",
  textTransform: "uppercase"
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 18
};

const metricCardStyle = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 14
};

const metricLabelStyle = {
  color: "#9ca3af",
  textTransform: "capitalize",
  fontSize: 13,
  marginBottom: 8
};

const metricValueStyle = {
  fontSize: 26,
  fontWeight: 700,
  color: "#f8fafc"
};

const detailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 18
};

const detailBlockStyle = {
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)"
};

const detailLabelStyle = {
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontSize: 11,
  marginBottom: 8
};

const detailValueStyle = {
  fontSize: 18,
  fontWeight: 700
};

const detailTextStyle = {
  color: "#d1d5db",
  lineHeight: 1.6
};

const insightGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 18
};

const insightBoxStyle = {
  borderRadius: 16,
  padding: 18,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)"
};

const insightTitleStyle = {
  fontSize: 17,
  fontWeight: 700
};

const listStyle = {
  margin: "12px 0 0 18px",
  padding: 0,
  color: "#d1d5db",
  lineHeight: 1.8
};

const summaryCandidateStyle = {
  marginTop: 18,
  borderRadius: 16,
  padding: 18,
  background: "rgba(214,179,106,0.05)",
  border: "1px solid rgba(214,179,106,0.18)"
};

const emptyStateStyle = {
  borderRadius: 20,
  padding: 24,
  textAlign: "center",
  background: "rgba(255,255,255,0.025)",
  color: "#94a3b8",
  border: "1px solid rgba(255,255,255,0.07)"
};

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.03)",
  color: "#f8fafc",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "12px 14px",
  boxSizing: "border-box",
  outline: "none"
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 160
};