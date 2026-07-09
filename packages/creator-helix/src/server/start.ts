import { serve } from "bun"
import { makeRuntime } from "@opencode-ai/core/effect/runtime"
import { Database } from "@opencode-ai/core/database/database"
import { Migration } from "../persistence/migrate"
import { Server } from "./app"

const { runPromise } = makeRuntime(Database.Service, Database.defaultLayer)

async function main() {
  await runPromise(() => Migration.run)

  const port = Number(process.env.CREATOR_HELIX_PORT ?? 3456)
  serve({
    port,
    fetch: Server.app.fetch,
  })

  console.log(`CreatorHelix server running at http://localhost:${port}`)
}

main().catch((error) => {
  console.error("Failed to start server:", error)
  process.exit(1)
})
