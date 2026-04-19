import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityFeedback as ActivityFeedbackType,
  ActivityPerformance as ActivityPerformanceType,
  ActivityQuizAnalytics as ActivityQuizAnalyticsType,
  ActivityType as ActivityTypeEnum,
  InstanceFeedback as InstanceFeedbackType,
  InstancePerformance as InstancePerformanceType,
  InstanceQuizAnalytics as InstanceQuizAnalyticsType,
  ParticipantActivityPerformance as ParticipantActivityPerformanceType,
  ParticipantActivityPerformances as ParticipantActivityPerformancesType,
  ParticipantPerformance as ParticipantPerformanceType,
  PerformanceRates as PerformanceRatesType,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { ElementType } from './elementData.js'
import { ResponseCorrectness } from './evaluation.js'

export const ActivityLevel = builder.enumType('ActivityLevel', {
  values: Object.values(DB.ActivityLevel),
})

export const ActivityType = builder.enumType('ActivityType', {
  values: Object.values(ActivityTypeEnum),
})

export const PerformanceLevel = builder.enumType('PerformanceLevel', {
  values: Object.values(DB.PerformanceLevel),
})

export const AnalyticsType = builder.enumType('AnalyticsType', {
  values: Object.values(DB.AnalyticsType),
})

// Participant-scoped analytics row, exposed to the owning participant only
// via `asParticipant`-gated queries. Field allowlist is explicit; internal
// join fields (participantId, courseId, competencyAnalytics) are NOT exposed.
export const ParticipantAnalyticsRef =
  builder.objectRef<DB.ParticipantAnalytics>('ParticipantAnalytics')
export const ParticipantAnalytics = builder.objectType(
  ParticipantAnalyticsRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      type: t.expose('type', { type: AnalyticsType }),
      timestamp: t.expose('timestamp', { type: 'Date' }),
      computedAt: t.expose('computedAt', { type: 'Date' }),
      trialsCount: t.exposeInt('trialsCount'),
      responseCount: t.exposeInt('responseCount'),
      totalScore: t.exposeInt('totalScore'),
      totalPoints: t.exposeInt('totalPoints'),
      totalXp: t.exposeInt('totalXp'),
      meanCorrectCount: t.exposeFloat('meanCorrectCount'),
      meanPartialCorrectCount: t.exposeFloat('meanPartialCorrectCount'),
      meanWrongCount: t.exposeFloat('meanWrongCount'),
      firstCorrectCount: t.exposeFloat('firstCorrectCount', { nullable: true }),
      lastCorrectCount: t.exposeFloat('lastCorrectCount', { nullable: true }),
    }),
  }
)

// Condensed response-history row for the authenticated participant.
// Powers "recent mistakes" / "what did I answer" UIs.
interface IMyResponse {
  instanceId: number
  elementId: number
  elementType: DB.ElementType
  elementName: string
  firstResponseCorrectness: DB.ResponseCorrectness
  lastResponseCorrectness: DB.ResponseCorrectness
  trialsCount: number
  averageTimeSpent: number
  lastAnsweredAt: Date | null
}
export const MyResponseRef = builder.objectRef<IMyResponse>('MyResponse')
export const MyResponse = builder.objectType(MyResponseRef, {
  fields: (t) => ({
    instanceId: t.exposeInt('instanceId'),
    elementId: t.exposeInt('elementId'),
    elementType: t.expose('elementType', { type: ElementType }),
    elementName: t.exposeString('elementName'),
    firstResponseCorrectness: t.expose('firstResponseCorrectness', {
      type: ResponseCorrectness,
    }),
    lastResponseCorrectness: t.expose('lastResponseCorrectness', {
      type: ResponseCorrectness,
    }),
    trialsCount: t.exposeInt('trialsCount'),
    averageTimeSpent: t.exposeFloat('averageTimeSpent'),
    lastAnsweredAt: t.expose('lastAnsweredAt', {
      type: 'Date',
      nullable: true,
    }),
  }),
})

