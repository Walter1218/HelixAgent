import { Effect, Context, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Database } from "@opencode-ai/core/database/database"
import { TeamTable, TeamMemberTable } from "@opencode-ai/core/team/team.sql"
import { eq } from "drizzle-orm"

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

export interface Interface {
  readonly createTeam: (name: string) => Effect.Effect<Team>
  readonly addMember: (team: Team, member: TeamMember) => Effect.Effect<Team>
  readonly removeMember: (team: Team, sessionID: string) => Effect.Effect<Team>
  readonly getMember: (team: Team, sessionID: string) => Effect.Effect<TeamMember | undefined>
  readonly formatTeam: (team: Team) => Effect.Effect<string>
  readonly getOrCreateTeam: (ownerSessionID: string, name: string) => Effect.Effect<Team, Error>
  readonly addMemberToOwnerSession: (ownerSessionID: string, member: TeamMember) => Effect.Effect<void, Error>
  readonly getTeamByOwnerSession: (ownerSessionID: string) => Effect.Effect<Team | undefined, Error>
  readonly formatTeamByOwnerSession: (ownerSessionID: string) => Effect.Effect<string | undefined, Error>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Team") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const getOrCreateTeam = Effect.fn("Team.getOrCreateTeam")(function* (ownerSessionID: string, name: string) {
      const existing = yield* db.select().from(TeamTable)
        .where(eq(TeamTable.owner_session_id, ownerSessionID))
        .all()
        .pipe(Effect.orDie)

      if (existing.length > 0) {
        const team = existing[0]
        const members = yield* db.select().from(TeamMemberTable)
          .where(eq(TeamMemberTable.team_id, team.id))
          .all()
          .pipe(Effect.orDie)

        return {
          id: team.id,
          name: team.name,
          members: members.map((m: any) => ({
            sessionID: m.session_id,
            agent: m.agent,
            role: m.role,
            joinedAt: m.joined_at,
          })),
          createdAt: team.created_at,
        }
      }

      const teamID = createTeamId()
      yield* db.insert(TeamTable).values({
        id: teamID,
        owner_session_id: ownerSessionID,
        name,
        created_at: Date.now(),
      }).pipe(Effect.orDie)

      return { id: teamID, name, members: [], createdAt: Date.now() }
    })

    const addMemberToOwnerSession = Effect.fn("Team.addMemberToOwnerSession")(function* (
      ownerSessionID: string,
      member: TeamMember,
    ) {
      const team = yield* getOrCreateTeam(ownerSessionID, `Team-${ownerSessionID.slice(0, 8)}`)

      const existing = yield* db.select().from(TeamMemberTable)
        .where(eq(TeamMemberTable.session_id, member.sessionID))
        .all()
        .pipe(Effect.orDie)

      if (existing.length > 0) return

      yield* db.insert(TeamMemberTable).values({
        id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        team_id: team.id,
        session_id: member.sessionID,
        agent: member.agent,
        role: member.role,
        joined_at: member.joinedAt,
      }).pipe(Effect.orDie)
    })

    const getTeamByOwnerSession = Effect.fn("Team.getTeamByOwnerSession")(function* (ownerSessionID: string) {
      const existing = yield* db.select().from(TeamTable)
        .where(eq(TeamTable.owner_session_id, ownerSessionID))
        .all()
        .pipe(Effect.orDie)

      if (existing.length === 0) return undefined

      const team = existing[0]
      const members = yield* db.select().from(TeamMemberTable)
        .where(eq(TeamMemberTable.team_id, team.id))
        .all()
        .pipe(Effect.orDie)

      return {
        id: team.id,
        name: team.name,
        members: members.map((m: any) => ({
          sessionID: m.session_id,
          agent: m.agent,
          role: m.role,
          joinedAt: m.joined_at,
        })),
        createdAt: team.created_at,
      }
    })

    const formatTeamByOwnerSession = Effect.fn("Team.formatTeamByOwnerSession")(function* (ownerSessionID: string) {
      const team = yield* getTeamByOwnerSession(ownerSessionID)
      if (!team) return undefined
      return formatTeam(team)
    })

    return Service.of({
      createTeam: (name) => Effect.succeed({ id: createTeamId(), name, members: [], createdAt: Date.now() }),
      addMember: (team, member) => Effect.succeed(addMember(team, member)),
      removeMember: (team, sessionID) => Effect.succeed(removeMember(team, sessionID)),
      getMember: (team, sessionID) => Effect.succeed(getMember(team, sessionID)),
      formatTeam: (team) => Effect.succeed(formatTeam(team)),
      getOrCreateTeam,
      addMemberToOwnerSession,
      getTeamByOwnerSession,
      formatTeamByOwnerSession,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer))

export const node = LayerNode.make({ service: Service, layer: defaultLayer, deps: [Database.node] })

export * as Team from "./team"
