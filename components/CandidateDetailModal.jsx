import { exportCandidateInterviewPack } from "@/lib/export";
import { formatDateTime, scoreColor } from "@/lib/utils";

function SkillPills({ title, items, variant = "matched" }) {
  return (
    <div className="detail-card">
      <div className="card-title">{title}</div>
      <div className="skill-pill-wrap" style={{ marginTop: 12 }}>
        {items.length ? (
          items.map((item) => (
            <span key={item} className={`skill-pill ${variant}`}>
              {item}
            </span>
          ))
        ) : (
          <span className="small-muted">None</span>
        )}
      </div>
    </div>
  );
}

function ListCard({ title, items }) {
  return (
    <div className="insight-card">
      <div className="card-title">{title}</div>
      {items.length ? (
        <ul className="list">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="small-muted" style={{ marginTop: 10 }}>None</div>
      )}
    </div>
  );
}

export default function CandidateDetailModal({ screening, candidate, onClose }) {
  if (!screening || !candidate) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="panel-overline">Candidate Detail</div>
            <h2 style={{ margin: "6px 0 0 0", fontSize: 30 }}>{candidate.candidateName || candidate.fileName}</h2>
            <div className="subtle-text" style={{ marginTop: 8 }}>
              {screening.jobSnapshot.name} · {formatDateTime(screening.createdAt)}
            </div>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-section">
          <div className="result-card-top">
            <div>
              <div className="rank-label">Overall recommendation</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{candidate.recommendation}</div>
            </div>
            <div className="right-align">
              <div className="small-muted">Overall score</div>
              <div className="score-value" style={{ color: scoreColor(candidate.overallScore) }}>
                {candidate.overallScore}
              </div>
            </div>
          </div>

          <div className="metrics-grid">
            {Object.entries(candidate.metrics).map(([key, value]) => (
              <div className="metric-card" key={key}>
                <div className="metric-label">{key}</div>
                <div className="metric-value">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-section two-col-grid">
          <div className="detail-card">
            <div className="detail-label">Experience</div>
            <div className="detail-value">{candidate.yearsExperience} years</div>
          </div>
          <div className="detail-card">
            <div className="detail-label">CV file</div>
            <div className="detail-value">{candidate.fileName}</div>
          </div>
        </div>

        <div className="modal-section">
          <div className="result-summary">
            <div className="card-title">Assessment Summary</div>
            <p className="subtle-text" style={{ margin: "10px 0 0 0" }}>{candidate.summary}</p>
          </div>
        </div>

        <div className="modal-section two-col-grid">
          <SkillPills title="Matched Skills" items={candidate.matchedSkills} variant="matched" />
          <SkillPills title="Missing Skills" items={candidate.missingSkills} variant="missing" />
        </div>

        <div className="modal-section two-col-grid">
          <ListCard title="Strengths" items={candidate.strengths} />
          <ListCard title="Risks" items={candidate.risks} />
        </div>

        <div className="modal-section two-col-grid">
          <ListCard title="Technical Concerns" items={candidate.technicalConcerns} />
          <ListCard title="Clarifications Needed" items={candidate.clarificationsNeeded} />
        </div>

        <div className="modal-section">
          <div className="insight-card">
            <div className="card-title">Interview Questions</div>
            <ol className="list">
              {candidate.interviewQuestions.map((question, index) => (
                <li key={`q-${index}`}>{question}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="modal-section">
          <div className="action-row">
            <button className="button" onClick={() => exportCandidateInterviewPack(screening, candidate)}>
              Export interview pack
            </button>
            <button className="button-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </aside>
    </div>
  );
}