import type { InboxMessage } from "./inbox"

export function renderInboxMessage(message: InboxMessage): string {
  const time = new Date(message.time_created).toISOString()
  const readStatus = message.read ? "✓" : "●"
  return `[${readStatus}] ${time} | ${message.sender_actor} → ${message.receiver_actor}\n  ${message.content}`
}

export function renderInboxList(messages: InboxMessage[]): string {
  if (messages.length === 0) {
    return "No messages in inbox."
  }

  const unreadCount = messages.filter(m => !m.read).length
  const header = unreadCount > 0
    ? `Inbox (${unreadCount} unread, ${messages.length} total):`
    : `Inbox (${messages.length} messages):`

  return [
    header,
    "",
    ...messages.map(m => renderInboxMessage(m)),
  ].join("\n")
}

export function truncateContent(content: string, maxLength = 200): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength - 3) + "..."
}
