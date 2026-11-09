import { InMemoryCache } from '@apollo/client'

// Generated draft answer choices carry their per-question label ("A" to "E")
// as their id, so the same id repeats across the drafts of one build and
// between a draft's original and current views. Apollo's default identity by
// `id` merges those choices into one cache entity, and a reviewer keeping the
// second draft then submits the first draft's answer options. The choice id is
// a per-draft identity only, so it must not normalize the cache.
export function createManageApolloCache() {
  return new InMemoryCache({
    typePolicies: {
      GeneratedElementChoice: { keyFields: false },
    },
  })
}