interface IMyResponseHistoryPage {
  total: number
  items: IMyResponse[]
}
export const MyResponseHistoryPageRef =
  builder.objectRef<IMyResponseHistoryPage>('MyResponseHistoryPage')
export const MyResponseHistoryPage = builder.objectType(
  MyResponseHistoryPageRef,
  {
    fields: (t) => ({
      total: t.exposeInt('total'),
      items: t.expose('items', { type: [MyResponse] }),
    }),
  }
)

// SM-2-derived spaced-repetition scheduling for the participant's responses
// in a given practice quiz. Drives "when should I study next" UIs.
interface IMySRSEntry {
  instanceId: number
  elementId: number
  eFactor: number
  interval: number
  nextDueAt: Date | null
  correctCountStreak: number
  lastResponseCorrectness: DB.ResponseCorrectness
}
export const MySRSEntryRef = builder.objectRef<IMySRSEntry>('MySRSEntry')
export const MySRSEntry = builder.objectType(MySRSEntryRef, {
  fields: (t) => ({
    instanceId: t.exposeInt('instanceId'),
    elementId: t.exposeInt('elementId'),
    eFactor: t.exposeFloat('eFactor'),
    interval: t.exposeInt('interval'),
    nextDueAt: t.expose('nextDueAt', { type: 'Date', nullable: true }),
    correctCountStreak: t.exposeInt('correctCountStreak'),
    lastResponseCorrectness: t.expose('lastResponseCorrectness', {
      type: ResponseCorrectness,
    }),
  }),
})

// --- Category C: per-tag accuracy + activity feed aggregation --------------

// Per-tag accuracy for the authenticated participant. Drives "weak topics"
// and "mastery map" UIs. Aggregated from QuestionResponse via Element.tags;
// no new table, no new pipeline.
interface IParticipantTopicAccuracy {
  tagId: number
  tagName: string
  totalCount: number
  correctCount: number
  partialCount: number
  wrongCount: number
  lastAnsweredAt: Date | null
}
export const ParticipantTopicAccuracyRef =
  builder.objectRef<IParticipantTopicAccuracy>('ParticipantTopicAccuracy')
export const ParticipantTopicAccuracy = builder.objectType(
  ParticipantTopicAccuracyRef,
  {
    fields: (t) => ({
      tagId: t.exposeInt('tagId'),
      tagName: t.exposeString('tagName'),
      totalCount: t.exposeInt('totalCount'),
      correctCount: t.exposeInt('correctCount'),
      partialCount: t.exposeInt('partialCount'),
      wrongCount: t.exposeInt('wrongCount'),
      lastAnsweredAt: t.expose('lastAnsweredAt', {
        type: 'Date',
        nullable: true,
      }),
    }),
  }
)

// Condensed recent-activity feed for the authenticated participant.
// A chronological merge of achievement unlocks + response detail rows.
export const MyActivityKind = builder.enumType('MyActivityKind', {
  values: ['RESPONSE', 'ACHIEVEMENT'] as const,
})

interface IMyActivityEntry {
  type: 'RESPONSE' | 'ACHIEVEMENT'
  timestamp: Date
  summary: string
  targetId: string
}
export const MyActivityEntryRef =
  builder.objectRef<IMyActivityEntry>('MyActivityEntry')
export const MyActivityEntry = builder.objectType(MyActivityEntryRef, {
  fields: (t) => ({
    type: t.expose('type', { type: MyActivityKind }),
    timestamp: t.expose('timestamp', { type: 'Date' }),
    summary: t.exposeString('summary'),
    targetId: t.exposeString('targetId'),
  }),
})

// Condensed bookmarked-stack row for the cross-course listing. Avoids
// including the full element tree so the response stays compact — callers
// that need elements should hit `getBookmarkedElementStacks(courseId)`.
interface IBookmarkedStackSummary {
  id: number
  displayName: string | null
  description: string | null
  order: number
}
interface IBookmarkedStacksByCourse {
  courseId: string
  courseName: string
  stacks: IBookmarkedStackSummary[]
}
export const BookmarkedStackSummaryRef =
  builder.objectRef<IBookmarkedStackSummary>('BookmarkedStackSummary')
