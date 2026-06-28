import { plugin } from "bun"
import path from "path"

const helixLogoPath = path.resolve(import.meta.dir, "logo.ts")

plugin({
  name: "helix-logo-override",
  setup(build) {
    build.onResolve({ filter: /logo(\.ts)?$/ }, (args) => {
      if (args.importer?.includes("/tui/src/component/logo.tsx") && args.path === "../logo") {
        return { path: helixLogoPath, namespace: "file" }
      }
    })
  },
})
