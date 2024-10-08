import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'

export interface IAchievement extends DB.Achievement {}

export const AchievementRef = builder.objectRef<IAchievement>('Achievement')
export const Achievement = builder.objectType(AchievementRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),

    nameDE: t.exposeString('nameDE', { nullable: true }),
    nameEN: t.exposeString('nameEN', { nullable: true }),
    descriptionDE: t.exposeString('descriptionDE', { nullable: true }),
    descriptionEN: t.exposeString('descriptionEN', { nullable: true }),
    icon: t.exposeString('icon'),
    iconColor: t.exposeString('iconColor', { nullable: true }),
  }),
})

export interface IParticipantAchievementInstance
  extends DB.ParticipantAchievementInstance {
  achievement: IAchievement
}

export const ParticipantAchievementInstanceRef =
  builder.objectRef<IParticipantAchievementInstance>(
    'ParticipantAchievementInstance'
  )
export const ParticipantAchievementInstance = builder.objectType(
  ParticipantAchievementInstanceRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),

      achievedAt: t.expose('achievedAt', { type: 'Date' }),
      achievedCount: t.exposeInt('achievedCount'),

      achievement: t.expose('achievement', {
        type: AchievementRef,
        nullable: false,
      }),
    }),
  }
)

export interface IGroupAchievementInstance
  extends DB.GroupAchievementInstance {}

export const GroupAchievementInstanceRef =
  builder.objectRef<IGroupAchievementInstance>('GroupAchievementInstance')
export const GroupAchievementInstance = builder.objectType(
  GroupAchievementInstanceRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export interface IClassAchievementInstance
  extends DB.ClassAchievementInstance {}

export const ClassAchievementInstanceRef =
  builder.objectRef<IClassAchievementInstance>('ClassAchievementInstance')
export const ClassAchievementInstance = builder.objectType(
  ClassAchievementInstanceRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export interface ITitle extends DB.Title {}

export const TitleRef = builder.objectRef<ITitle>('Title')
export const Title = builder.objectType(TitleRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})