export const BookmarkedStackSummary = builder.objectType(
  BookmarkedStackSummaryRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      displayName: t.exposeString('displayName', { nullable: true }),
      description: t.exposeString('description', { nullable: true }),
      order: t.exposeInt('order'),
    }),
  }
)
export const BookmarkedStacksByCourseRef =
  builder.objectRef<IBookmarkedStacksByCourse>('BookmarkedStacksByCourse')
export const BookmarkedStacksByCourse = builder.objectType(
  BookmarkedStacksByCourseRef,
  {
    fields: (t) => ({
      courseId: t.exposeString('courseId'),
      courseName: t.exposeString('courseName'),
      stacks: t.expose('stacks', { type: [BookmarkedStackSummary] }),
    }),
  }
)

// ------ Activity Analytics ------
// #region
export const ElementFeedbackRef =
  builder.objectRef<DB.ElementFeedback>('ElementFeedback')
export const ElementFeedback = builder.objectType(ElementFeedbackRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),
    upvote: t.exposeBoolean('upvote'),
    downvote: t.exposeBoolean('downvote'),
    feedback: t.exposeString('feedback', { nullable: true }),
    elementInstanceId: t.exposeInt('elementInstanceId'),
  }),
})

interface IParticipantActivityTimestamp {
  date: Date
  activeParticipants: number
}
export const ParticipantActivityTimestampRef =
  builder.objectRef<IParticipantActivityTimestamp>(
    'ParticipantActivityTimestamp'
  )
export const ParticipantActivityTimestamp = builder.objectType(
  ParticipantActivityTimestampRef,
  {
    fields: (t) => ({
      date: t.expose('date', { type: 'Date' }),
      activeParticipants: t.exposeInt('activeParticipants'),
    }),
  }
)

interface IWeekdayActivityAnalytics {
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  sunday: number
}
export const WeekdayActivityAnalyticsRef =
  builder.objectRef<IWeekdayActivityAnalytics>('WeekdayActivityAnalytics')
export const WeekdayActivityAnalytics = builder.objectType(
  WeekdayActivityAnalyticsRef,
  {
    fields: (t) => ({
      monday: t.exposeFloat('monday'),
      tuesday: t.exposeFloat('tuesday'),
      wednesday: t.exposeFloat('wednesday'),
      thursday: t.exposeFloat('thursday'),
      friday: t.exposeFloat('friday'),
      saturday: t.exposeFloat('saturday'),
      sunday: t.exposeFloat('sunday'),
    }),
  }
)

interface IParticipantCourseActivity {
  activeWeeks: number
  activeDaysPerWeek: number
  meanElementsPerDay: number
  activityLevel: DB.ActivityLevel
}

export const ParticipantCourseActivityRef =
  builder.objectRef<IParticipantCourseActivity>('ParticipantCourseActivity')
export const ParticipantCourseActivity = builder.objectType(
  ParticipantCourseActivityRef,
  {
    fields: (t) => ({
      activeWeeks: t.exposeInt('activeWeeks'),
      activeDaysPerWeek: t.exposeFloat('activeDaysPerWeek'),
      meanElementsPerDay: t.exposeFloat('meanElementsPerDay'),
      activityLevel: t.expose('activityLevel', { type: ActivityLevel }),
    }),
  }
)

interface ICourseActivityAnalytics {
  name: string
  courseWeeks: number
  totalParticipants: number
  dailyActivity: IParticipantActivityTimestamp[]
  weeklyActivity: IParticipantActivityTimestamp[]
  activeDays: IWeekdayActivityAnalytics
  participantCourseAnalytics: IParticipantCourseActivity[]
}
export const CourseActivityAnalyticsRef =
  builder.objectRef<ICourseActivityAnalytics>('CourseActivityAnalytics')
