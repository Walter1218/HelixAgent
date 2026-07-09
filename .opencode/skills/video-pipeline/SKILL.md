---
name: video-pipeline
description: Design and build multi-agent video generation pipelines with structured scene descriptions, SeedDance/可灵 API integration, and quality A/B testing
---

# Video Pipeline Architecture

Design and implement multi-agent video generation pipelines that translate creative requirements into structured scene descriptions, then generate high-quality prompts for downstream video models.

## When To Use

- Building or extending video generation pipelines (SeedDance, 可灵, Runway, etc.)
- Designing multi-agent systems for creative content (Director, Scene Designer, Cinematographer)
- Implementing structured prompt generation from scene descriptions
- Running A/B/C experiments to compare video generation approaches
- Integrating character consistency (reference images, character sheets) into video workflows

## Architecture Pattern

```
User Intent
    ↓
Director Agent
    ├── Parses narrative structure
    ├── Determines environment type (semantic, not keyword)
    ├── Assigns mood, pacing, emotional arc
    └── Outputs DirectorOutput { mood, environment, pacing, ... }
    ↓
Scene Designer Agent
    ├── Receives DirectorOutput + ShotInput
    ├── Designs spatial layout (SceneConfig JSON)
    ├── Selects template by shot type (not genre)
    └── Outputs SceneConfig { elements[], camera, lighting, ... }
    ↓
Cinematographer Agent
    ├── Receives SceneConfig + DirectorOutput
    ├── Translates to structured prompt (ScenePromptTranslator)
    ├── Assembles character references + scene references
    └── Outputs SeedDance-ready prompt + media references
    ↓
Video Model API (SeedDance / 可灵 / etc.)
```

## Key Design Decisions

### 1. SceneConfig as Intermediate Representation

Use a JSON SceneConfig as the contract between agents. This decouples spatial design from prompt engineering:

```typescript
interface SceneConfig {
  elements: SceneElement[]    // What's in the scene
  camera: CameraConfig        // How to frame it
  lighting: LightingConfig    // How to light it
  mood: string                // Emotional tone
  environment: 'space' | 'nature' | 'city' | 'indoor'
}
```

**Why**: Allows Scene Designer to work in structured space, Cinematographer to work in prompt space. Changes to prompt engineering don't affect spatial design.

### 2. Director-Driven Environment Detection

The Director determines environment type from semantic understanding of the narrative, not keyword matching:

```typescript
// ❌ Bad: keyword matching
if (text.includes('太空')) return 'space'

// ✅ Good: Director semantic analysis
// DirectorOutput.environment = 'nature' (understands "山崖竹林" semantically)
// Scene Designer uses Director's output directly
```

**Why**: Keyword matching fails on creative descriptions. The Director understands context.

### 3. Template System by Shot Type, Not Genre

Classify templates by camera movement and framing, not by subject matter:

| Template | Description |
|----------|-------------|
| `establishing-wide` | Wide shot to establish location |
| `subject-approach` | Camera approaches subject |
| `impact-action` | Dynamic action moment |
| `explosion-bloom` | Explosive/bloom effects |
| `reveal-pullback` | Camera pulls back to reveal |
| `portrait-closeup` | Close-up on subject |

**Why**: Shot-type templates are universal. Genre-specific templates don't generalize.

### 4. Structured Prompt Assembly

Build prompts from structured components, not monolithic strings:

```typescript
function buildVideoPrompt(
  shotIntent: ShotIntent,
  globalStyle: GlobalStyle,
  sceneConfig: SceneConfig
): string {
  return [
    `Cinematic film shot, ${duration}s long.`,
    subject,
    `Visual: ${visualPrompt}.`,
    `Scene composition: ${elements.length} elements.`,
    cameraDesc,
    `Lighting: ${lightingDesc}, ${globalStyle.lighting}.`,
    `Mood: ${moodKeywords}.`,
    `Color palette: ${globalStyle.colorPalette}.`,
    `Post-processing: ${globalStyle.postProcessing}.`,
    `Quality: photorealistic, 8K, film grain, volumetric lighting, high detail.`
  ].join(' ')
}
```

**Why**: Modular prompts are easier to debug, test, and iterate.

### 5. Text-Only vs Reference Image Debate

**Key finding from A/B/C experiments**: Low-fidelity reference images (e.g., HelixStructure renders at 640x360, 10fps) can *hurt* SeedDance output quality. Text-only prompts often produce better results.

