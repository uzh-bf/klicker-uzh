import {
  PermissionLevel,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function usePermissionLevelSelection({ type }: { type: SharingObjectType }) {
  const t = useTranslations()

  // execution rights are only available for activities and courses
  const showExecution =
    type === SharingObjectType.Course ||
    type === SharingObjectType.LiveQuiz ||
    type === SharingObjectType.PracticeQuiz ||
    type === SharingObjectType.MicroLearning ||
    type === SharingObjectType.GroupActivity

  // default case: no execution permissions, all other access levels
  return [
    PermissionLevel.Read,
    ...(showExecution ? [PermissionLevel.Execute] : []),
    PermissionLevel.Write,
    PermissionLevel.Admin,
  ].map((level) => ({
    label: t(`manage.sharing.permissions${level}`),
    value: level,
    data: { cy: `permission-level-${level}` },
  }))
}

export default usePermissionLevelSelection
