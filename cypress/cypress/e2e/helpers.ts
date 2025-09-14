// function to compute the nth of a specific month in the future (as date)
export function getFutureDate(monthsInFuture: number, day: string): Date {
  // initialize function with the first day of the current month
  let date = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  // if the delta is chosen to be negative (date in the past), set a corresponding factor
  const factor = monthsInFuture < 0 ? -1 : 1

  for (let i = 1; i <= Math.abs(monthsInFuture); i++) {
    date.setMonth(date.getMonth() + factor * 1)
  }

  // set the day of the month
  date.setDate(parseInt(day, 10))

  return date
}

// function to compute the nth of a specific month in the future (as datestring)
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
