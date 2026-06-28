import z from "zod"

export const ActorRegistered = {
  type: "actor.registered",
  properties: z.object({
    sessionID: z.string(),
    actorID: z.string(),
    mode: z.enum(["peer", "subagent", "main"]),
    parentActorID: z.string().optional(),
    description: z.string(),
    agent: z.string(),
    background: z.boolean(),
  }),
}

export const ActorStatusChanged = {
  type: "actor.status",
  properties: z.object({
    sessionID: z.string(),
    actorID: z.string(),
    status: z.enum(["pending", "running", "idle"]),
    lastOutcome: z.enum(["success", "failure", "cancelled"]).optional(),
    turnCount: z.number(),
    lastTurnTime: z.number(),
    error: z.string().optional(),
  }),
}

export const ActorStuck = {
  type: "actor.stuck",
  properties: z.object({
    sessionID: z.string(),
    actorID: z.string(),
    description: z.string(),
    lastTurnTime: z.number(),
    stuckDuration: z.number(),
  }),
}
