export const MultiEditTool = {
  id: "multiedit",
  description: "Make multiple edits to a file in a single operation.",
  parameters: {
    filePath: { type: "string", description: "The absolute path to the file to modify" },
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          oldString: { type: "string", description: "The text to replace" },
          newString: { type: "string", description: "The text to replace it with" },
          replaceAll: { type: "boolean", description: "Replace all occurrences (default false)" },
        },
      },
      description: "Array of edit operations to perform sequentially",
    },
  },
}
