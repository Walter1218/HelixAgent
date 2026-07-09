---
name: anime-creator-test
description: Standardized anime-creator pipeline testing — typecheck pipeline files, run test scripts, verify renders
---

# Anime Creator Pipeline Test

Standardized workflow for testing anime-creator pipelines and scripts.

## When To Use

- After modifying pipeline files in `.opencode/tools/lib/`
- After changing test scripts in `scripts/`
- Before committing anime-creator changes
- When verifying 3D engine integration

## Pattern

### 1. Typecheck pipeline files

Always typecheck the specific pipeline file you changed:

```bash
cd /Users/onetwo/Documents/trae_projects/anime-creator/frontend

# Typecheck single file
npx tsc --noEmit --esModuleInterop --moduleResolution node --target es2020 --module commonjs ../.opencode/tools/lib/engine-3d-pipeline.ts 2>&1 | head -10

# Typecheck multiple files
npx tsc --noEmit --esModuleInterop --moduleResolution node --target es2020 --module commonjs ../.opencode/tools/lib/creation-pipeline.ts ../.opencode/tools/lib/engine-3d-pipeline.ts 2>&1 | head -10
```

### 2. Run test scripts

```bash
cd /Users/onetwo/Documents/trae_projects/anime-creator

# Generate 3 shots test
rm -rf projects/structure-shots && node scripts/generate-3-shots.js 2>&1 | tail -5

# Main chain test
rm -rf projects/main-chain-test && node scripts/main-chain-test.js 2>&1 | tail -15

# Multi-view test
node scripts/multi-view-test.js 2>&1 | tail -20
```

### 3. Verify renders exist

```bash
cd /Users/onetwo/Documents/trae_projects/anime-creator/projects/structure-shots
ls -lh *.mp4 2>/dev/null
```

### 4. Extract frames for visual verification

```bash
cd /Users/onetwo/Documents/trae_projects/anime-creator/projects/structure-test
ffmpeg -y -i structure-video.mp4 -vf "select=eq(n\,0)" -vframes 1 frame-0.jpg 2>/dev/null
ffmpeg -y -i structure-video.mp4 -vf "select=eq(n\,60)" -vframes 1 frame-60.jpg 2>/dev/null
ffmpeg -y -i structure-video.mp4 -vf "select=eq(n\,119)" -vframes 1 frame-119.jpg 2>/dev/null
echo "抽帧完成"
```

### 5. Clean up test artifacts

```bash
rm -f /Users/onetwo/Documents/trae_projects/anime-creator/test-*.js
```

## Common Pipeline Files

| File | Purpose |
|------|---------|
| `engine-3d-pipeline.ts` | 3D engine integration |
| `creation-pipeline.ts` | Content creation pipeline |
| `structure-multi-agent-pipeline.ts` | Multi-agent structure |
| `helix-structure-cli.ts` | Helix structure CLI |
| `shot-designer-v2.ts` | Shot designer v2 |

## Environment Variables

Some tests require API keys:

```bash
export MIMO_API_KEY="<your-mimo-api-key>"
export MIMO_API_BASE="https://token-plan-cn.xiaomimimo.com/v1"
export SEEDANCE_API_KEY="<your-seedance-api-key>"
export SEEDANCE_API_BASE="https://ark.cn-beijing.volces.com/api/v3"
```

## Anti-patterns

- Don't typecheck the entire frontend; target specific files
- Don't skip frame extraction for visual verification
- Don't commit test artifacts (projects/*-test/)
