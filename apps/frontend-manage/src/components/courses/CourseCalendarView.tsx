import {
  faCalendarDay,
  faCalendarDays,
  faCalendarWeek,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import {
  ActivityInfo,
  ActivityType,
  Course,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'

const COLORS = {
  courseStart: 'hsl(142 60% 40%)', // Stronger, darker green
  courseEnd: 'hsl(0 80% 40%)', // Stronger, darker red
  groupDeadline: 'hsl(0 80% 40%)', // Stronger, darker red
  liveQuiz: 'hsl(200 60% 80%)', // Milder blue
  practiceQuiz: 'hsl(210 40% 85%)', // Even milder blue
  microLearning: 'hsl(271 60% 85%)', // Milder purple
  groupActivity: 'hsl(30 70% 85%)', // Milder orange
}
const TEXT_COLORS = {
  courseStart: 'black',
  courseEnd: 'black',
  groupDeadline: 'black',
  liveQuiz: 'black',
  practiceQuiz: 'black',
  microLearning: 'black',
  groupActivity: 'black',
}

function getStartEndDuration(totalDurationHours: number): number {
  if (totalDurationHours <= 4) {
    // for activities <= 4 hours, use 1.5 hour slots to avoid overlap
    return 1.5
  }

  // for longer activities, use 2-3 hour slots
  return 2
}

function CourseCalendarView({
  course,
  setActivityList,
  switchToListView,
  setHighlightedActivity,
}: {
  course: Course
  setActivityList: Dispatch<SetStateAction<string>>
  switchToListView: () => void
  setHighlightedActivity: Dispatch<SetStateAction<string | null>>
}) {
  const t = useTranslations()
  const calendarRef = useRef<FullCalendar>(null)
  const [currentView, setCurrentView] = useState('timeGridWeek')
  const [currentTitle, setCurrentTitle] = useState('')

  // helper function to add events for activities with duration
  const addActivityEvents = useCallback(
    (
      activity: ActivityInfo,
      color: string,
      textColor: string,
      calendarEvents: any[]
    ) => {
      const scheduledStart = activity.scheduledStartAt
      const scheduledEnd = activity.scheduledEndAt
      const publicationDate = activity.automaticPublicationAt

      if (!scheduledStart && !scheduledEnd && !publicationDate) return

      // for scheduled practice quizzes and live quizzes, show the start date and an all-day event on the start date
      if (
        publicationDate &&
        (activity.type === ActivityType.PracticeQuiz ||
          activity.type === ActivityType.LiveQuiz)
      ) {
        const startDate = new Date(publicationDate)
        const isStartMidnight =
          startDate.getHours() === 0 &&
          startDate.getMinutes() === 0 &&
          startDate.getSeconds() === 0 &&
          startDate.getMilliseconds() === 0

        // if the start date is exactly at midnight, use the following day as the start
        const allDayStart = isStartMidnight
          ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
          : startDate

        calendarEvents.push({
          id: `${activity.id}__${activity.type}__available`,
          title: `(${t(`shared.short.${activity.type}`)}) ${activity.name}`,
          start: allDayStart.toISOString().split('T')[0],
          end: allDayStart.toISOString().split('T')[0],
          backgroundColor: color,
          borderColor: color,
          textColor,
        })

        // start event
        const startTime = startDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        calendarEvents.push({
          id: `${activity.id}__${activity.type}__start`,
          title: `${t('shared.generic.startNoun')} ${activity.name}: ${startTime}`,
          start: startDate.toISOString(),
          end: new Date(startDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          backgroundColor: color,
          borderColor: color,
          textColor,
        })
      }

      // if both start and end date are defined, add an all-day event
      // (= microlearnings and group activities)
      if (scheduledStart && scheduledEnd) {
        const startDate = new Date(scheduledStart)
        const endDate = new Date(scheduledEnd)
        const totalDurationHours =
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)

        // all-day event spanning the entire period (available period)
        // if the start date is exactly at midnight, use the following day as the start
        const isStartMidnight =
          startDate.getHours() === 0 &&
          startDate.getMinutes() === 0 &&
          startDate.getSeconds() === 0 &&
          startDate.getMilliseconds() === 0
        const allDayStart = isStartMidnight
          ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
          : startDate

        // determine if endDate is at midnight
        const isEndMidnight =
          endDate.getHours() === 0 &&
          endDate.getMinutes() === 0 &&
          endDate.getSeconds() === 0 &&
          endDate.getMilliseconds() === 0

        // always shift by timezone offset, add a day only if not midnight
        let adjustedEnd =
          endDate.getTime() - endDate.getTimezoneOffset() * 60000
        if (!isEndMidnight) {
          adjustedEnd += 24 * 60 * 60 * 1000
        }

        calendarEvents.push({
          id: `${activity.id}__${activity.type}__available`,
          title: `(${t(`shared.short.${activity.type}`)}) ${activity.name}`,
          start: allDayStart.toISOString().split('T')[0],
          end: new Date(adjustedEnd).toISOString().split('T')[0],
          backgroundColor: color,
          borderColor: color,
          textColor,
        })

        // start event
        const slotDuration = getStartEndDuration(totalDurationHours)
        const startEndTime = new Date(
          startDate.getTime() + slotDuration * 60 * 60 * 1000
        )
        const startTime = startDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        calendarEvents.push({
          id: `${activity.id}__${activity.type}__start`,
          title: `${t('shared.generic.startNoun')} ${activity.name}: ${startTime}`,
          start: startDate.toISOString(),
          end: startEndTime.toISOString(),
          backgroundColor: color,
          borderColor: color,
          textColor,
        })

        // end event
        const endStartTime = new Date(
          endDate.getTime() - slotDuration * 60 * 60 * 1000
        )
        const endTime = endDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        calendarEvents.push({
          id: `${activity.id}__${activity.type}__end`,
          title: `${t('shared.generic.end')} ${activity.name}: ${endTime}`,
          start: endStartTime.toISOString(),
          end: endDate.toISOString(),
          backgroundColor: color,
          borderColor: color,
          textColor,
        })
      }
    },
    [t]
  )

  // generate calendar events from course data
  const events = useMemo(() => {
    if (!course) return []

    const calendarEvents: any[] = []

    // course start date (green)
    if (course.startDate) {
      calendarEvents.push({
        id: 'course-start',
        title: t('manage.course.calendarCourseStart'),
        start: course.startDate,
        allDay: true,
        backgroundColor: COLORS.courseStart,
        borderColor: COLORS.courseStart,
        textColor: 'white',
        display: 'block',
      })
    }

    // course end date (red)
    if (course.endDate) {
      calendarEvents.push({
        id: 'course-end',
        title: t('manage.course.calendarCourseEnd'),
        start: course.endDate,
        allDay: true,
        backgroundColor: COLORS.courseEnd,
        borderColor: COLORS.courseEnd,
        textColor: 'white',
        display: 'block',
      })
    }

    // group formation deadline (red)
    if (course.groupDeadlineDate) {
      calendarEvents.push({
        id: 'group-deadline',
        title: t('manage.course.calendarCourseGroupFormationDeadline'),
        start: course.groupDeadlineDate,
        allDay: true,
        backgroundColor: COLORS.groupDeadline,
        borderColor: COLORS.groupDeadline,
        textColor: 'white',
        display: 'block',
      })
    }

    // live quizzes - color 1
    if (course.liveQuizzesInfo) {
      course.liveQuizzesInfo.forEach((quiz) => {
        addActivityEvents(
          quiz,
          COLORS.liveQuiz,
          TEXT_COLORS.liveQuiz,
          calendarEvents
        )
      })
    }

    // practice quizzes (only in calendar) - color 2
    if (course.practiceQuizzesInfo) {
      course.practiceQuizzesInfo.forEach((quiz) => {
        addActivityEvents(
          quiz,
          COLORS.practiceQuiz,
          TEXT_COLORS.practiceQuiz,
          calendarEvents
        )
      })
    }

    // microlearnings (all day and start & end entries) - color 3
    if (course.microLearningsInfo) {
      course.microLearningsInfo.forEach((microLearning) => {
        addActivityEvents(
          microLearning,
          COLORS.microLearning,
          TEXT_COLORS.microLearning,
          calendarEvents
        )
      })
    }

    // group activities (all day and start & end entries) - color 4
    if (course.groupActivitiesInfo) {
      course.groupActivitiesInfo.forEach((groupActivity) => {
        addActivityEvents(
          groupActivity,
          COLORS.groupActivity,
          TEXT_COLORS.groupActivity,
          calendarEvents
        )
      })
    }

    return calendarEvents
  }, [addActivityEvents, course, t])

  // handler functions for custom toolbar
  const handlePrev = () => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.prev()
      setCurrentTitle(calendarApi.view.title)
    }
  }

  const handleNext = () => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.next()
      setCurrentTitle(calendarApi.view.title)
    }
  }

  const handleToday = () => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.today()
      setCurrentTitle(calendarApi.view.title)
    }
  }

  const handleViewChange = (view: string) => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.changeView(view)
      setCurrentView(view)
      setCurrentTitle(calendarApi.view.title)
    }
  }

  return (
    <div className="pl-2">
      {/* custom toolbar */}
      <div className="mb-4 flex flex-row items-center justify-between gap-4">
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            onClick={handlePrev}
            className={{ root: 'h-8 w-8' }}
            data-cy="calendar-prev"
          >
            <Button.Icon withoutLabel icon={faChevronLeft} />
          </Button>
          <Button
            onClick={handleNext}
            className={{ root: 'mr-1 h-8 w-8' }}
            data-cy="calendar-next"
          >
            <Button.Icon withoutLabel icon={faChevronRight} />
          </Button>
          <Button
            onClick={handleToday}
            className={{ root: 'h-8' }}
            data-cy="calendar-today"
          >
            <Button.Label>Today</Button.Label>
          </Button>
        </div>

        <div className="flex flex-shrink-0 items-center justify-center">
          <h3 className="whitespace-nowrap text-lg font-semibold">
            {currentTitle}
          </h3>
        </div>

        <div className="flex flex-shrink-0 flex-row justify-end gap-0 overflow-hidden rounded-md border">
          <Button
            onClick={() => handleViewChange('dayGridMonth')}
            active={currentView === 'dayGridMonth'}
            className={{
              root: 'hover:bg-accent/50 h-8 rounded-none border-0 px-3',
            }}
            data={{ cy: 'calendar-month-view' }}
          >
            <Button.Icon icon={faCalendarDays} />
            <Button.Label>{t('shared.generic.month')}</Button.Label>
          </Button>
          <Button
            onClick={() => handleViewChange('timeGridWeek')}
            active={currentView === 'timeGridWeek'}
            className={{
              root: 'hover:bg-accent/50 h-8 rounded-none border-0 px-3',
            }}
            data={{ cy: 'calendar-week-view' }}
          >
            <Button.Icon icon={faCalendarWeek} />
            <Button.Label>{t('shared.generic.week')}</Button.Label>
          </Button>
          <Button
            onClick={() => handleViewChange('timeGridDay')}
            active={currentView === 'timeGridDay'}
            className={{
              root: 'hover:bg-accent/50 h-8 rounded-none border-0 px-3',
            }}
            data={{ cy: 'calendar-day-view' }}
          >
            <Button.Icon icon={faCalendarDay} />
            <Button.Label>{t('shared.generic.day')}</Button.Label>
          </Button>
        </div>
      </div>

      <div className="bg-background overflow-hidden rounded-lg border">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          events={events}
          height="auto"
          eventDisplay="block"
          dayMaxEvents={3}
          themeSystem="standard"
          // time grid
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="03:00:00"
          scrollTime="08:00:00"
          allDaySlot={true}
          nowIndicator={true}
          displayEventTime={currentView !== 'dayGridMonth'}
          allDayText=""
          firstDay={1} // week starts on Monday
          moreLinkText={(num) => `+${num} ${t('manage.course.calendarMore')}`}
          noEventsText={t('manage.course.calendarNoEntries')}
          eventDidMount={(info) => {
            // apply custom styling to events with non-transparent backgrounds
            info.el.classList.add(
              'rounded-md',
              'border',
              'hover:opacity-90',
              'transition-opacity',
              'cursor-pointer',
              'shadow-sm'
            )

            const bgColor = info.event.backgroundColor || 'hsl(0 0% 100%)'
            info.el.style.backgroundColor = bgColor
            info.el.style.opacity = '1'
            info.el.style.borderColor = info.event.borderColor || 'hsl(0 0% 0%)'

            // allow multi-line text rendering for time grid events
            if (info.view.type.includes('timeGrid')) {
              info.el.style.fontSize = '12px'
              info.el.style.padding = '2px 6px'
              info.el.style.overflow = 'hidden'
              info.el.style.whiteSpace = 'normal'
              info.el.style.fontWeight = '500'
              info.el.style.lineHeight = '1.2'
              info.el.style.backgroundColor = bgColor
              info.el.style.opacity = '1'
            }
          }}
          eventClick={(info) => {
            const activityId = info.event._def.publicId.split('__')[0]
            const activityType = info.event._def.publicId.split('__')[1]
            switchToListView()
            setHighlightedActivity(activityId)

            if (activityType === ActivityType.LiveQuiz) {
              setActivityList('liveQuizzes')
            } else if (activityType === ActivityType.PracticeQuiz) {
              setActivityList('practiceQuizzes')
            } else if (activityType === ActivityType.MicroLearning) {
              setActivityList('microLearnings')
            } else if (activityType === ActivityType.GroupActivity) {
              setActivityList('groupActivities')
            }
          }}
          datesSet={(info) => {
            // Update title when dates change (navigation)
            setCurrentTitle(info.view.title)
          }}
          dayHeaderClassNames="text-muted-foreground font-medium text-sm"
          dayCellClassNames="hover:bg-accent/50 transition-colors"
        />
      </div>
    </div>
  )
}

export default CourseCalendarView
