import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const InboxTable = sqliteTable("inbox", {
  id: text("id").primaryKey(),
  receiver_session: text("receiver_session").notNull(),
  receiver_actor: text("receiver_actor").notNull(),
  sender_actor: text("sender_actor").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(),
  read: integer("read").notNull().default(0),
  time_created: integer("time_created").notNull(),
})
