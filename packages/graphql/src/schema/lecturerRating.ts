import builder from '../builder.js'
import type {
  LecturerRatingChoice as Choice,
  LecturerRatingCourse as Course,
  LecturerRatingItem as Item,
  LecturerRatingSession as Session,
} from '../services/lecturerRatings.js'

const LecturerRatingCourseRef = builder.objectRef<Course>(
  'LecturerRatingCourse'
)
export const LecturerRatingCourse = builder.objectType(
  LecturerRatingCourseRef,
  {
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
    }),
  }
)

const LecturerRatingChoiceRef = builder.objectRef<Choice>(
  'LecturerRatingChoice'
)
builder.objectType(LecturerRatingChoiceRef, {
  fields: (t) => ({
    text: t.exposeString('text'),
    correct: t.exposeBoolean('correct'),
  }),
})

const LecturerRatingItemRef = builder.objectRef<Item>('LecturerRatingItem')
export const LecturerRatingItem = builder.objectType(LecturerRatingItemRef, {
  fields: (t) => ({
    id: t.exposeString('id'),
    format: t.exposeString('format'),
    position: t.exposeInt('position'),
    elementVersion: t.exposeInt('elementVersion'),
    ratingVersion: t.exposeString('ratingVersion'),
    title: t.exposeString('title'),
    stem: t.exposeString('stem'),
    choices: t.expose('choices', { type: [LecturerRatingChoiceRef] }),
    difficulty: t.exposeInt('difficulty', { nullable: true }),
    bloom: t.exposeString('bloom', { nullable: true }),
    reviewed: t.exposeBoolean('reviewed'),
    unavailable: t.exposeBoolean('unavailable'),
  }),
})

const LecturerRatingSessionRef = builder.objectRef<Session>(
  'LecturerRatingSession'
)
export const LecturerRatingSession = builder.objectType(
  LecturerRatingSessionRef,
  {
    fields: (t) => ({
      id: t.exposeString('id'),
      courseId: t.exposeString('courseId'),
      items: t.expose('items', { type: [LecturerRatingItemRef] }),
    }),
  }
)
