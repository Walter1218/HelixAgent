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

export * as Team from "./team"
