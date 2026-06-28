import { logo, logoThin, slogan } from "./src/logo.ts"

function renderLogo(data: { left: string[]; right: string[] }) {
  const lines: string[] = []
  for (let i = 0; i < data.left.length; i++) {
    lines.push(`${data.left[i]}  ${data.right[i]}`)
  }
  return lines.join("\n")
}

console.log("\n=== HelixAgent TUI Logo ===\n")
console.log(renderLogo(logo))
console.log(`\n  ${slogan}\n`)
console.log("=== Thin Version ===\n")
console.log(renderLogo(logoThin))
console.log()