export const CourseActivityAnalytics = builder.objectType(
  CourseActivityAnalyticsRef,
  {
    fields: (t) => ({
      name: t.exposeString('name'),
      courseWeeks: t.exposeInt('courseWeeks'),
      totalParticipants: t.exposeInt('totalParticipants'),
      dailyActivity: t.expose('dailyActivity', {
        type: [ParticipantActivityTimestamp],
      }),
      weeklyActivity: t.expose('weeklyActivity', {
        type: [ParticipantActivityTimestamp],
      }),
      activeDays: t.expose('activeDays', { type: WeekdayActivityAnalytics }),
      participantCourseAnalytics: t.expose('participantCourseAnalytics', {
        type: [ParticipantCourseActivity],
      }),
    }),
  }
)

interface IWeeklyCourseActivities {
  totalParticipants: number
  weeklyActivity: IParticipantActivityTimestamp[]
}
export const WeeklyCourseActivitiesRef =
  builder.objectRef<IWeeklyCourseActivities>('WeeklyCourseActivities')
export const WeeklyCourseActivities = builder.objectType(
  WeeklyCourseActivitiesRef,
  {
    fields: (t) => ({
      totalParticipants: t.exposeInt('totalParticipants'),
      weeklyActivity: t.expose('weeklyActivity', {
        type: [ParticipantActivityTimestamp],
      }),
    }),
  }
)
// #endregion

// ------ Performance & Progress Analytics ------
// #region
interface IActivityProgress {
  activityName: string
  activityType: ActivityTypeEnum
  startedCount: number
  completedCount: number
  repeatedCount?: number | null
}
export const ActivityProgressRef =
  builder.objectRef<IActivityProgress>('ActivityProgress')
export const ActivityProgress = builder.objectType(ActivityProgressRef, {
  fields: (t) => ({
    activityName: t.exposeString('activityName'),
    activityType: t.expose('activityType', { type: ActivityType }),
    startedCount: t.exposeInt('startedCount'),
    completedCount: t.exposeInt('completedCount'),
    repeatedCount: t.exposeInt('repeatedCount', { nullable: true }),
  }),
})

export const PerformanceRatesRef =
  builder.objectRef<PerformanceRatesType>('PerformanceRates')
export const PerformanceRates = builder.objectType(PerformanceRatesRef, {
  fields: (t) => ({
    firstErrorRate: t.exposeFloat('firstErrorRate'),
    lastErrorRate: t.exposeFloat('lastErrorRate'),
    errorRate: t.exposeFloat('errorRate'),
    firstPartialRate: t.exposeFloat('firstPartialRate'),
    lastPartialRate: t.exposeFloat('lastPartialRate'),
    partialRate: t.exposeFloat('partialRate'),
    firstCorrectRate: t.exposeFloat('firstCorrectRate'),
    lastCorrectRate: t.exposeFloat('lastCorrectRate'),
    correctRate: t.exposeFloat('correctRate'),
  }),
})

export const ActivityPerformanceRef =
  builder.objectRef<ActivityPerformanceType>('ActivityPerformance')
export const ActivityPerformance = builder.objectType(ActivityPerformanceRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),
    activityName: t.exposeString('activityName'),
    activityType: t.expose('activityType', { type: ActivityType }),
    rates: t.expose('rates', { type: PerformanceRates }),
  }),
})

export const InstancePerformanceRef =
  builder.objectRef<InstancePerformanceType>('InstancePerformance')
export const InstancePerformance = builder.objectType(InstancePerformanceRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),
    elementName: t.exposeString('elementName'),
    elementType: t.expose('elementType', { type: ElementType }),
    rates: t.expose('rates', { type: PerformanceRates }),
  }),
})

export const ParticipantPerformanceRef =
  builder.objectRef<ParticipantPerformanceType>('ParticipantPerformance')