| Approach | Quality | Use Case |
|----------|---------|----------|
| Text-only | ⭐⭐⭐⭐⭐ | Best for creative freedom, high-quality models |
| Text + reference image | ⭐⭐⭐⭐ | Good when reference is high-quality (SeedDream output) |
| Text + low-fi structure | ⭐⭐ | Can degrade quality — use with caution |
| Text + high-fi reference | ⭐⭐⭐⭐⭐ | Best overall, but requires quality reference generation |

**Decision**: Default to text-only. Add reference images only when they're high-quality (e.g., SeedDream-generated character sheets, not Blender wireframes).

## API Integration Patterns

### SeedDance (豆包/方舟)

```typescript
// Ark API endpoint
const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3'
const model = 'doubao-seedance-2-0-mini-260615'

// Text-only generation
const textOnly = {
  model,
  content: [{ type: 'text', text: prompt }],
  duration: 6,
  ratio: '16:9',
  generate_audio: false,
  watermark: false
}

// With reference image (data URI works!)
const withImage = {
  model,
  content: [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
  ],
  // ...
}

// With video reference (must be public HTTP URL, NOT data URI)
const withVideo = {
  model,
  content: [
    { type: 'text', text: prompt },
    { type: 'video_url', video_url: { url: 'https://...' } }
  ],
  // ...
}
```

**Key constraints**:
- `image_url` accepts `data:` URI (base64) — no TOS upload needed
- `video_url` requires public HTTP(S) URL — data URI rejected
- Chinese prompts fully supported (≤500 chars recommended)
- English prompts supported (≤1000 words)
- Only `doubao-seedance-2-0-mini-260615` supports `image_url`/`video_url` on 方舟

### Character Consistency Pipeline

```
Character description → SeedDream (image generation) → Character sheet
    ↓
Each shot: character sheet as reference_image + scene-specific prompt
    ↓
SeedDance generates video with consistent character appearance
```

## A/B Testing Pattern

When comparing approaches, hold the prompt constant and vary only the input type:

```typescript
// Same optimized prompt across all groups
const prompt = '科幻电影场景：深空中，一颗巨大的红色恒星...'

// Group A: text-only
const groupA = { content: [{ type: 'text', text: prompt }] }

// Group B: text + reference image
const groupB = {
  content: [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: dataUri } }
  ]
}

// Group C: text + first frame
const groupC = {
  content: [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: dataUri } }
  ],
  // first_frame parameter if supported
}
```

Extract frames from each output and compare visually. Document findings in a comparison table.

## Common Pitfalls

1. **Hardcoded environment detection** — Always use Director output, never keyword matching in Scene Designer
2. **Low-fi reference images** — Blender wireframes at 640x360 will degrade SeedDance quality
3. **Monolithic prompts** — Break into structured components for debuggability
4. **Genre-specific templates** — Use shot-type templates for universal applicability
5. **TOS upload for images** — Use `data:` URI instead (base64 inline)
6. **video_url with data URI** — Must use public HTTP URL for video references

## File Structure

```
packages/creator-helix/
├── src/
│   ├── agent/
│   │   ├── director.ts           # Narrative + environment analysis
│   │   ├── cinematographer.ts    # Camera + lighting decisions
│   │   ├── storyboard-artist.ts  # Shot sequencing
│   │   ├── scriptwriter.ts       # Script generation
│   │   └── editor.ts             # Post-processing
│   ├── renderer/
│   │   ├── scene-prompt-translator.ts  # SceneConfig → SeedDance prompt
│   │   ├── template-registry.ts        # Shot-type templates
│   │   ├── helix-structure-adapter.ts  # ShotIntent → SceneConfig
│   │   └── control-signal-generator.ts # buildVideoPrompt()
│   ├── services/
│   │   ├── seeddance-client.ts   # SeedDance HTTP client
│   │   ├── video-generation.ts   # Video generation orchestration
│   │   ├── asset-generation.ts   # Asset generation
│   │   └── tos-upload.ts         # TOS file upload (if needed)
│   └── schema/                   # Drizzle schemas
├── scripts/
│   └── fair-comparison.ts        # A/B/C experiment script
└── docs/
    └── seeddance-api-research.md # API documentation
```

## Integration

- Use `deep-explore` skill when mapping a new video model's API surface
- Use `build-verify` skill after pipeline changes
- Use `compare-implementations` skill when evaluating alternative pipeline architectures
- Document experiment results in `docs/` alongside the pipeline code
