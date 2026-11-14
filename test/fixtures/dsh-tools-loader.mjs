/** Resolve '@deepseek-ai/dsh-tools' to the local stub inside the test process. */
export async function resolve(specifier, context, next) {
  if (specifier === '@deepseek-ai/dsh-tools') {
    return { url: new URL('./dsh-tools-stub.mjs', import.meta.url).href, shortCircuit: true }
  }
  return next(specifier, context)
}
