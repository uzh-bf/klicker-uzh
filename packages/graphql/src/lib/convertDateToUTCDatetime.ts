function convertDateToUTCDatetime(
  dateString?: string | null
): Date | undefined {
  if (!dateString) return undefined

  const [day, month, year] = dateString.split('.').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day))
}

export default convertDateToUTCDatetime
