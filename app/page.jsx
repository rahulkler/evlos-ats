"use client";

import { useMemo, useState } from "react";
import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
}

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
    text += `
${pageText}`;
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

function StatCard({ value, label }) {
  return (
    <div style={statCardStyle}>
      <div style={statValueStyle}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  );
}

export default function HomePage() {
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
      <section style={heroShellStyle}>
        <div style={heroGlowStyle} />
        <div style={heroGridStyle}>
			<div style={brandRowStyle}>
				<img
					src="/evlos-logo.png"
					alt="Evlos"
					style={{ height: 46, width: "auto", objectFit: "contain" }}
					/>
				<div>
					<div style={eyebrowStyle}>EVLOS ATS</div>
					<div style={brandSubtextStyle}>Driven by Vision. Defined by Automation.</div>
				</div>
        	</div>

        </div>
      </section>

      <section style={sectionHeaderStyle}>
        <div>
          <div style={sectionEyebrowStyle}>Assessment Setup</div>
          <h2 style={sectionTitleStyle}>Define role requirements and upload candidate files</h2>
        </div>
      </section>

      <div style={mainGridStyle}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelEyebrowStyle}>Role Configuration</div>
              <h3 style={panelTitleStyle}>Job definition</h3>
            </div>
          </div>

          <label style={fieldWrapStyle}>
            <div style={fieldLabelStyle}>Job title</div>
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={inputStyle} />
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

          <div style={{ marginTop: 28 }}>
            <div style={subsectionTitleStyle}>Scoring weightings</div>
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
                marginTop: 14,
                color: totalWeight === 100 ? "#d6b36a" : "#fca5a5",
                fontWeight: 600
              }}
            >
              Total weighting: {totalWeight}
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelEyebrowStyle}>Candidate Intake</div>
              <h3 style={panelTitleStyle}>Batch CV upload</h3>
            </div>
          </div>

          <div style={uploadCardStyle}>
            <div style={uploadTitleStyle}>Upload CV files</div>
            <div style={uploadSubtextStyle}>Accepted formats: PDF, DOCX, TXT</div>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              style={{ marginTop: 14 }}
            />
          </div>

          <div style={{ marginTop: 22 }}>
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
            {loading ? "Screening candidates..." : "Run ATS screening"}
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

      <section style={{ marginTop: 34 }}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={sectionEyebrowStyle}>Candidate Ranking</div>
            <h2 style={sectionTitleStyle}>Shortlisted results and comparative fit analysis</h2>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {results.map((candidate, index) => (
            <article key={candidate.fileName} style={resultCardStyle}>
              <div style={resultHeaderStyle}>
                <div>
                  <div style={rankTextStyle}>Rank #{index + 1}</div>
                  <h3 style={{ margin: "4px 0 0 0", fontSize: 24 }}>{candidate.candidateName || candidate.fileName}</h3>
                  <div style={{ color: "#9ca3af", marginTop: 6 }}>{candidate.fileName}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#9ca3af", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Overall score
                  </div>
                  <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor(candidate.overallScore) }}>
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
                  <div style={detailTextStyle}>{candidate.matchedSkills.join(", ") || "None"}</div>
                </div>
                <div style={detailBlockStyle}>
                  <div style={detailLabelStyle}>Missing skills</div>
                  <div style={detailTextStyle}>{candidate.missingSkills.join(", ") || "None"}</div>
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
                <p style={{ margin: "10px 0 0 0", color: "#d1d5db", lineHeight: 1.7 }}>{candidate.summary}</p>
              </div>
            </article>
          ))}

          {!results.length ? <div style={emptyStateStyle}>No rankings yet. Upload CVs and run the Evlos ATS screening.</div> : null}
        </div>
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(214,179,106,0.14), transparent 26%), linear-gradient(180deg, #05070b 0%, #0a0f16 42%, #05070b 100%)",
  color: "#f8fafc",
  padding: "28px 24px 60px"
};

const heroShellStyle = {
  position: "relative",
  overflow: "hidden",
  background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  border: "1px solid rgba(214,179,106,0.22)",
  borderRadius: 28,
  padding: "18px 32px",
  boxShadow: "0 24px 80px rgba(0,0,0,0.32)"
};

const heroGlowStyle = {
  position: "absolute",
  inset: "auto -120px -140px auto",
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(214,179,106,0.18), transparent 70%)",
  pointerEvents: "none"
};

const heroGridStyle = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.8fr)",
  gap: 24,
  alignItems: "stretch"
};

const brandRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 28
};

const eyebrowStyle = {
  color: "#d6b36a",
  fontSize: 12,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: 6
};

const brandSubtextStyle = {
  color: "#cbd5e1",
  fontSize: 14
};

const heroTitleStyle = {
  margin: 0,
  maxWidth: 760,
  fontSize: "clamp(2.2rem, 5vw, 4.4rem)",
  lineHeight: 1.02,
  letterSpacing: "-0.04em"
};

const heroTextStyle = {
  marginTop: 18,
  maxWidth: 760,
  color: "#cbd5e1",
  fontSize: 18,
  lineHeight: 1.8
};

const heroBadgeRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 24
};

const heroBadgeStyle = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(214,179,106,0.22)",
  background: "rgba(255,255,255,0.03)",
  color: "#e5e7eb",
  fontSize: 13
};

const heroStatsWrapStyle = {
  display: "grid",
  gap: 14,
  alignSelf: "end"
};

const statCardStyle = {
  borderRadius: 22,
  padding: "20px 22px",
  background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
  border: "1px solid rgba(255,255,255,0.08)"
};

const statValueStyle = {
  fontSize: 34,
  fontWeight: 700,
  color: "#d6b36a"
};

const statLabelStyle = {
  marginTop: 6,
  color: "#cbd5e1"
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 20,
  marginTop: 34,
  marginBottom: 18
};

const sectionEyebrowStyle = {
  color: "#d6b36a",
  fontSize: 12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: 8
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.15
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
  borderRadius: 26,
  padding: 24,
  boxShadow: "0 18px 50px rgba(0,0,0,0.22)"
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  marginBottom: 22
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
  fontSize: 26
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
  fontSize: 18,
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
  borderRadius: 20,
  border: "1px dashed rgba(214,179,106,0.35)",
  background: "rgba(214,179,106,0.05)",
  padding: 20
};

const uploadTitleStyle = {
  fontSize: 20,
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
  marginTop: 24,
  width: "100%",
  border: 0,
  borderRadius: 16,
  padding: "16px 18px",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  background: "linear-gradient(135deg, #d6b36a, #b78a3e)",
  color: "#0b1020"
};

const errorBoxStyle = {
  marginTop: 16,
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.22)",
  color: "#fecaca"
};

const summaryBoxStyle = {
  marginTop: 18,
  borderRadius: 20,
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

const resultCardStyle = {
  background: "linear-gradient(180deg, rgba(11,16,25,0.98), rgba(7,11,18,0.98))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 26,
  padding: 24,
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

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 18
};

const metricCardStyle = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 14
};

const metricLabelStyle = {
  color: "#9ca3af",
  textTransform: "capitalize",
  fontSize: 13,
  marginBottom: 8
};

const metricValueStyle = {
  fontSize: 28,
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
  borderRadius: 18,
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
  borderRadius: 18,
  padding: 18,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)"
};

const insightTitleStyle = {
  fontSize: 18,
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
  borderRadius: 18,
  padding: 18,
  background: "rgba(214,179,106,0.05)",
  border: "1px solid rgba(214,179,106,0.18)"
};

const emptyStateStyle = {
  borderRadius: 24,
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