export function semanticEvaluatorStubUrls(rawUrl: string) {
  const evaluatorUrl = new URL(rawUrl)

  if (
    evaluatorUrl.protocol !== 'http:' ||
    evaluatorUrl.hostname !== '127.0.0.1' ||
    evaluatorUrl.port.length === 0 ||
    evaluatorUrl.pathname !== '/evaluate' ||
    evaluatorUrl.username.length > 0 ||
    evaluatorUrl.password.length > 0 ||
    evaluatorUrl.search.length > 0 ||
    evaluatorUrl.hash.length > 0
  ) {
    throw new Error(
      'Playwright evaluator stub must use http://127.0.0.1:<port>/evaluate'
    )
  }

  return {
    evaluatorUrl,
    healthUrl: new URL('/healthz', evaluatorUrl),
  }
}

export async function probeSemanticEvaluatorStub(
  rawUrl: string,
  probe: (url: URL) => Promise<{ ok: boolean }> = fetch
) {
  const urls = semanticEvaluatorStubUrls(rawUrl)

  try {
    return { ...urls, running: (await probe(urls.healthUrl)).ok }
  } catch {
    return { ...urls, running: false }
  }
}
