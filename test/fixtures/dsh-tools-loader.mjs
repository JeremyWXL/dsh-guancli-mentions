/** Resolve host-only packages to local stubs inside the test process. */
const STUBS = {
  '@deepseek-ai/dsh-tools': './dsh-tools-stub.mjs',
  '@deepseek-ai/dsh-llm': './dsh-llm-stub.mjs',
}

export async function resolve(specifier, context, next) {
  const stub = STUBS[specifier]
  if (stub !== undefined) {
    return { url: new URL(stub, import.meta.url).href, shortCircuit: true }
  }
  return next(specifier, context)
}
