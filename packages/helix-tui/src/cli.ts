import path from "path"
import { fileURLToPath } from "url"
import { Effect } from "effect"

declare global {
  const OPENCODE_WORKER_PATH: string
}

type RpcClient = ReturnType<typeof Rpc.client<any>>

function createWorkerFetch(client: RpcClient): typeof fetch {
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const body = request.body ? await request.text() : undefined
    const result = await client.call("fetch", {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    })
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    })
  }
  return fn as typeof fetch
}

function createEventSource(client: RpcClient): any {
  return {
    subscribe: async (handler: any) => {
      return client.on("global.event", (e: any) => {
        handler(e)
      })
    },
  }
}

async function target() {
  if (typeof OPENCODE_WORKER_PATH !== "undefined") return OPENCODE_WORKER_PATH
  const dist = new URL("../opencode/dist/cli/tui/worker.js", import.meta.url)
  try {
    await Bun.file(fileURLToPath(dist)).exists()
    return dist
  } catch {}
  return new URL("../../opencode/src/cli/tui/worker.ts", import.meta.url)
}

function resolveDirectory(project?: string) {
  const cwd = process.cwd()
  if (project) return path.isAbsolute(project) ? project : path.join(cwd, project)
  return cwd
}

export async function run(args: {
  project?: string
  model?: string
  agent?: string
  prompt?: string
  continue?: boolean
  session?: string
  fork?: boolean
}) {
  const { TuiConfig } = await import("@opencode-ai/tui/config")
  const { run: runLayer } = await import("./layer")
  const { createLegacyTuiPluginHost } = await import("@opencode-ai/opencode/plugin/tui/runtime")

  const next = resolveDirectory(args.project)
  const file = await target()
  try {
    process.chdir(next)
  } catch {
    console.error("Failed to change directory to " + next)
    process.exit(1)
  }
  const cwd = process.cwd()

  const worker = new Worker(file)
  const client = Rpc.client(worker)

  let stopped = false
  const stop = async () => {
    if (stopped) return
    stopped = true
    await client.call("shutdown", undefined).catch(() => {})
    worker.terminate()
  }

  const config = await TuiConfig.get()
  const transport = {
    url: "http://opencode.internal",
    fetch: createWorkerFetch(client),
    events: createEventSource(client),
  }

  try {
    await Effect.runPromise(
      runLayer({
        url: transport.url,
        config,
        pluginHost: createLegacyTuiPluginHost(),
        directory: cwd,
        fetch: transport.fetch,
        events: transport.events,
        args: {
          continue: args.continue,
          sessionID: args.session,
          agent: args.agent,
          model: args.model,
          prompt: args.prompt,
          fork: args.fork,
        },
      }),
    )
  } finally {
    await stop()
  }
  process.exit(0)
}
