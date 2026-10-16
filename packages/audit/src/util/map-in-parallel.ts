/** Maps values with at most `concurrency` callbacks in flight, keeping order. */
export async function mapInParallel<T, R>(
  values: readonly T[],
  concurrency: number,
  callback: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (next < values.length) {
        const index = next
        next += 1
        results[index] = await callback(values[index]!)
      }
    }
  )
  await Promise.all(workers)
  return results
}
