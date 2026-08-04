type RatingRequest<T> = {
  applyRating: (rating: T) => void
  key: string
  onError: (error: unknown) => void
  rating: T
  readRating: () => T
  send: () => Promise<void>
}

export function createRatingRequestCoordinator<T>() {
  const requests = new Map<
    string,
    {
      confirmedRating: T
      tail: Promise<void>
    }
  >()

  return async function runRatingRequest({
    applyRating,
    key,
    onError,
    rating,
    readRating,
    send,
  }: RatingRequest<T>) {
    let state = requests.get(key)
    if (!state) {
      state = {
        confirmedRating: readRating(),
        tail: Promise.resolve(),
      }
      requests.set(key, state)
    }

    applyRating(rating)

    const request = state.tail
      .catch(() => undefined)
      .then(async () => {
        await send()
        state.confirmedRating = rating
      })
    state.tail = request

    try {
      await request
    } catch (error) {
      onError(error)
      if (state.tail === request) {
        applyRating(state.confirmedRating)
      }
    } finally {
      if (state.tail === request && requests.get(key) === state) {
        requests.delete(key)
      }
    }
  }
}