export const ParticipantPerformance = builder.objectType(
  ParticipantPerformanceRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      firstErrorRate: t.exposeFloat('firstErrorRate'),
      firstPerformance: t.expose('firstPerformance', {
        type: PerformanceLevel,
      }),
      lastErrorRate: t.exposeFloat('lastErrorRate'),
      lastPerformance: t.expose('lastPerformance', { type: PerformanceLevel }),
      totalErrorRate: t.exposeFloat('totalErrorRate'),
      totalPerformance: t.expose('totalPerformance', {
        type: PerformanceLevel,
      }),
    }),
  }
)

export const ParticipantActivityPerformanceRef =
  builder.objectRef<ParticipantActivityPerformanceType>(
    'ParticipantActivityPerformance'
  )
export const ParticipantActivityPerformance = builder.objectType(
  ParticipantActivityPerformanceRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      activityId: t.exposeString('activityId'),
      totalScore: t.exposeInt('totalScore'),
      completion: t.exposeFloat('completion'),
    }),
  }
)

export const ParticipantActivityPerformancesRef =
  builder.objectRef<ParticipantActivityPerformancesType>(
    'ParticipantActivityPerformances'
  )
export const ParticipantActivityPerformances = builder.objectType(
  ParticipantActivityPerformancesRef,
  {
    fields: (t) => ({
      participantId: t.exposeString('participantId'),
      participantUsername: t.exposeString('participantUsername'),
      participantEmail: t.exposeString('participantEmail', { nullable: true }),
      performances: t.expose('activityPerformances', {
        type: [ParticipantActivityPerformance],
      }),
    }),
  }
)

export const InstanceFeedbackRef =
  builder.objectRef<InstanceFeedbackType>('InstanceFeedback')
export const InstanceFeedback = builder.objectType(InstanceFeedbackRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),
    activityType: t.expose('activityType', { type: ActivityType }),
    instanceName: t.exposeString('instanceName'),
    instanceType: t.expose('instanceType', { type: ElementType }),
    upvoteRate: t.exposeFloat('upvoteRate'),
    downvoteRate: t.exposeFloat('downvoteRate'),
    feedbackCount: t.exposeInt('feedbackCount'),
  }),
})

export const ActivityFeedbackRef =
  builder.objectRef<ActivityFeedbackType>('ActivityFeedback')
export const ActivityFeedback = builder.objectType(ActivityFeedbackRef, {
  fields: (t) => ({
    id: t.exposeString('id'),
    activityType: t.expose('activityType', { type: ActivityType }),
    activityName: t.exposeString('activityName'),
    upvoteRate: t.exposeFloat('upvoteRate'),
    downvoteRate: t.exposeFloat('downvoteRate'),
    feedbackCount: t.exposeInt('feedbackCount'),
  }),
})

interface ICoursePerformanceAnalytics {
  name: string
  totalParticipants: number
  activityProgresses: IActivityProgress[]
  activityPerformances: ActivityPerformanceType[]
  instancePerformances: InstancePerformanceType[]
  participantPerformances: ParticipantPerformanceType[]
  participantActivityPerformances: ParticipantActivityPerformancesType[]
  instanceFeedbacks: InstanceFeedbackType[]
  activityFeedbacks: ActivityFeedbackType[]
}
export const CoursePerformanceAnalyticsRef =
  builder.objectRef<ICoursePerformanceAnalytics>('CoursePerformanceAnalytics')
export const CoursePerformanceAnalytics = builder.objectType(
  CoursePerformanceAnalyticsRef,
  {
    fields: (t) => ({
      name: t.exposeString('name'),
      totalParticipants: t.exposeInt('totalParticipants'),
      activityProgresses: t.expose('activityProgresses', {
        type: [ActivityProgress],
      }),
      activityPerformances: t.expose('activityPerformances', {
        type: [ActivityPerformance],
      }),
      instancePerformances: t.expose('instancePerformances', {
        type: [InstancePerformance],
      }),
      participantPerformances: t.expose('participantPerformances', {
        type: [ParticipantPerformance],
      }),
      participantActivityPerformances: t.expose(
        'participantActivityPerformances',
        {
          type: [ParticipantActivityPerformances],
        }
      ),
      instanceFeedbacks: t.expose('instanceFeedbacks', {
        type: [InstanceFeedback],
      }),
      activityFeedbacks: t.expose('activityFeedbacks', {
        type: [ActivityFeedback],
      }),
    }),
  }
)
// #endregion

