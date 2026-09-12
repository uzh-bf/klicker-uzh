export function retentionBatchFor(anchor: Date): Date {
  if (Number.isNaN(anchor.getTime())) {
    throw new TypeError('retention anchor must be a valid date')
  }

  const targetYear = anchor.getUTCFullYear() + 1
  const targetMonth = anchor.getUTCMonth()
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate()
  const threshold = new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(anchor.getUTCDate(), lastDayOfTargetMonth),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds()
    )
  )

  for (
    let year = threshold.getUTCFullYear();
    year <= threshold.getUTCFullYear() + 1;
    year++
  ) {
    for (const month of [2, 9]) {
      const batch = new Date(Date.UTC(year, month, 1))
      if (batch.getTime() >= threshold.getTime()) {
        return batch
      }
    }
  }

  throw new Error('Could not derive assessment evidence retention batch')
}
