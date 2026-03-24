import { useMemo, useState } from "react";
import CandidateDetailModal from "./CandidateDetailModal";
import { filesToCandidatePayload } from "@/lib/cv";
import {
  addScreening,
  buildScreeningRecord,
  deleteJob,
  findJob,
  findScreening,
  getDefaultJob,
  removeScreening,
  upsertJob
} from "@/lib/storage";
import { exportCandidateInterviewPack, exportScreeningCsv, exportScreeningJson } from "@/lib/export";
import { formatDateTime, nowIso, scoreColor, uid } from "@/lib/utils";

function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function CandidateRow({ candidate, index, onOpen }) {
  return (
    <button className="candidate-row" onClick={onOpen} style={{ textAlign: "left", cursor: "pointer" }}>
      <div>
        <div className="rank-label">Rank #{index + 1}</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{candidate.candidateName || candidate.fileName}</div>
        <div className="small-muted" style={{ marginTop: 4 }}>{candidate.fileName}</div>
      </div>
      <div>
        <div className="small-muted">Score</div>
        <div style={{ fontWeight: 700, color: scoreColor(candidate.overallScore) }}>{candidate.overallScore}</div>
      </div>
      <div>
        <div className="small-muted">Recommendation</div>
        <div style={{ fontWeight: 700 }}>{candidate.recommendation}</div>
      </div>
      <div>
        <div className="small-muted">Experience</div>
        <div style={{ fontWeight: 700 }}>{candidate.yearsExperience} yrs</div>
      </div>
    </button>
  );
}

