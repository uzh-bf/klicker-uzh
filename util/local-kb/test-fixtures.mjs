export function providerPorts(base = 19000) {
  return {
    klicker: { backend: base, model: base + 1, blob: base + 2 },
    ingestion: {
      api: base + 3,
      dispatcher: base + 4,
      hatchetHttp: base + 5,
      hatchetGrpc: base + 6,
      postgres: base + 7,
      azurite: base + 8,
      milvus: base + 9,
      milvusHealth: base + 10,
      milvusAttu: base + 11,
    },
    docProcessing: {
      api: base + 12,
      postgres: base + 13,
      hatchetHttp: base + 14,
      hatchetGrpc: base + 15,
    },
    scraping: { api: base + 16, crawl4ai: base + 17, postgres: base + 18 },
    retrieval: { api: base + 19 },
  }
}

export const providerImages = {
  api: `example.invalid/api@sha256:${'a'.repeat(64)}`,
  worker: `example.invalid/worker@sha256:${'b'.repeat(64)}`,
}
