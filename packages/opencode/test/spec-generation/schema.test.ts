import { describe, expect, it } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import {
  ReqAgentOutput,
  ArchAgentOutput,
  AcceptAgentOutput,
  TestAgentOutput,
  ReviewReport,
  SpecReviewConfig,
} from "@/spec-generation/schema"

describe("spec-generation schema", () => {
  it("ReqAgentOutput schema is valid", () => {
    const data = {
      coreGoal: "Add SMS verification to login",
      requirementDrafts: [
        {
          id: "R1",
          title: "SMS verification",
          description: "Add SMS code verification to login flow",
          type: "functional" as const,
          priority: "must" as const,
          dependencies: [],
        },
      ],
      constraints: ["Must work with existing auth system"],
      assumptions: ["User has phone number"],
      openQuestions: ["Which SMS provider?"],
      domain: "auth",
    }
    const decoded = Schema.decodeUnknownSync(ReqAgentOutput)(data)
    expect(decoded.coreGoal).toBe("Add SMS verification to login")
    expect(decoded.requirementDrafts).toHaveLength(1)
    expect(decoded.requirementDrafts[0].type).toBe("functional")
  })

  it("ArchAgentOutput schema is valid", () => {
    const data = {
      projectType: "typescript",
      techStack: ["typescript", "effect", "drizzle"],
      filesToModify: [{ path: "src/auth.ts", action: "modify" as const, description: "Add SMS verification" }],
      filesToCreate: [{ path: "src/sms.ts", action: "create" as const, description: "SMS service" }],
      modulesToReuse: [{ name: "Auth", file: "src/auth.ts", description: "Existing auth module" }],
      interfaces: [{ name: "SMSProvider", file: "src/sms.ts", description: "SMS provider interface" }],
      dataFlow: ["User -> Auth -> SMS -> Verify"],
      risks: [{ description: "SMS delivery delay", severity: "medium" as const, mitigation: "Add retry" }],
      conventions: ["Use Effect services"],
    }
    const decoded = Schema.decodeUnknownSync(ArchAgentOutput)(data)
    expect(decoded.projectType).toBe("typescript")
    expect(decoded.filesToModify).toHaveLength(1)
  })

  it("AcceptAgentOutput schema is valid", () => {
    const data = {
      criteria: [
        {
          requirementId: "R1",
          description: "SMS verification works",
          verification: { type: "test" as const, target: "bun test test/auth.test.ts" },
          confidence: "high" as const,
          explanation: "Test file exists",
        },
      ],
      unverifiableRequirements: [],
    }
    const decoded = Schema.decodeUnknownSync(AcceptAgentOutput)(data)
    expect(decoded.criteria).toHaveLength(1)
    expect(decoded.criteria[0].verification.type).toBe("test")
  })

  it("ReviewReport schema is valid", () => {
    const data = {
      score: 85,
      verdict: "approve" as const,
      issues: [
        {
          category: "completeness" as const,
          severity: "suggestion" as const,
          description: "Consider adding error handling",
          fixSuggestion: "Add try-catch around SMS calls",
        },
      ],
      strengths: ["Clear requirements", "Good verification"],
      summary: "Good spec overall",
    }
    const decoded = Schema.decodeUnknownSync(ReviewReport)(data)
    expect(decoded.score).toBe(85)
    expect(decoded.verdict).toBe("approve")
  })

  it("ReviewReport rejects invalid verdict", () => {
    const data = {
      score: 85,
      verdict: "invalid",
      issues: [],
      strengths: [],
      summary: "test",
    }
    expect(() => Schema.decodeUnknownSync(ReviewReport)(data)).toThrow()
  })
})
