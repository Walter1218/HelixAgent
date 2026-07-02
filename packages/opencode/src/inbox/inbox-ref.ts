import { Effect } from "effect"
import type { Interface } from "./inbox"

let inboxRef: Interface | undefined

export function setInboxRef(inbox: Interface) {
  inboxRef = inbox
}

export function getInboxRef(): Interface | undefined {
  return inboxRef
}

export function requireInbox(): Interface {
  if (!inboxRef) {
    throw new Error("Inbox.Service not initialized. Call setInboxRef() first.")
  }
  return inboxRef
}

export function sendToInbox(message: {
  receiver_session: string
  receiver_actor: string
  sender_actor: string
  content: string
  type: string
}): Effect.Effect<any> {
  const inbox = requireInbox()
  return inbox.send(message)
}
