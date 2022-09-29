import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import {
  CreateParticipantGroupDocument,
  GetParticipantGroupsDocument,
  LeaveParticipantGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { useRouter } from 'next/router'

function GroupCreation() {
  const router = useRouter()
  const courseId = String(router.query.courseId)

  const [createParticipantGroup] = useMutation(CreateParticipantGroupDocument)
  const [leaveParticipantGroup] = useMutation(LeaveParticipantGroupDocument)

  const {
    loading: loadingParticipantGroups,
    error: errorParticipantGroups,
    data: dataParticipantGroups,
  } = useQuery(GetParticipantGroupsDocument, {
    variables: { courseId: courseId },
  })

  return (
    <Layout
      displayName="Gruppe Erstellen"
      courseName="Banking and Finance I - STILL HARDCODED"
      courseColor="green"
    >
      <H1>Gruppenname:</H1>
      <Formik
        initialValues={{ groupName: ''}}
        onSubmit={(values) => createParticipantGroup({
          variables: {
            courseId: courseId,
            name: values.groupName,
          },
          refetchQueries: [
            {
              query: GetParticipantGroupsDocument,
              variables: { courseId: courseId },
            },
          ],
        })}
      >
        <Form>
          <div className="flex flex-col">
            <Field type="text" name="groupName" placeholder="Gruppenname" />
            <ErrorMessage
              name="groupName"
              component="div"
              className="text-sm text-red-400"
            />
            <Button type="submit">Erstellen</Button>
          </div>
        </Form>
      </Formik>
      {dataParticipantGroups &&
        dataParticipantGroups.participantGroups &&
        dataParticipantGroups.participantGroups.length === 0 && (
          <div className="mt-10">Nicht Mitglied in einer Gruppe</div>
        )}
      {dataParticipantGroups &&
        dataParticipantGroups.participantGroups &&
        dataParticipantGroups.participantGroups?.length !== 0 && (
          <div className="mt-10">
            {dataParticipantGroups.participantGroups?.map((group) => (
              <div key={group.name}>
                {group.name}, Code: {group.code}, Mitglieder: ...
                <Button
                  onClick={() =>
                    leaveParticipantGroup({
                      variables: { groupId: group.id, courseId: courseId },
                      refetchQueries: [
                        {
                          query: GetParticipantGroupsDocument,
                          variables: { courseId: courseId },
                        },
                      ],
                    })
                  }
                >
                  Leave Group
                </Button>
              </div>
            ))}
          </div>
        )}
    </Layout>
  )
}

export default GroupCreation
