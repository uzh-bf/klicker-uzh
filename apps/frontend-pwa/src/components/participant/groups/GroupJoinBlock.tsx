import { useMutation } from '@apollo/client'
import { faPeopleGroup } from '@fortawesome/free-solid-svg-icons'
import {
  GetParticipantGroupsDocument,
  JoinParticipantGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import GroupAction from './GroupAction'

function GroupJoinBlock({
  courseId,
  setSelectedTab,
}: {
  courseId: string
  setSelectedTab: (value: string) => void
}) {
  const t = useTranslations()
  const [joinParticipantGroup, { loading }] = useMutation(
    JoinParticipantGroupDocument
  )

  return (
    <div className="h-full w-full">
      <GroupAction
        buttonMode={false}
        title={t('pwa.courses.joinGroup')}
        icon={faPeopleGroup}
        validationSchema={Yup.object().shape({
          value: Yup.string()
            .required(t('pwa.groups.pinRequired'))
            .test('is-numeric', t('pwa.groups.pinNumeric'), (value) => {
              return !isNaN(Number(value)) && value.length === 6
            }),
        })}
        onSubmit={async (value) => {
          const result = await joinParticipantGroup({
            variables: {
              courseId: courseId,
              code: Number(value) >> 0,
            },
            // refetch is more effective here to avoid code duplication for participant aggregation
            // -> performance implications are not relevant here, short loading circle is acceptable
            // participant groups query is joint between course and separate -> separate call sufficient
            refetchQueries: [
              { query: GetParticipantGroupsDocument, variables: { courseId } },
            ],
          })

          if (
            !result.data?.joinParticipantGroup ||
            result.data.joinParticipantGroup === 'FAILURE'
          ) {
            toast({
              type: 'error',
              message: t('pwa.courses.joinGroupError'),
              options: { duration: 6000 },
            })
          } else if (result.data.joinParticipantGroup === 'FULL') {
            toast({
              type: 'warning',
              message: t('pwa.courses.joinGroupFull'),
              options: { duration: 6000 },
            })
          } else {
            setSelectedTab(result.data.joinParticipantGroup)
          }
        }}
        loading={loading}
        placeholder={t('pwa.courses.code')}
        textSubmit={t('shared.generic.join')}
        data={undefined}
      />
    </div>
  )
}

export default GroupJoinBlock
