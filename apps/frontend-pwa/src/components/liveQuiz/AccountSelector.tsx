import { useMutation, useQuery } from '@apollo/client'
import { faKeyboard } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowLeft,
  faUserSecret,
  faUserTie,
} from '@fortawesome/free-solid-svg-icons'
import {
  LoginTemporaryParticipantDocument,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, FormikTextField, Modal, toast } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'

function AccountSelector({
  quizId,
  isGamificationEnabled,
}: {
  quizId: string
  isGamificationEnabled: boolean
}) {
  const t = useTranslations()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [definePseudonym, setDefinePseudonym] = useState(false)
  const [loginState, setLoginState] = useLocalStorage<
    'anonymous' | 'temporary' | 'loggedIn' | undefined
  >(`login-state-${quizId}`, undefined)

  const [loginTemporaryParticipant, { loading: loggingIn }] = useMutation(
    LoginTemporaryParticipantDocument
  )

  // check if the user is already logged in as a participant or temporary participant of this quiz
  const { data, loading, refetch } = useQuery(SelfDocument, {
    skip: loginState === 'anonymous', // if the user has already opted to participate anonymously, skip the query
  })
  useEffect(() => {
    // wait while the query is still loading
    if (loading || loginState === 'anonymous') {
      return
    }

    // once the query has finished loading, check if the user is logged in and show the modal otherwise
    if (!data?.self) {
      setOpen(true)
      setLoginState(undefined) // reset login state if the user is not logged in
      return
    }

    // if the user is logged in as a participant, set the login state to 'loggedIn'
    if (data.self.role === UserRole.Participant) {
      setLoginState('loggedIn')
    }

    // if the user is logged in as a temporary participant, set the login state to 'temporary'
    if (data.self.role === UserRole.TemporaryParticipant) {
      setLoginState('temporary')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading])

  return (
    <Modal
      hideCloseButton
      escapeDisabled
      open={open && isGamificationEnabled}
      onClose={() => {
        setOpen(false)
        setDefinePseudonym(false)
      }}
      title={
        <div>
          <span className="mr-3 text-2xl">👑</span>
          <span>{t('pwa.liveQuiz.thisLiveQuizGamified')}</span>
          <span className="ml-3 text-2xl">👑</span>
        </div>
      }
      className={{ title: 'mb-4 text-center', content: 'max-w-[25rem] pb-2' }}
    >
      {!definePseudonym ? (
        <>
          <div className="mb-4 text-sm">
            {t.rich('pwa.liveQuiz.loginSelectionHint', {
              b: (text) => <b>{text}</b>,
              ul: (text) => <ul className="list-disc pl-5">{text}</ul>,
              li: (text) => <li className="my-1">{text}</li>,
            })}
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button
              primary
              className={{ root: 'justify-start' }}
              onClick={() => {
                router.push(
                  `/login?redirect_to=${encodeURIComponent(`/session/${quizId}`)}`
                )
              }}
              data={{ cy: 'login-with-account' }}
            >
              <Button.Icon icon={faUserTie} />
              <Button.Label>{t('pwa.liveQuiz.loginWithAccount')}</Button.Label>
            </Button>
            <Button
              className={{ root: 'justify-start' }}
              onClick={() => setDefinePseudonym(true)}
              data={{ cy: 'create-temporary-pseudonym' }}
            >
              <Button.Icon icon={faKeyboard} />
              <Button.Label>
                {t('pwa.liveQuiz.createTemporaryPseudonym')}
              </Button.Label>
            </Button>
            <Button
              className={{ root: 'justify-start' }}
              onClick={() => {
                setLoginState('anonymous')
                setDefinePseudonym(false)
                setOpen(false)
              }}
              data={{ cy: 'participate-anonymously' }}
            >
              <Button.Icon icon={faUserSecret} />
              <Button.Label>
                {t('pwa.liveQuiz.participateAnonymously')}
              </Button.Label>
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button
            basic
            className={{ root: 'px-2 py-1 text-sm' }}
            onClick={() => setDefinePseudonym(false)}
            data={{ cy: 'cancel-define-pseudonym' }}
          >
            <Button.Icon icon={faArrowLeft} />
            <Button.Label>{t('pwa.liveQuiz.changeLoginMode')}</Button.Label>
          </Button>
          <div className="mb-2 mt-1 text-sm">
            {t.rich('pwa.liveQuiz.pseudonymExplanation', {
              b: (text) => <b>{text}</b>,
            })}
          </div>
          <Formik
            initialValues={{ pseudonym: '' }}
            validationSchema={Yup.object({
              pseudonym: Yup.string()
                .required(t('pwa.liveQuiz.pseudonymRequired'))
                .min(5, t('pwa.liveQuiz.pseudonymMinLength', { length: '5' }))
                .max(
                  15,
                  t('pwa.liveQuiz.pseudonymMaxLength', { length: '15' })
                ),
            })}
            onSubmit={async (values) => {
              try {
                const { data } = await loginTemporaryParticipant({
                  variables: {
                    liveQuizId: quizId,
                    pseudonym: values.pseudonym,
                  },
                })

                if (data?.loginTemporaryParticipant) {
                  setLoginState('temporary')
                  setOpen(false)

                  toast({
                    type: 'success',
                    message: t.rich(
                      'pwa.liveQuiz.joinedSuccessfullyWithPseudonym',
                      {
                        pseudonym: values.pseudonym,
                        b: (text) => <b>{text}</b>,
                      }
                    ),
                    options: { duration: 5000 },
                  })

                  await refetch() // refetch the self query to update the user data
                } else {
                  toast({
                    type: 'error',
                    message: t('pwa.liveQuiz.pseudonymAlreadyExists'),
                    options: { duration: 5000 },
                  })
                }
              } catch (error) {
                console.error(
                  'Error logging in as temporary participant:',
                  error
                )
                toast({
                  type: 'error',
                  message: t('pwa.liveQuiz.pseudonymCreationFailed'),
                  options: { duration: 5000 },
                })
              }
            }}
          >
            <Form className="flex flex-col gap-2">
              <FormikTextField
                required
                name="pseudonym"
                label={t('shared.generic.pseudonym')}
                placeholder="klicker123"
                className={{ label: 'text-sm' }}
              />
              <Button
                primary
                type="submit"
                loading={loggingIn}
                className={{ root: 'self-end' }}
              >
                {t('shared.generic.submit')}
              </Button>
            </Form>
          </Formik>
        </>
      )}
    </Modal>
  )
}

export default AccountSelector
