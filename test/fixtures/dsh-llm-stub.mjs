/** Minimal dsh-llm stand-in: createUserMessage stamps an id and freezes nothing. */
let sequence = 0
export function createUserMessage(input) {
  sequence += 1
  return { ...input, id: `test-user-message-${String(sequence)}` }
}
