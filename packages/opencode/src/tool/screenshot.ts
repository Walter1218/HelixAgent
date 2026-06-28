export const ScreenshotTool = {
  id: "screenshot",
  description: "Capture a screenshot of the current desktop or active browser window and analyze it.",
  parameters: {
    description: { type: "string", description: "What to look for in the screenshot" },
    include_annotations: { type: "boolean", description: "Whether to request visual annotations (default false)" },
  },
}
