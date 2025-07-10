// function to compute the nth of a specific month in the future
export function getDatetimeValidationString(
  monthsInFuture: number,
  day: string
): string {
  // initialize function with the first day of the current month
  let date = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  // if the delta is chosen to be negative (date in the past), set a corresponding factor
  const factor = monthsInFuture < 0 ? -1 : 1

  for (let i = 0; i < Math.abs(monthsInFuture); i++) {
    date.setMonth(date.getMonth() + factor * 1)
  }

  return date
    .toLocaleString('ro-RO')
    .split(',')[0]
    .replace(/^\d{1,2}\./, `${day}.`)
}
