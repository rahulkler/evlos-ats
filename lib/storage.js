import { nowIso, safeJsonParse, uid } from "./utils";

export const SESSION_KEY = "evlos_ats_logged_in";
const STORAGE_KEY = "evlos_ats_app_state_v1";

export function getDefaultJob() {
  return {
    id: uid("job"),
    name: "Senior Backend Engineer",
    description:
      "We are hiring a senior backend engineer with strong experience in distributed systems, PostgreSQL, API design, security, and Python. Experience with audit logging, IAM, cloud deployment, and AI product integration is preferred.",
    mustHaveSkills: ["PostgreSQL", "API Design", "Python", "Security", "System Design"],
    niceToHaveSkills: ["LLM Integration", "React", "Docker", "AWS", "Audit Logging"],
    weightings: {
      skills: 30,
      experience: 30,
      education: 10,
      domain: 15,
      communication: 5,
      stability: 10
    },
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function getDefaultState() {
  const defaultJob = getDefaultJob();
  return {
    jobs: [defaultJob],
    screenings: [],
    selectedJobId: defaultJob.id,
    selectedScreeningId: null
  };
}

export function loadAppState() {
  if (typeof window === "undefined") return getDefaultState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeJsonParse(raw, null);
  if (!parsed) return getDefaultState();
  return {
    ...getDefaultState(),
    ...parsed,
    jobs: Array.isArray(parsed.jobs) && parsed.jobs.length ? parsed.jobs : getDefaultState().jobs,
    screenings: Array.isArray(parsed.screenings) ? parsed.screenings : []
  };
}

export function saveAppState(state) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function upsertJob(state, job) {
  const exists = state.jobs.some((item) => item.id === job.id);
  const jobs = exists
    ? state.jobs.map((item) => (item.id === job.id ? job : item))
    : [job, ...state.jobs];
  return {
    ...state,
    jobs,
    selectedJobId: job.id
  };
}

export function deleteJob(state, jobId) {
  const jobs = state.jobs.filter((job) => job.id !== jobId);
  const selectedJobId = state.selectedJobId === jobId ? jobs[0]?.id || null : state.selectedJobId;
  return {
    ...state,
    jobs,
    selectedJobId
  };
}

export function addScreening(state, screening) {
  return {
    ...state,
    screenings: [screening, ...state.screenings],
    selectedScreeningId: screening.id
  };
}

export function removeScreening(state, screeningId) {
  return {
    ...state,
    screenings: state.screenings.filter((item) => item.id !== screeningId),
    selectedScreeningId:
      state.selectedScreeningId === screeningId ? state.screenings[1]?.id || null : state.selectedScreeningId
  };
}

export function findJob(state, jobId) {
  return state.jobs.find((job) => job.id === jobId) || null;
}

export function findScreening(state, screeningId) {
  return state.screenings.find((screening) => screening.id === screeningId) || null;
}

export function buildScreeningRecord({ job, files, apiResult }) {
  return {
    id: uid("screening"),
    jobId: job.id,
    jobSnapshot: job,
    createdAt: nowIso(),
    candidateCount: apiResult.rankings.length,
    sourceFiles: files.map((file) => file.fileName),
    summary: apiResult.summary,
    rankings: apiResult.rankings
  };
}