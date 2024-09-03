import { useMutation } from '@apollo/client'
import {
  Course,
  ManualRandomGroupAssignmentsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function GroupsList({ course }: { course: Course }) {
  const t = useTranslations()

  const [
    manualRandomGroupAssignments,
    { loading: randomGroupCreationLoading },
  ] = useMutation(ManualRandomGroupAssignmentsDocument)

  return (
    <Tabs.TabContent value="groups" className={{ root: 'p-2' }}>
      <Button
        className={{
          root: 'bg-primary-80 mt-4 w-max self-end text-white',
        }}
        onClick={async () =>
          await manualRandomGroupAssignments({
            variables: { courseId: course.id },
          })
        }
        loading={randomGroupCreationLoading}
      >
        {t('manage.course.assignRandomGroups')}
      </Button>
    </Tabs.TabContent>
  )
}

export default GroupsList
