export function normalizeLearningAnalyticsChoice<T extends string>(
  value: T | '' | null | undefined
): T | undefined {
  return value === '' || value == null ? undefined : value
}
