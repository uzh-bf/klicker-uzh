import { useMutation } from '@apollo/client'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import {
  CreateParticipantGroupDocument,
  GetParticipantGroupsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import GroupAction from './GroupAction'

function GroupCreationBlock({
  courseId,
  setSelectedTab,
}: {
  courseId: string
  setSelectedTab: (value: string) => void
}) {
  const t = useTranslations()
  const [createParticipantGroup, { loading }] = useMutation(
    CreateParticipantGroupDocument
  )

  return (
    <GroupAction
      buttonMode={false}
      title={t('pwa.courses.createGroup')}
      icon={faPlus}
      validationSchema={Yup.object().shape({
        value: Yup.string()
          .required(t('pwa.groups.nameRequired'))
          .test('is-not-empty', t('pwa.groups.nameRequired'), (value) => {
            return value?.trim().length > 0
          }),
      })}
      onSubmit={async (value) => {
        const result = await createParticipantGroup({
          variables: { courseId: courseId, name: value },
          // refetch is more effective here to avoid code duplication for participant aggregation
          // -> performance implications are not relevant here, short loading circle is acceptable
          // participant groups query is joint between course and separate -> separate call sufficient
          refetchQueries: [
            { query: GetParticipantGroupsDocument, variables: { courseId } },
          ],
        })

        if (result.data?.createParticipantGroup?.id) {
          setSelectedTab(result.data.createParticipantGroup.id)
        }
      }}
      loading={loading}
      placeholder={t('pwa.courses.groupName')}
      textSubmit={t('shared.generic.create')}
      inputData={{ cy: 'group-creation-name-input' }}
      data={{ cy: 'create-new-participant-group' }}
    />
  )
}

export default GroupCreationBlock