function LiveStatusCard({ liveFiles, liveCandidates, globalStatus, etaSeconds, loading }) {
  if (!loading && !liveFiles.length && !liveCandidates.length) return null;

  return (
    <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
      <div className="summary-card">
        <div className="summary-label">Live screening status</div>
        <div style={{ marginTop: 8, fontWeight: 700, fontSize: 18 }}>{globalStatus || "Preparing..."}</div>
        <div className="subtle-text" style={{ marginTop: 8 }}>
          {etaSeconds != null ? `Estimated time remaining: ~${etaSeconds}s` : "Estimating time remaining..."}
        </div>
      </div>

      <div className="history-grid" style={{ gridTemplateColumns: "1fr", gap: 10 }}>
        {liveFiles.map((item) => (
          <div key={item.fileName} className="history-card">
            <div className="history-card-top">
              <div>
                <div style={{ fontWeight: 700 }}>{item.fileName}</div>
                <div className="small-muted" style={{ marginTop: 6 }}>{item.status}</div>
              </div>
              <div style={{ fontWeight: 700, color: item.done ? "#d6b36a" : "#cbd5e1" }}>
                {item.done ? "Done" : "In progress"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {liveCandidates.length ? (
        <div>
          <div className="table-head">Partial results</div>
          <div className="result-stack">
            {liveCandidates
              .slice()
              .sort((a, b) => b.overallScore - a.overallScore)
              .map((candidate, index) => (
                <CandidateRow
                  key={candidate.id}
                  candidate={candidate}
                  index={index}
                  onOpen={() => {}}
                />
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseSseEvent(rawChunk) {
  const lines = rawChunk.split("\n");
  const dataLine = lines.find((line) => line.startsWith("data: "));
  if (!dataLine) return null;

  try {
    return JSON.parse(dataLine.slice(6));
  } catch {
    return null;
  }
}

export default function DashboardView({ state, setState, onLogout }) {
  const [activeTab, setActiveTab] = useState("screen");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [localError, setLocalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [liveFiles, setLiveFiles] = useState([]);
  const [liveCandidates, setLiveCandidates] = useState([]);
  const [liveStatus, setLiveStatus] = useState("");
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [serverStartedAt, setServerStartedAt] = useState(null);
  const [serverCompletedCount, setServerCompletedCount] = useState(0);

  const selectedJob = useMemo(
    () => findJob(state, state.selectedJobId) || state.jobs[0] || getDefaultJob(),
    [state]
  );

  const selectedScreening = useMemo(
    () => findScreening(state, state.selectedScreeningId) || state.screenings[0] || null,
    [state]
  );

  const selectedCandidate = useMemo(() => {
    if (!selectedScreening || !selectedCandidateId) return null;
    return selectedScreening.rankings.find((item) => item.id === selectedCandidateId) || null;
  }, [selectedCandidateId, selectedScreening]);

  const totalCandidates = state.screenings.reduce((acc, screening) => acc + screening.rankings.length, 0);
  const totalJobs = state.jobs.length;
  const totalScreenings = state.screenings.length;
  const latestScore = selectedScreening?.rankings?.[0]?.overallScore ?? "—";

  const updateSelectedJob = (patch) => {
    const updatedJob = {
      ...selectedJob,
      ...patch,
      updatedAt: nowIso()
    };

    setState((prev) => upsertJob(prev, updatedJob));
  };

  const handleCreateNewJob = () => {
    const newJob = {
      ...getDefaultJob(),
      id: uid("job"),
      name: "New Role"
    };
    setState((prev) => upsertJob(prev, newJob));
    setActiveTab("screen");
  };

  const handleDeleteJob = (jobId) => {
    setState((prev) => deleteJob(prev, jobId));
  };

  const updateLiveFile = (fileName, patch) => {
    setLiveFiles((prev) =>
      prev.map((item) => (item.fileName === fileName ? { ...item, ...patch } : item))
    );
  };

  const handleRunScreening = async () => {
    try {
      setLoading(true);
      setLocalError("");
      setSuccessMessage("");
      setLiveCandidates([]);
      setEtaSeconds(null);
      setServerStartedAt(null);
      setServerCompletedCount(0);

      if (!selectedFiles.length) {
        throw new Error("Please upload at least one CV.");
      }

      const totalWeight = Object.values(selectedJob.weightings).reduce((a, b) => a + Number(b || 0), 0);
      if (totalWeight !== 100) {
        throw new Error("Weightings must add up to exactly 100.");
      }

      const fileStatusSeed = selectedFiles.map((file) => ({
        fileName: file.name,
        status: "Queued for reading",
        done: false
      }));
      setLiveFiles(fileStatusSeed);

      const candidates = [];
      for (let i = 0; i < selectedFiles.length; i += 1) {
        const file = selectedFiles[i];
        updateLiveFile(file.name, { status: `Reading CV ${i + 1} of ${selectedFiles.length}` });
        setLiveStatus(`Reading ${file.name}`);

        const payload = await filesToCandidatePayload([file]);
        candidates.push(payload[0]);

        updateLiveFile(file.name, { status: "Ready for screening" });
      }

      setLiveStatus("Sending candidates for analysis...");

      const response = await fetch("/api/screen-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          job: {
            title: selectedJob.name,
            description: selectedJob.description,
            mustHaveSkills: selectedJob.mustHaveSkills,
            niceToHaveSkills: selectedJob.niceToHaveSkills,
            weightings: selectedJob.weightings
          },
          candidates
        })
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start streaming analysis.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalPayload = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const event = parseSseEvent(chunk);
          if (!event) continue;

          if (event.type === "error") {
            throw new Error(event.message || "Streaming analysis failed.");
          }

          if (event.type === "stage" && event.stage === "server_started") {
            setServerStartedAt(Date.now());
            setLiveStatus("Server analysis started...");
          }

          if (event.type === "candidate_started") {
            setLiveStatus(`Screening ${event.fileName} (${event.current}/${event.total})`);
            updateLiveFile(event.fileName, { status: "Screening in progress..." });
          }

          if (event.type === "candidate_done") {
            updateLiveFile(event.candidate.fileName, {
              status: "Screening completed",
              done: true
            });

            setLiveCandidates((prev) => {
              const filtered = prev.filter((item) => item.id !== event.candidate.id);
              return [...filtered, event.candidate];
            });

            setServerCompletedCount(event.current);

            if (serverStartedAt || event.current > 0) {
              const elapsed = (Date.now() - (serverStartedAt || Date.now())) / 1000;
              const avg = elapsed / event.current;
              const remaining = Math.max(event.total - event.current, 0);
              setEtaSeconds(Math.max(1, Math.round(avg * remaining)));
            }
          }

          if (event.type === "stage" && event.stage === "finalizing") {
            setLiveStatus("Finalizing rankings...");
            setEtaSeconds(1);
          }

          if (event.type === "complete") {
            finalPayload = {
              summary: event.summary,
              rankings: event.rankings
            };
            setLiveStatus("Completed");
            setEtaSeconds(0);
          }
        }
      }

      if (!finalPayload) {
        throw new Error("No final ranking payload was received.");
      }

      const record = buildScreeningRecord({
        job: selectedJob,
        files: candidates,
        apiResult: finalPayload
      });

      setState((prev) => addScreening(prev, record));
      setSelectedCandidateId(record.rankings[0]?.id || null);
      setSuccessMessage("Screening completed and saved to candidate history.");
      setActiveTab("history");
      setSelectedFiles([]);
    } catch (error) {
      setLocalError(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportTopCandidate = () => {
    if (!selectedScreening?.rankings?.length) return;
    exportCandidateInterviewPack(selectedScreening, selectedScreening.rankings[0]);
  };

  return (
    <main className="page-shell">
      <div className="center-wrap">
        <div className="minimal-header">
          <div className="minimal-header-left">
            <img src="/evlos-logo.png" alt="Evlos" style={{ height: 36, width: "auto" }} />
            <div>
              <div className="panel-overline">EVLOS ATS</div>
              <div style={{ fontWeight: 700 }}>Internal Applicant Tracking Workspace</div>
            </div>
          </div>
          <button className="button-secondary" onClick={onLogout}>Log out</button>
        </div>

        <div className="section-header">
          <div>
            <div className="section-overline">Workspace</div>
            <h2 className="section-title">Manage role definitions, screening, history, and exports</h2>
          </div>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 18 }}>
          <StatCard value={totalJobs} label="Saved jobs" />
          <StatCard value={totalScreenings} label="Saved screenings" />
          <StatCard value={totalCandidates} label="Candidates reviewed" />
          <StatCard value={latestScore} label="Top current score" />
        </div>

        <div className="tab-row" style={{ marginBottom: 18 }}>
          {[
            ["screen", "Screen Candidates"],
            ["history", "Candidate History"],
            ["jobs", "Saved Jobs"],
            ["exports", "Exports"]
          ].map(([key, label]) => (
            <button
              key={key}
              className={`tab-chip ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {localError ? <div className="error-box">{localError}</div> : null}
        {successMessage ? <div className="success-box">{successMessage}</div> : null}

        {activeTab === "screen" ? (
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-overline">Role Configuration</div>
                  <h3 className="panel-title">Job definition</h3>
                </div>
                <select
                  className="select"
                  style={{ maxWidth: 320 }}
                  value={selectedJob.id}
                  onChange={(e) => setState((prev) => ({ ...prev, selectedJobId: e.target.value }))}
                >
                  {state.jobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.name}</option>
                  ))}
                </select>
              </div>

              <label className="field-wrap">
                <span className="field-label">Job title</span>
                <input
                  className="input"
                  value={selectedJob.name}
                  onChange={(e) => updateSelectedJob({ name: e.target.value })}
                />
              </label>

              <label className="field-wrap">
                <span className="field-label">Job description</span>
                <textarea
                  className="textarea"
                  value={selectedJob.description}
                  onChange={(e) => updateSelectedJob({ description: e.target.value })}
                />
              </label>

              <label className="field-wrap">
                <span className="field-label">Must-have skills (comma separated)</span>
                <input
                  className="input"
                  value={selectedJob.mustHaveSkills.join(", ")}
                  onChange={(e) =>
                    updateSelectedJob({
                      mustHaveSkills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    })
                  }
                />
              </label>

              <label className="field-wrap">
                <span className="field-label">Nice-to-have skills (comma separated)</span>
                <input
                  className="input"
                  value={selectedJob.niceToHaveSkills.join(", ")}
                  onChange={(e) =>
                    updateSelectedJob({
                      niceToHaveSkills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    })
                  }
                />
              </label>

              <div style={{ marginTop: 24 }}>
                <div className="card-title">Scoring weightings</div>
                <div className="summary-grid" style={{ marginTop: 14 }}>
                  {Object.entries(selectedJob.weightings).map(([key, value]) => (
                    <label className="field-wrap" key={key}>
                      <span className="field-label" style={{ textTransform: "capitalize" }}>{key}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="input"
                        value={value}
                        onChange={(e) =>
                          updateSelectedJob({
                            weightings: {
                              ...selectedJob.weightings,
                              [key]: Number(e.target.value)
                            }
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-overline">Candidate Intake</div>
                  <h3 className="panel-title">Batch CV upload</h3>
                </div>
              </div>

              <div className="upload-box">
                <div className="card-title">Upload CV files</div>
                <div className="subtle-text" style={{ marginTop: 6 }}>Accepted formats: PDF, DOCX, TXT</div>
                <input
                  style={{ marginTop: 14 }}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="card-title">Selected files</div>
                <div className="file-pill-wrap" style={{ marginTop: 12 }}>
                  {selectedFiles.length ? (
                    selectedFiles.map((file) => <span className="file-pill" key={file.name}>{file.name}</span>)
                  ) : (
                    <div className="small-muted">No CVs selected yet.</div>
                  )}
                </div>
              </div>

              <div className="action-row" style={{ marginTop: 24 }}>
                <button className="button" onClick={handleRunScreening} disabled={loading}>
                  {loading ? "ATS screening in progress..." : "Run ATS screening"}
                </button>
                <button
                  className="button-secondary"
                  onClick={() => {
                    setSelectedFiles([]);
                    setLocalError("");
                    setSuccessMessage("");
                    setLiveFiles([]);
                    setLiveCandidates([]);
                    setLiveStatus("");
                    setEtaSeconds(null);
                  }}
                >
                  Clear upload
                </button>
              </div>

              <LiveStatusCard
                liveFiles={liveFiles}
                liveCandidates={liveCandidates}
                globalStatus={liveStatus}
                etaSeconds={etaSeconds}
                loading={loading}
              />
            </section>
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="two-col-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-overline">Saved Screening Runs</div>
                  <h3 className="panel-title">Candidate history</h3>
                </div>
              </div>

              {state.screenings.length ? (
                <div className="history-grid" style={{ gridTemplateColumns: "1fr", gap: 12 }}>
                  {state.screenings.map((screening) => (
                    <div className="history-card" key={screening.id}>
                      <div className="history-card-top">
                        <div>
                          <div className="summary-label">{screening.jobSnapshot.name}</div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>
                            {screening.summary.recommendedCandidate}
                          </div>
                          <div className="small-muted" style={{ marginTop: 6 }}>
                            {formatDateTime(screening.createdAt)} · {screening.candidateCount} candidates
                          </div>
                        </div>
                        <div className="history-card-actions">
                          <button
                            className="button-secondary"
                            onClick={() => {
                              setState((prev) => ({ ...prev, selectedScreeningId: screening.id }));
                              setSelectedCandidateId(screening.rankings[0]?.id || null);
                            }}
                          >
                            Open
                          </button>
                          <button className="button-danger" onClick={() => setState((prev) => removeScreening(prev, screening.id))}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No saved screening history yet.</div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-overline">Selected Screening</div>
                  <h3 className="panel-title">Candidate ranking</h3>
                </div>
              </div>

              {selectedScreening ? (
                <div>
                  <div className="summary-card">
                    <div className="summary-label">Batch summary</div>
                    <div style={{ marginTop: 8, fontWeight: 700, fontSize: 18 }}>
                      {selectedScreening.summary.recommendedCandidate}
                    </div>
                    <p className="subtle-text" style={{ marginTop: 10 }}>{selectedScreening.summary.overallObservation}</p>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div className="table-head">Candidates</div>
                    <div className="result-stack">
                      {selectedScreening.rankings.map((candidate, index) => (
                        <CandidateRow
                          key={candidate.id}
                          candidate={candidate}
                          index={index}
                          onOpen={() => setSelectedCandidateId(candidate.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">Select a saved screening to review candidates.</div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "jobs" ? (
          <div className="two-col-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-overline">Job Library</div>
                  <h3 className="panel-title">Saved roles</h3>
                </div>
                <button className="button" onClick={handleCreateNewJob}>New job</button>
              </div>

              {state.jobs.length ? (
                <div className="history-grid" style={{ gridTemplateColumns: "1fr", gap: 12 }}>
                  {state.jobs.map((job) => (
                    <div className="job-card" key={job.id}>
                      <div className="job-card-top">
                        <div>
                          <div style={{ fontWeight: 700 }}>{job.name}</div>
                          <div className="small-muted" style={{ marginTop: 6 }}>
                            Updated {formatDateTime(job.updatedAt || job.createdAt)}
                          </div>
                        </div>
                        <div className="job-card-actions">
                          <button
                            className="button-secondary"
                            onClick={() => {
                              setState((prev) => ({ ...prev, selectedJobId: job.id }));
                              setActiveTab("screen");
                            }}
                          >
                            Use
                          </button>
                          {state.jobs.length > 1 ? (
                            <button className="button-danger" onClick={() => handleDeleteJob(job.id)}>
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="subtle-text">{job.description.slice(0, 180)}...</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No saved roles yet.</div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-overline">Current Template</div>
                  <h3 className="panel-title">Selected role details</h3>
                </div>
              </div>

              {selectedJob ? (
                <div className="side-stack">
                  <div className="side-card">
                    <div className="detail-label">Role name</div>
                    <div className="detail-value">{selectedJob.name}</div>
                  </div>
                  <div className="side-card">
                    <div className="detail-label">Must-have skills</div>
                    <div className="skill-pill-wrap" style={{ marginTop: 10 }}>
                      {selectedJob.mustHaveSkills.map((item) => <span className="skill-pill matched" key={item}>{item}</span>)}
                    </div>
                  </div>
                  <div className="side-card">
                    <div className="detail-label">Nice-to-have skills</div>
                    <div className="skill-pill-wrap" style={{ marginTop: 10 }}>
                      {selectedJob.niceToHaveSkills.map((item) => <span className="skill-pill" key={item}>{item}</span>)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">No selected job.</div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "exports" ? (
          <div className="two-col-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-overline">Screening Exports</div>
                  <h3 className="panel-title">Download reports</h3>
                </div>
              </div>

              {selectedScreening ? (
                <div className="export-grid">
                  <div className="export-card">
                    <div className="card-title">Rankings CSV</div>
                    <p className="subtle-text" style={{ marginTop: 8 }}>
                      Export the candidate rankings, recommendations, summaries, and skills into a spreadsheet-friendly file.
                    </p>
                    <button className="button" style={{ marginTop: 12 }} onClick={() => exportScreeningCsv(selectedScreening)}>
                      Export CSV
                    </button>
                  </div>

                  <div className="export-card">
                    <div className="card-title">Screening JSON</div>
                    <p className="subtle-text" style={{ marginTop: 8 }}>
                      Export the full saved screening record including summaries, metrics, and generated interview data.
                    </p>
                    <button className="button-secondary" style={{ marginTop: 12 }} onClick={() => exportScreeningJson(selectedScreening)}>
                      Export JSON
                    </button>
                  </div>

                  <div className="export-card">
                    <div className="card-title">Top candidate interview pack</div>
                    <p className="subtle-text" style={{ marginTop: 8 }}>
                      Download an interview-ready HTML pack for the currently recommended candidate.
                    </p>
                    <button className="button" style={{ marginTop: 12 }} onClick={handleExportTopCandidate}>
                      Export interview pack
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">Run or open a saved screening to enable exports.</div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-overline">Selected Screening Context</div>
                  <h3 className="panel-title">Export preview</h3>
                </div>
              </div>

              {selectedScreening ? (
                <div className="side-stack">
                  <div className="side-card">
                    <div className="detail-label">Role</div>
                    <div className="detail-value">{selectedScreening.jobSnapshot.name}</div>
                  </div>
                  <div className="side-card">
                    <div className="detail-label">Created</div>
                    <div className="detail-value">{formatDateTime(selectedScreening.createdAt)}</div>
                  </div>
                  <div className="side-card">
                    <div className="detail-label">Recommended candidate</div>
                    <div className="detail-value">{selectedScreening.summary.recommendedCandidate}</div>
                  </div>
                  <div className="side-card">
                    <div className="detail-label">Candidate count</div>
                    <div className="detail-value">{selectedScreening.candidateCount}</div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">No screening selected.</div>
              )}
            </section>
          </div>
        ) : null}
      </div>

      {selectedScreening && selectedCandidate ? (
        <CandidateDetailModal
          screening={selectedScreening}
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidateId(null)}
        />
      ) : null}
    </main>
  );
}