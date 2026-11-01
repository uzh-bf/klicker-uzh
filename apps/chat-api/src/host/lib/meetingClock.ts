// The meeting clock of a custom mode, shared by the server line the model
// receives and the indicator participants see, so both always show the same
// minute and time of day.

// The platform's display time zone; neither courses nor lecturers carry one.
export const MEETING_CLOCK_TIME_ZONE = 'Europe/Zurich'

const TIME_OF_DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: MEETING_CLOCK_TIME_ZONE,
})

/** Whole minutes since `startedAt`, rounded down; never negative. */
export function elapsedMeetingMinutes(startedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000))
}

/** `HH:MM` in the meeting clock's time zone. */
export function meetingTimeOfDay(now: Date): string {
  return TIME_OF_DAY_FORMAT.format(now)
}

/**
 * What a participant sees for a clock that started at `startedAt` on the
 * server: `skewMs` is the server clock's offset from this browser's clock, so
 * the reading matches the line the model receives for a turn sent now.
 */
export function readMeetingClock(
  startedAt: Date,
  skewMs: number,
  clientNow: Date
): { elapsedMinutes: number; timeOfDay: string } {
  const serverNow = new Date(clientNow.getTime() + skewMs)
  return {
    elapsedMinutes: elapsedMeetingMinutes(startedAt, serverNow),
    timeOfDay: meetingTimeOfDay(serverNow),
  }
}
