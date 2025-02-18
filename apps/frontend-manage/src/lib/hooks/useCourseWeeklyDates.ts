import { useMemo } from 'react'

function useCourseWeeklyDates({
  courseStart,
  courseEnd,
}: {
  courseStart: string
  courseEnd: string
}) {
  return useMemo(() => {
    const courseStartDate = new Date(courseStart)
    const courseEndDate = new Date(courseEnd)
    const today = new Date()
    const endBoundary = courseEndDate < today ? courseEndDate : today

    const weeklyDates: string[] = []
    let currentMonday = new Date(courseStartDate)
    currentMonday.setDate(
      currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7)
    )

    const formatDate = (date: Date): string => {
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}.${month}.${year}`
    }

    while (currentMonday <= endBoundary) {
      weeklyDates.push(formatDate(new Date(currentMonday)))
      currentMonday.setDate(currentMonday.getDate() + 7)
    }
    return weeklyDates
  }, [courseStart, courseEnd])
}

export default useCourseWeeklyDates
