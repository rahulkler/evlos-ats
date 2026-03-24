import OpenAI from "openai";
import { z } from "zod";
import { uid } from "@/lib/utils";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const RequestSchema = z.object({
  job: z.object({
    title: z.string(),
    description: z.string(),
    mustHaveSkills: z.array(z.string()),
    niceToHaveSkills: z.array(z.string()),
    weightings: z.object({
      skills: z.number(),
      experience: z.number(),
      education: z.number(),
      domain: z.number(),
      communication: z.number(),
      stability: z.number()
    })
  }),
  candidates: z.array(
    z.object({
      fileName: z.string(),
      text: z.string()
    })
  )
});

const CandidateSchema = z.object({
  id: z.string().optional(),
  fileName: z.string(),
  candidateName: z.string(),
  overallScore: z.number(),
  yearsExperience: z.number(),
  recommendation: z.enum(["Strong Hire", "Hire", "Borderline", "No Hire"]),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  summary: z.string(),
  technicalConcerns: z.array(z.string()),
  clarificationsNeeded: z.array(z.string()),
  interviewQuestions: z.array(z.string()),
  metrics: z.object({
    skills: z.number(),
    experience: z.number(),
    education: z.number(),
    domain: z.number(),
    communication: z.number(),
    stability: z.number()
  })
});

function sseEvent(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function analyzeCandidate(job, candidate) {
  const prompt = `
You are an expert recruiting analyst and ATS scorer.

Analyze ONE candidate against the provided role.

Rules:
1. Be strict and realistic.
2. Do not invent qualifications not present in the CV.
3. If information is absent, treat it as unknown.
4. Penalize obvious missing must-have skills.
5. Use the provided weightings when calculating overallScore.
6. Generate:
   - technicalConcerns
   - clarificationsNeeded
   - interviewQuestions (exactly 5)
7. Return valid JSON only.
`.trim();

  const response = await openai.responses.create({
    model: "gpt-5",
    input: [
      {
        role: "developer",
        content: [{ type: "input_text", text: prompt }]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              job,
              candidate
            })
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "evlos_single_candidate_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            fileName: { type: "string" },
            candidateName: { type: "string" },
            overallScore: { type: "number" },
            yearsExperience: { type: "number" },
            recommendation: {
              type: "string",
              enum: ["Strong Hire", "Hire", "Borderline", "No Hire"]
            },
            matchedSkills: { type: "array", items: { type: "string" } },
            missingSkills: { type: "array", items: { type: "string" } },
            strengths: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
            technicalConcerns: { type: "array", items: { type: "string" } },
            clarificationsNeeded: { type: "array", items: { type: "string" } },
            interviewQuestions: {
              type: "array",
              minItems: 5,
              maxItems: 5,
              items: { type: "string" }
            },
            metrics: {
              type: "object",
              additionalProperties: false,
              properties: {
                skills: { type: "number" },
                experience: { type: "number" },
                education: { type: "number" },
                domain: { type: "number" },
                communication: { type: "number" },
                stability: { type: "number" }
              },
              required: [
                "skills",
                "experience",
                "education",
                "domain",
                "communication",
                "stability"
              ]
            }
          },
          required: [
            "fileName",
            "candidateName",
            "overallScore",
            "yearsExperience",
            "recommendation",
            "matchedSkills",
            "missingSkills",
            "strengths",
            "risks",
            "summary",
            "technicalConcerns",
            "clarificationsNeeded",
            "interviewQuestions",
            "metrics"
          ]
        }
      }
    }
  });

  const parsed = CandidateSchema.parse(JSON.parse(response.output_text));

  return {
    ...parsed,
    id: uid("candidate")
  };
}

function buildBatchSummary(job, rankings) {
  const top = rankings[0];
  const avgScore = rankings.length
    ? Math.round(
        rankings.reduce((sum, c) => sum + c.overallScore, 0) / rankings.length
      )
    : 0;

  return {
    recommendedCandidate: top?.candidateName || top?.fileName || "No candidate",
    overallObservation: `Processed ${rankings.length} candidate(s) for ${job.title}. Average score was ${avgScore}. The strongest current match is ${top?.candidateName || top?.fileName || "N/A"}.`,
    riskNote:
      top?.risks?.[0] ||
      "Review missing must-have skills and ambiguous experience claims before making a final decision."
  };
}

export async function POST(req) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload) => {
        controller.enqueue(encoder.encode(sseEvent(payload)));
      };

      try {
        const body = await req.json();
        const parsed = RequestSchema.safeParse(body);

        if (!parsed.success) {
          send({
            type: "error",
            message: "Invalid request payload."
          });
          controller.close();
          return;
        }

        if (!process.env.OPENAI_API_KEY) {
          send({
            type: "error",
            message: "Missing OPENAI_API_KEY on the server."
          });
          controller.close();
          return;
        }

        const { job, candidates } = parsed.data;
        const results = [];
        const startedAt = Date.now();

        send({
          type: "stage",
          stage: "server_started",
          total: candidates.length
        });

        for (let i = 0; i < candidates.length; i += 1) {
          const candidate = candidates[i];
          const candidateStart = Date.now();

          send({
            type: "candidate_started",
            index: i,
            current: i + 1,
            total: candidates.length,
            fileName: candidate.fileName
          });

          const analyzed = await analyzeCandidate(job, candidate);
          const elapsedMs = Date.now() - candidateStart;

          results.push(analyzed);

          send({
            type: "candidate_done",
            index: i,
            current: i + 1,
            total: candidates.length,
            elapsedMs,
            candidate: analyzed
          });
        }

        send({
          type: "stage",
          stage: "finalizing"
        });

        const rankings = [...results].sort((a, b) => b.overallScore - a.overallScore);
        const summary = buildBatchSummary(job, rankings);

        send({
          type: "complete",
          totalElapsedMs: Date.now() - startedAt,
          summary,
          rankings
        });

        controller.close();
      } catch (error) {
        send({
          type: "error",
          message: error?.message || "Unknown server error"
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}