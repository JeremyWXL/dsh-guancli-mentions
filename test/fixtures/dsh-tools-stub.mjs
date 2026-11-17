/** Minimal dsh-tools stand-in for tests: defineTool passes options through. */
export function defineTool(options) {
  return {
    name: options.name,
    description: options.description,
    parameters: options.parameters ?? {},
    output: options.output,
    timeoutMs: options.timeoutMs,
    execute: options.execute,
  }
}
