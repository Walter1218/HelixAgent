export interface Plugin {
  id: string
  name: string
  description: string
  version: string
  enabled: boolean
}

export interface PluginHook {
  name: string
  handler: (...args: unknown[]) => unknown
}

export function createPluginId(): string {
  return `plugin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function registerHook(plugin: Plugin, hook: PluginHook): Plugin & { hooks: PluginHook[] } {
  return {
    ...plugin,
    hooks: [...((plugin as any).hooks || []), hook],
  }
}

export function formatPlugin(plugin: Plugin): string {
  return `${plugin.name} v${plugin.version} - ${plugin.description}`
}

export * as Plugin from "./plugin"
