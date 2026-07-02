import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { OpenSpec } from "@/openspec/spec"
import path from "path"
import fs from "fs"

const TEST_DIR = path.resolve(import.meta.dir, "..", "..", "test-fixtures", "openspec-ast")

function setup() {
  fs.mkdirSync(TEST_DIR, { recursive: true })
}

function cleanup() {
  fs.rmSync(TEST_DIR, { recursive: true, force: true })
}

describe("OpenSpec ast verification", () => {
  it("ast verification passes when file contains pattern", async () => {
    setup()
    const program = Effect.gen(function* () {
      const openSpec = yield* OpenSpec.Service

      const testFile = path.join(TEST_DIR, "auth.ts")
      fs.writeFileSync(testFile, 'export function login(user: string) { return true }\nexport function logout() {}')

      const specFile = path.join(TEST_DIR, "spec.md")
      // Use absolute path in verification target
      fs.writeFileSync(specFile, `# Auth Spec

## Overview
Authentication module

## Requirements

### Requirement 1: Login function
- **Status**: pending
- **Verification**: ast ${testFile}:export function login
`)

      const spec = yield* openSpec.parseSpecFile(specFile)
      const req = spec.requirements[0]
      const result = yield* openSpec.checkRequirement(req)
      expect(result).toBe(true)
    })

    try {
      await Effect.runPromise(program.pipe(Effect.provide(OpenSpec.defaultLayer)))
    } finally {
      cleanup()
    }
  })

  it("ast verification fails when file does not contain pattern", async () => {
    setup()
    const program = Effect.gen(function* () {
      const openSpec = yield* OpenSpec.Service

      const testFile = path.join(TEST_DIR, "auth2.ts")
      fs.writeFileSync(testFile, 'export function register(user: string) { return true }')

      const specFile = path.join(TEST_DIR, "spec2.md")
      fs.writeFileSync(specFile, `# Auth Spec

## Overview
Authentication module

## Requirements

### Requirement 1: Login function
- **Status**: pending
- **Verification**: ast ${testFile}:export function login
`)

      const spec = yield* openSpec.parseSpecFile(specFile)
      const req = spec.requirements[0]
      const result = yield* openSpec.checkRequirement(req)
      expect(result).toBe(false)
    })

    try {
      await Effect.runPromise(program.pipe(Effect.provide(OpenSpec.defaultLayer)))
    } finally {
      cleanup()
    }
  })

  it("ast verification with regex pattern", async () => {
    setup()
    const program = Effect.gen(function* () {
      const openSpec = yield* OpenSpec.Service

      const testFile = path.join(TEST_DIR, "auth3.ts")
      fs.writeFileSync(testFile, 'export async function login(user: string) { return true }')

      const specFile = path.join(TEST_DIR, "spec3.md")
      fs.writeFileSync(specFile, `# Auth Spec

## Overview
Authentication module

## Requirements

### Requirement 1: Login function
- **Status**: pending
- **Verification**: ast ${testFile}:/export\\s+async\\s+function\\s+login/
`)

      const spec = yield* openSpec.parseSpecFile(specFile)
      const req = spec.requirements[0]
      const result = yield* openSpec.checkRequirement(req)
      expect(result).toBe(true)
    })

    try {
      await Effect.runPromise(program.pipe(Effect.provide(OpenSpec.defaultLayer)))
    } finally {
      cleanup()
    }
  })

  it("ast verification fails when file not found", async () => {
    setup()
    const program = Effect.gen(function* () {
      const openSpec = yield* OpenSpec.Service

      const specFile = path.join(TEST_DIR, "spec4.md")
      fs.writeFileSync(specFile, `# Auth Spec

## Overview
Authentication module

## Requirements

### Requirement 1: Login function
- **Status**: pending
- **Verification**: ast ${TEST_DIR}/nonexistent.ts:export function login
`)

      const spec = yield* openSpec.parseSpecFile(specFile)
      const req = spec.requirements[0]
      const result = yield* openSpec.checkRequirement(req)
      expect(result).toBe(false)
    })

    try {
      await Effect.runPromise(program.pipe(Effect.provide(OpenSpec.defaultLayer)))
    } finally {
      cleanup()
    }
  })
})
