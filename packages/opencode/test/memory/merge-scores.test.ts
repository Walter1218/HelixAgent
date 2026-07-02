import { describe, it, expect } from "bun:test"

// 模拟 mergeScores 函数逻辑
const FTS_WEIGHT = 0.6
const VEC_WEIGHT = 0.4
const CO_OCCURRENCE_BOOST = 1.3

interface VecSearchRow {
  memory_path: string
  score: number
}

function mergeScores(
  ftsResults: Array<{ path: string; snippet: string; scope: string; scope_id: string; type: string }>,
  vecResults: VecSearchRow[],
  limit: number
): Array<{ path: string; snippet: string; score: number; scope: string; scope_id: string; type: string }> {
  const ftsRankMap = new Map(
    ftsResults.map((r, i) => [r.path, 1 - i / Math.max(ftsResults.length, 1)])
  )

  const vecNormMap = new Map(
    vecResults.map(r => [r.memory_path, (r.score + 1) / 2])
  )

  const allPaths = new Set([...ftsRankMap.keys(), ...vecNormMap.keys()])
  const snippetMap = new Map(ftsResults.map(r => [r.path, r.snippet]))
  const metaMap = new Map(ftsResults.map(r => [r.path, r]))

  const merged = [...allPaths].map(path => {
    const fts = ftsRankMap.get(path) ?? 0
    const vec = vecNormMap.get(path) ?? 0
    const base = fts * FTS_WEIGHT + vec * VEC_WEIGHT
    const boost = (fts > 0 && vec > 0) ? CO_OCCURRENCE_BOOST : 1.0
    const meta = metaMap.get(path)
    return {
      path,
      snippet: snippetMap.get(path) ?? "",
      score: base * boost,
      scope: meta?.scope ?? "",
      scope_id: meta?.scope_id ?? "",
      type: meta?.type ?? "",
    }
  })

  return merged.sort((a, b) => b.score - a.score).slice(0, limit)
}

describe("mergeScores hybrid ranking", () => {
  it("should rank co-occurring results higher", () => {
    const ftsResults = [
      { path: "/a.md", snippet: "snippet a", scope: "global", scope_id: "", type: "memory" },
      { path: "/b.md", snippet: "snippet b", scope: "global", scope_id: "", type: "memory" },
    ]
    const vecResults: VecSearchRow[] = [
      { memory_path: "/a.md", score: 0.8 },
      { memory_path: "/c.md", score: 0.9 },
    ]

    const result = mergeScores(ftsResults, vecResults, 10)
    
    console.log("✓ Hybrid scores:")
    result.forEach(r => console.log(`  ${r.path}: ${r.score.toFixed(4)}`))

    // /a.md 在 FTS 和 Vec 中都出现，应该得到 boost
    expect(result[0].path).toBe("/a.md")
    expect(result[0].score).toBeGreaterThan(result[1].score)
  })

  it("should handle FTS-only results", () => {
    const ftsResults = [
      { path: "/fts-only.md", snippet: "fts snippet", scope: "global", scope_id: "", type: "memory" },
    ]
    const vecResults: VecSearchRow[] = []

    const result = mergeScores(ftsResults, vecResults, 10)
    
    expect(result.length).toBe(1)
    expect(result[0].path).toBe("/fts-only.md")
    expect(result[0].score).toBeGreaterThan(0)
    console.log("✓ FTS-only score:", result[0].score.toFixed(4))
  })

  it("should handle Vec-only results", () => {
    const ftsResults: any[] = []
    const vecResults: VecSearchRow[] = [
      { memory_path: "/vec-only.md", score: 0.7 },
    ]

    const result = mergeScores(ftsResults, vecResults, 10)
    
    expect(result.length).toBe(1)
    expect(result[0].path).toBe("/vec-only.md")
    expect(result[0].score).toBeGreaterThan(0)
    console.log("✓ Vec-only score:", result[0].score.toFixed(4))
  })

  it("should apply boost correctly", () => {
    // 场景：一个文档在 FTS 排第 2，在 Vec 排第 1
    const ftsResults = [
      { path: "/fts-top.md", snippet: "fts top", scope: "global", scope_id: "", type: "memory" },
      { path: "/both.md", snippet: "both", scope: "global", scope_id: "", type: "memory" },
    ]
    const vecResults: VecSearchRow[] = [
      { memory_path: "/both.md", score: 0.95 },
      { memory_path: "/vec-only.md", score: 0.85 },
    ]

    const result = mergeScores(ftsResults, vecResults, 10)
    
    console.log("✓ Boost test:")
    result.forEach(r => console.log(`  ${r.path}: ${r.score.toFixed(4)}`))

    // /both.md 有 boost，应该排第一
    expect(result[0].path).toBe("/both.md")
  })

  it("should respect limit", () => {
    const ftsResults = Array.from({ length: 20 }, (_, i) => ({
      path: `/file${i}.md`,
      snippet: `snippet ${i}`,
      scope: "global",
      scope_id: "",
      type: "memory",
    }))
    const vecResults: VecSearchRow[] = []

    const result = mergeScores(ftsResults, vecResults, 5)
    expect(result.length).toBe(5)
    console.log("✓ Limit works: returned", result.length, "of 20")
  })
})
