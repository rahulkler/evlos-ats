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
  id: z.string(),
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

const OutputSchema = z.object({
  summary: z.object({
    recommendedCandidate: z.string(),
    overallObservation: z.string(),
    riskNote: z.string()
  }),
  rankings: z.array(CandidateSchema)
});

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request payload.",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const { job, candidates } = parsed.data;

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY on the server." },
        { status: 500 }
      );
    }

    const prompt = `
You are an expert recruiting analyst and ATS scorer.

Your task:
1. Analyze all candidate CVs against the provided role definition.
2. Score every candidate from 0 to 100 overall.
3. Fill category metrics from 0 to 100 for:
   - skills
   - experience
   - education
   - domain
   - communication
   - stability
4. Use the provided weightings when calculating overallScore.
5. Rank candidates from best to worst.
6. Be strict, realistic, and comparative across the whole batch.
7. Penalize obvious missing must-have skills.
8. Do not invent qualifications not present in the CV.
9. If information is absent, treat it as unknown instead of assumed.
10. For each candidate, generate:
   - technicalConcerns: concrete things to probe in technical review
   - clarificationsNeeded: factual questions where the CV is incomplete or ambiguous
   - interviewQuestions: 5 role-relevant interview questions tailored to the candidate's profile
11. Keep summaries concise and high signal.
12. Return valid JSON matching the required schema only.

Recommendation rubric:
- Strong Hire: exceptional fit
- Hire: solid fit
- Borderline: mixed fit, interview only if pool is weak
- No Hire: poor fit
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
          content: [{ type: "input_text", text: JSON.stringify({ job, candidates }) }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "evlos_ats_batch_screening",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: {
                type: "object",
                additionalProperties: false,
                properties: {
                  recommendedCandidate: { type: "string" },
                  overallObservation: { type: "string" },
                  riskNote: { type: "string" }
                },
                required: ["recommendedCandidate", "overallObservation", "riskNote"]
              },
              rankings: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
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
                    interviewQuestions: { type: "array", items: { type: "string" } },
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
                    "id",
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
            },
            required: ["summary", "rankings"]
          }
        }
      }
    });

    const raw = response.output_text;
    const json = JSON.parse(raw);
    const validated = OutputSchema.parse(json);

    const rankings = validated.rankings
      .map((candidate) => ({
        ...candidate,
        id: candidate.id || uid("candidate")
      }))
      .sort((a, b) => b.overallScore - a.overallScore);

    return Response.json({
      summary: validated.summary,
      rankings
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: error?.message || "Unknown server error"
      },
      { status: 500 }
    );
  }
}