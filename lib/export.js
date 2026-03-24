import { downloadBlob, formatDateTime } from "./utils";

function csvEscape(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function exportScreeningCsv(screening) {
  const headers = [
    "Rank",
    "Candidate Name",
    "File Name",
    "Overall Score",
    "Recommendation",
    "Years Experience",
    "Matched Skills",
    "Missing Skills",
    "Summary"
  ];

  const rows = screening.rankings.map((candidate, index) => [
    index + 1,
    candidate.candidateName,
    candidate.fileName,
    candidate.overallScore,
    candidate.recommendation,
    candidate.yearsExperience,
    candidate.matchedSkills.join(" | "),
    candidate.missingSkills.join(" | "),
    candidate.summary
  ]);

  const content = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("");

  downloadBlob(
    `${slugify(screening.jobSnapshot.name)}-${shortDate(screening.createdAt)}.csv`,
    new Blob([content], { type: "text/csv;charset=utf-8" })
  );
}

export function exportScreeningJson(screening) {
  downloadBlob(
    `${slugify(screening.jobSnapshot.name)}-${shortDate(screening.createdAt)}.json`,
    new Blob([JSON.stringify(screening, null, 2)], { type: "application/json" })
  );
}

export function exportCandidateInterviewPack(screening, candidate) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(candidate.candidateName)} Interview Pack</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; padding: 32px; color: #111827; line-height: 1.6; }
    h1, h2, h3 { margin-bottom: 10px; }
    .muted { color: #6b7280; }
    .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; margin: 16px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    ul { margin-top: 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(candidate.candidateName)}</h1>
  <div class="muted">${escapeHtml(screening.jobSnapshot.name)} · ${escapeHtml(formatDateTime(screening.createdAt))}</div>

  <div class="card">
    <h2>Assessment Summary</h2>
    <p><strong>Overall score:</strong> ${candidate.overallScore}</p>
    <p><strong>Recommendation:</strong> ${escapeHtml(candidate.recommendation)}</p>
    <p><strong>Years experience:</strong> ${candidate.yearsExperience}</p>
    <p><strong>CV file:</strong> ${escapeHtml(candidate.fileName)}</p>
    <p>${escapeHtml(candidate.summary)}</p>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Strengths</h3>
      <ul>${candidate.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <h3>Risks</h3>
      <ul>${candidate.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Matched Skills</h3>
      <ul>${candidate.matchedSkills.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <h3>Missing Skills</h3>
      <ul>${candidate.missingSkills.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  </div>

  <div class="card">
    <h2>Technical Concerns</h2>
    <ul>${candidate.technicalConcerns.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </div>

  <div class="card">
    <h2>Clarifications Needed</h2>
    <ul>${candidate.clarificationsNeeded.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </div>

  <div class="card">
    <h2>Interview Questions</h2>
    <ol>${candidate.interviewQuestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
  </div>
</body>
</html>`;

  downloadBlob(
    `${slugify(candidate.candidateName || candidate.fileName)}-interview-pack.html`,
    new Blob([html], { type: "text/html;charset=utf-8" })
  );
}

function slugify(value) {
  return String(value || "file")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function shortDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}