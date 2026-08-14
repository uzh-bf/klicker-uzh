import { useMutation } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  AssessmentParticipantInvitationStatus,
  DeletePendingAssessmentParticipantInvitationDocument,
  GetAssessmentParticipantInvitationsDocument,
  type GetAssessmentParticipantInvitationsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Badge,
  Button,
  Modal,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  toast,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

type Invitation = NonNullable<
  GetAssessmentParticipantInvitationsQuery['assessmentParticipantInvitations']
>[number]

function ParticipantInvitationsTable({
  courseId,
  invitations,
}: {
  courseId: string
  invitations: Invitation[]
}) {
  const t = useTranslations()
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation>()
  const [deleteInvitation, { loading: deleting }] = useMutation(
    DeletePendingAssessmentParticipantInvitationDocument,
    {
      refetchQueries: [
        {
          query: GetAssessmentParticipantInvitationsDocument,
          variables: { courseId },
        },
      ],
      awaitRefetchQueries: true,
    }
  )

  async function handleDelete() {
    if (!selectedInvitation) return

    try {
      const result = await deleteInvitation({
        variables: {
          courseId,
          invitationId: selectedInvitation.id,
        },
      })
      if (!result.data?.deletePendingAssessmentParticipantInvitation) {
        throw new Error('Invitation deletion returned no result')
      }

      toast({
        type: 'success',
        message: t('manage.assessment.invitationDeleteSuccess'),
      })
      setSelectedInvitation(undefined)
    } catch (error) {
      console.error(error)
      toast({
        type: 'error',
        message: t('manage.assessment.invitationDeleteFailed'),
      })
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <ShadcnTable>
          <ShadcnTableHeader className="bg-slate-50">
            <ShadcnTableRow>
              <ShadcnTableHead>
                {t('manage.assessment.invitationEmail')}
              </ShadcnTableHead>
              <ShadcnTableHead>
                {t('manage.assessment.invitationMatriculationNumber')}
              </ShadcnTableHead>
              <ShadcnTableHead>
                {t('manage.assessment.invitationStatus')}
              </ShadcnTableHead>
              <ShadcnTableHead>
                {t('manage.assessment.invitationInvitedAt')}
              </ShadcnTableHead>
              <ShadcnTableHead className="w-20 text-right">
                <span className="sr-only">
                  {t('manage.assessment.invitationActions')}
                </span>
              </ShadcnTableHead>
            </ShadcnTableRow>
          </ShadcnTableHeader>
          <ShadcnTableBody>
            {invitations.length > 0 ? (
              invitations.map((invitation) => (
                <ShadcnTableRow
                  key={invitation.id}
                  data-cy={`assessment-invitation-${invitation.id}`}
                >
                  <ShadcnTableCell className="font-medium">
                    {invitation.email}
                  </ShadcnTableCell>
                  <ShadcnTableCell>
                    {invitation.matriculationNumber ?? '—'}
                  </ShadcnTableCell>
                  <ShadcnTableCell>
                    <Badge
                      className={
                        invitation.status ===
                        AssessmentParticipantInvitationStatus.Accepted
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : 'bg-amber-100 text-amber-900 hover:bg-amber-100'
                      }
                    >
                      {invitation.status ===
                      AssessmentParticipantInvitationStatus.Accepted
                        ? t('manage.assessment.invitationStatusAccepted')
                        : t('manage.assessment.invitationStatusPending')}
                    </Badge>
                  </ShadcnTableCell>
                  <ShadcnTableCell>
                    {dayjs(invitation.invitedAt).format('DD.MM.YYYY HH:mm')}
                  </ShadcnTableCell>
                  <ShadcnTableCell className="text-right">
                    {invitation.status ===
                    AssessmentParticipantInvitationStatus.Pending ? (
                      <Button
                        basic
                        aria-label={t(
                          'manage.assessment.invitationDeleteLabel',
                          { email: invitation.email }
                        )}
                        onClick={() => setSelectedInvitation(invitation)}
                        className={{
                          root: 'h-8 w-8 border-red-200 p-0 text-red-700 hover:bg-red-50 hover:text-red-700',
                        }}
                        data={{
                          cy: `assessment-invitation-delete-${invitation.id}`,
                        }}
                      >
                        <Button.Icon withoutLabel icon={faTrashCan} />
                      </Button>
                    ) : null}
                  </ShadcnTableCell>
                </ShadcnTableRow>
              ))
            ) : (
              <ShadcnTableRow>
                <ShadcnTableCell
                  colSpan={5}
                  className="h-28 text-center text-slate-600"
                  data-cy="assessment-invitations-empty"
                >
                  {t('manage.assessment.invitationEmpty')}
                </ShadcnTableCell>
              </ShadcnTableRow>
            )}
          </ShadcnTableBody>
        </ShadcnTable>
      </div>

      {selectedInvitation ? (
        <Modal
          open
          hideCloseButton
          onClose={() => setSelectedInvitation(undefined)}
          title={t('manage.assessment.invitationDeleteTitle')}
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={() => setSelectedInvitation(undefined)}
          primaryLabel={t('shared.generic.delete')}
          primaryButtonStyle="destructive"
          primaryLoading={deleting}
          onPrimaryAction={handleDelete}
          dataPrimaryAction={{ cy: 'assessment-invitation-confirm-delete' }}
          dataSecondaryAction={{ cy: 'assessment-invitation-cancel-delete' }}
          className={{ content: 'max-w-lg' }}
        >
          <p className="mt-2 text-sm">
            {t('manage.assessment.invitationDeleteDescription', {
              email: selectedInvitation.email,
            })}
          </p>
        </Modal>
      ) : null}
    </>
  )
}

export default ParticipantInvitationsTable
