import { useMutation, useQuery } from '@apollo/client'
import { faKeyboard } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faUserSecret,
  faUserTie,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  LoginTemporaryParticipantDocument,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import {
  Button,
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselNext,
  CarouselPrevious,
  FormikTextField,
  Modal,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import CarouselMonitor from './CarouselMonitor'

const AVAILABLE_AVATARS = [
  '',
  '43de5cc3e88371b82515e365b61ca4f56b3fff76',
  'd8bced94c310832dc36fc22ad3a8fd7fbde69010',
  'eda64b05916c5d5d219a840befc63e269978a1da',
  '2d1cfed9ead85a12389badd09e48e0ded97540f9',
  'a9178a73231f5583c39316b23579dc8fb2f6ba2e',
  '5bbb97018ce7d9de56c93feb71c20c4741d80205',
  '1668749bf2981ef2d432d16aabe01151ddb774a2',
  'b877b984af00e8d901f714a470d50ba1282a6e00',
  '212fa161b03cc873b03eee91fce1e6b123305700',
  'ba359939f81458694d3ae1ead5d42a9c52204ba9',
  'b8c64871872753fb5e6f61c3e93c89f4aeceb7d7',
  'af8392c87388febc5814c15d97630138b419b2ed',
  'cabe95f3e740b9503e1bf771972d230600a4528c',
  'f60344fc3fef0b4e4e1d7a9b17950b9102a89ecf',
  '075bcfa2a31a58e38badb2b81381787e2c7386c5',
  '77749da96b827d1fa055e916d6e7a0d26b42bdff',
]

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
  const [step, setStep] = useState<'choice' | 'pseudonym' | 'avatar'>('choice')
  const [loginState, setLoginState] = useLocalStorage<
    'anonymous' | 'temporary' | 'loggedIn' | undefined
  >(`login-state-${quizId}`, undefined)
  const [api, setApi] = useState<CarouselApi>()

  const [loginTemporaryParticipant, { loading: loggingIn }] = useMutation(
    LoginTemporaryParticipantDocument
  )

  // check if the user is already logged in as a participant or temporary participant of this quiz
  const { data, loading, refetch } = useQuery(SelfDocument, {
    variables: { liveQuizId: quizId },
    fetchPolicy: 'network-only',
    skip: loginState === 'anonymous', // if the user has already opted to participate anonymously, skip the query
  })
  useEffect(() => {
    // wait while the query is still loading
    if (loading || loginState === 'anonymous') {
      return
    }

    // once the query has finished loading, check if the user is logged in and show the modal otherwise
    if (
      !data?.self ||
      (data.self.scopeQuizId !== null && data.self.scopeQuizId !== quizId)
    ) {
      setOpen(true)
      setLoginState(undefined) // reset login state if the user is not logged in
      return
    }

    // if the user is logged in as a participant, set the login state to 'loggedIn'
    // depending on whether the user has a participation on the course, a notification / warning will be shown
    if (data.self.role === UserRole.Participant) {
      setLoginState('loggedIn')
    }

    // if the user is logged in as a temporary participant, set the login state to 'temporary'
    if (data.self.role === UserRole.TemporaryParticipant) {
      setLoginState('temporary')
    }
  }, [data, loading, loginState, quizId, setLoginState])

  return (
    <Modal
      hideCloseButton
      escapeDisabled
      open={open && isGamificationEnabled}
      onClose={() => {
        setOpen(false)
        setStep('choice')
      }}
      title={
        <div>
          <span className="mr-3 text-2xl">👑</span>
          <span>{t('pwa.liveQuiz.thisLiveQuizGamified')}</span>
          <span className="ml-3 text-2xl">👑</span>
        </div>
      }
      className={{ title: 'mb-4 text-center', content: 'max-w-100 pb-2' }}
    >
      {step === 'choice' ? (
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
              onClick={() => setStep('pseudonym')}
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
                setStep('choice')
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
      ) : null}
      <Formik
        initialValues={{ pseudonym: '', avatar: '' }}
        validationSchema={Yup.object({
          pseudonym: Yup.string()
            .required(t('pwa.liveQuiz.pseudonymRequired'))
            .min(5, t('pwa.liveQuiz.pseudonymMinLength', { length: '5' }))
            .max(15, t('pwa.liveQuiz.pseudonymMaxLength', { length: '15' })),
          avatar: Yup.string(),
        })}
        onSubmit={async (values) => {
          try {
            const { data } = await loginTemporaryParticipant({
              variables: {
                liveQuizId: quizId,
                pseudonym: values.pseudonym,
                avatar: values.avatar !== '' ? values.avatar : undefined,
              },
              // refetch is required here to ensure up-to-date data with temporary leaderboard entry
              refetchQueries: [{ query: SelfDocument }],
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
            console.error('Error logging in as temporary participant:', error)
            toast({
              type: 'error',
              message: t('pwa.liveQuiz.pseudonymCreationFailed'),
              options: { duration: 5000 },
            })
          }
        }}
      >
        {({ values, setFieldValue }) => (
          <Form className="flex flex-col">
            {step === 'pseudonym' ? (
              <>
                <Button
                  basic
                  className={{ root: 'w-max px-2 py-1 text-sm' }}
                  onClick={() => setStep('choice')}
                  data={{ cy: 'cancel-define-pseudonym' }}
                >
                  <Button.Icon icon={faArrowLeft} />
                  <Button.Label>
                    {t('pwa.liveQuiz.changeLoginMode')}
                  </Button.Label>
                </Button>
                <div className="my-1 text-sm">
                  {t.rich('pwa.liveQuiz.pseudonymExplanation', {
                    b: (text) => <b>{text}</b>,
                  })}
                </div>

                <FormikTextField
                  required
                  name="pseudonym"
                  label={t('shared.generic.pseudonym')}
                  placeholder="klicker123"
                  className={{ label: 'text-sm' }}
                  data={{ cy: 'pseudonym-input' }}
                />
                <Button
                  type="button"
                  disabled={
                    !values.pseudonym ||
                    values.pseudonym.length < 5 ||
                    values.pseudonym.length > 15
                  }
                  onClick={() => setStep('avatar')}
                  className={{ root: 'mt-2 self-end' }}
                  data={{ cy: 'pseudonym-next-step' }}
                >
                  <Button.Icon icon={faArrowRight} />
                  <Button.Label>{t('shared.generic.next')}</Button.Label>
                </Button>
              </>
            ) : null}
            {step === 'avatar' ? (
              <>
                <Button
                  basic
                  className={{ root: 'w-max px-2 py-1 text-sm' }}
                  onClick={() => setStep('pseudonym')}
                  data={{ cy: 'cancel-choose-avatar' }}
                >
                  <Button.Icon icon={faArrowLeft} />
                  <Button.Label>
                    {t('pwa.liveQuiz.pseudonymSelection')}
                  </Button.Label>
                </Button>
                <div className="my-1 text-sm">
                  {t.rich('pwa.liveQuiz.avatarExplanation', {
                    b: (text) => <b>{text}</b>,
                  })}
                </div>

                <CarouselMonitor
                  avatars={AVAILABLE_AVATARS}
                  api={api}
                  setFieldValue={setFieldValue}
                />
                <Carousel
                  opts={{ loop: true }}
                  className="w-full overflow-visible"
                  setApi={setApi}
                >
                  <CarouselContent className="mt-4 overflow-visible px-10 pb-0.5">
                    {AVAILABLE_AVATARS.map((avatar, index) => (
                      <div
                        key={avatar}
                        className={twMerge(
                          'relative flex justify-center overflow-visible pb-10',
                          index === AVAILABLE_AVATARS.length - 1 && '-mr-10'
                        )}
                      >
                        <div
                          className={twMerge(
                            'flex h-40 w-40 cursor-pointer items-center justify-center',
                            avatar === '' && 'p-5 pt-14'
                          )}
                        >
                          <Image
                            src={
                              avatar && avatar !== ''
                                ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`
                                : '/user-solid.svg'
                            }
                            alt="Avatar option"
                            width={140}
                            height={140}
                            className={twMerge(
                              'h-auto w-full rounded-full',
                              avatar ? '' : 'p-2'
                            )}
                          />
                        </div>
                        {values.avatar === avatar && (
                          <div className="absolute bottom-0 left-0 right-0 z-10 mx-auto flex w-fit flex-row items-center gap-2.5 rounded-md border-2 border-green-600 bg-white px-2 py-1 text-sm">
                            <FontAwesomeIcon
                              icon={faCheck}
                              className="h-4 w-4 font-bold text-green-700"
                            />
                            {t('shared.generic.selected')}
                          </div>
                        )}
                      </div>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious
                    type="button"
                    className="left-0"
                    data-cy="avatar-carousel-prev"
                  />
                  <CarouselNext
                    type="button"
                    className="right-0"
                    data-cy="avatar-carousel-next"
                  />
                </Carousel>
                <Button
                  primary
                  type="submit"
                  loading={loggingIn}
                  className={{ root: 'mt-2 self-end' }}
                  data={{ cy: 'submit-pseudonym-and-avatar' }}
                >
                  {t('shared.generic.confirm')}
                </Button>
              </>
            ) : null}
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default AccountSelector
