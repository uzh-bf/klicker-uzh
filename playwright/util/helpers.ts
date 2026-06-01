export function getFutureDate(monthsInFuture: number, day: string): Date {
  const date = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const factor = monthsInFuture < 0 ? -1 : 1

  for (let i = 1; i <= Math.abs(monthsInFuture); i++) {
    date.setMonth(date.getMonth() + factor)
  }

  date.setDate(parseInt(day, 10))
  return date
}

export function getDatetimeValidationString(
  monthsInFuture: number,
  day: string
): string {
  const date = getFutureDate(monthsInFuture, day)
  return date
    .toLocaleString('ro-RO')
    .split(',')[0]
    .replace(/^\d{1,2}\./, `${day}.`)
}
