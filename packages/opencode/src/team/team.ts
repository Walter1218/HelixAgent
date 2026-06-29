export interface TeamMember {
  sessionID: string
  agent: string
  role: string
  joinedAt: number
}

export interface Team {
  id: string
  name: string
  members: TeamMember[]
  createdAt: number
}

export function createTeamId(): string {
  return `team_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function addMember(team: Team, member: TeamMember): Team {
  const existing = team.members.find(m => m.sessionID === member.sessionID)
  if (existing) return team
  
  return {
    ...team,
    members: [...team.members, member],
  }
}

export function removeMember(team: Team, sessionID: string): Team {
  return {
    ...team,
    members: team.members.filter(m => m.sessionID !== sessionID),
  }
}

export function getMember(team: Team, sessionID: string): TeamMember | undefined {
  return team.members.find(m => m.sessionID === sessionID)
}

export function getMembersByRole(team: Team, role: string): TeamMember[] {
  return team.members.filter(m => m.role === role)
}

export function formatTeam(team: Team): string {
  const lines = [`Team: ${team.name} (${team.id})`]
  lines.push(`Members: ${team.members.length}`)
  for (const member of team.members) {
    lines.push(`  - ${member.agent} (${member.role})`)
  }
  return lines.join("\n")
}

import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"

export interface Interface {
  readonly createTeam: (name: string) => Effect.Effect<Team>
  readonly addMember: (team: Team, member: TeamMember) => Effect.Effect<Team>
  readonly removeMember: (team: Team, sessionID: string) => Effect.Effect<Team>
  readonly getMember: (team: Team, sessionID: string) => Effect.Effect<TeamMember | undefined>
  readonly formatTeam: (team: Team) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Team") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    return Service.of({
      createTeam: (name) => Effect.succeed({ id: createTeamId(), name, members: [], createdAt: Date.now() }),
      addMember: (team, member) => Effect.succeed(addMember(team, member)),
      removeMember: (team, sessionID) => Effect.succeed(removeMember(team, sessionID)),
      getMember: (team, sessionID) => Effect.succeed(getMember(team, sessionID)),
      formatTeam: (team) => Effect.succeed(formatTeam(team)),
    })
  })
)

export const defaultLayer = layer

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [] })

export * as Team from "./team"