// ------ Quiz Analytics ------
// #region
export const InstanceQuizAnalyticsRef =
  builder.objectRef<InstanceQuizAnalyticsType>('InstanceQuizAnalytics')
export const InstanceQuizAnalytics = builder.objectType(
  InstanceQuizAnalyticsRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      elementName: t.exposeString('elementName'),
      elementType: t.expose('elementType', { type: ElementType }),
      numberOfAnswers: t.exposeInt('numberOfAnswers'),
      uniqueParticipants: t.exposeInt('uniqueParticipants'),
      averageTimeSpent: t.exposeFloat('averageTimeSpent'),
      firstErrorRate: t.exposeFloat('firstErrorRate', { nullable: true }),
      firstPartialRate: t.exposeFloat('firstPartialRate', { nullable: true }),
      firstCorrectRate: t.exposeFloat('firstCorrectRate', { nullable: true }),
      lastErrorRate: t.exposeFloat('lastErrorRate', { nullable: true }),
      lastPartialRate: t.exposeFloat('lastPartialRate', { nullable: true }),
      lastCorrectRate: t.exposeFloat('lastCorrectRate', { nullable: true }),
      totalErrorRate: t.exposeFloat('totalErrorRate'),
      totalPartialRate: t.exposeFloat('totalPartialRate'),
      totalCorrectRate: t.exposeFloat('totalCorrectRate'),
      upvoteRate: t.exposeFloat('upvoteRate'),
      downvoteRate: t.exposeFloat('downvoteRate'),
      feedbackCount: t.exposeInt('feedbackCount'),
    }),
  }
)

export const ActivityQuizAnalyticsRef =
  builder.objectRef<ActivityQuizAnalyticsType>('ActivityQuizAnalytics')
export const ActivityQuizAnalytics = builder.objectType(
  ActivityQuizAnalyticsRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      averageTimeSpent: t.exposeFloat('averageTimeSpent'),
      numberOfAnswers: t.exposeInt('numberOfAnswers'),
      firstErrorRate: t.exposeFloat('firstErrorRate', { nullable: true }),
      firstPartialRate: t.exposeFloat('firstPartialRate', { nullable: true }),
      firstCorrectRate: t.exposeFloat('firstCorrectRate', { nullable: true }),
      lastErrorRate: t.exposeFloat('lastErrorRate', { nullable: true }),
      lastPartialRate: t.exposeFloat('lastPartialRate', { nullable: true }),
      lastCorrectRate: t.exposeFloat('lastCorrectRate', { nullable: true }),
      totalErrorRate: t.exposeFloat('totalErrorRate'),
      totalPartialRate: t.exposeFloat('totalPartialRate'),
      totalCorrectRate: t.exposeFloat('totalCorrectRate'),
    }),
  }
)

interface IQuizAnalytics {
  activityName: string
  activityType: ActivityTypeEnum
  courseParticipants: number
  activityQuizAnalytics?: ActivityQuizAnalyticsType | null
  instanceQuizAnalytics: InstanceQuizAnalyticsType[]
}
export const QuizAnalyticsRef =
  builder.objectRef<IQuizAnalytics>('QuizAnalytics')
export const QuizAnalytics = builder.objectType(QuizAnalyticsRef, {
  fields: (t) => ({
    activityName: t.exposeString('activityName'),
    activityType: t.expose('activityType', { type: ActivityType }),
    courseParticipants: t.exposeInt('courseParticipants'),
    activityQuizAnalytics: t.expose('activityQuizAnalytics', {
      type: ActivityQuizAnalytics,
      nullable: true,
    }),
    instanceQuizAnalytics: t.expose('instanceQuizAnalytics', {
      type: [InstanceQuizAnalytics],
    }),
  }),
})
// #endregion
