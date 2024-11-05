import { useLazyQuery, useMutation, useSuspenseQuery } from '@apollo/client'
import {
  ChangeInitialSettingsDocument,
  CheckShortnameAvailableDocument,
  GetUserQuestionsDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DebouncedUsernameField from '@klicker-uzh/shared-components/src/DebouncedUsernameField'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  FormikSelectField,
  FormikSwitchField,
  H1,
  Modal,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

function SuspendedFirstLoginModal() {
  const [firstLogin, setFirstLogin] = useState(false)
  const [showGenericError, setShowGenericError] = useState(false)
  const [isShortnameAvailable, setIsShortnameAvailable] = useState<
    boolean | undefined
  >(true)

  const { data } = useSuspenseQuery(UserProfileDocument)
  const [changeInitialSettings] = useMutation(ChangeInitialSettingsDocument)
  const t = useTranslations()

  const [checkShortnameAvailable] = useLazyQuery(
    CheckShortnameAvailableDocument
  )

  useEffect(() => {
    if (data?.userProfile?.firstLogin) {
      setFirstLogin(true)
    }
  }, [data.userProfile])

  if (!firstLogin) {
    return null
  }

  return (
    <Modal
      fullScreen
      open={firstLogin}
      onClose={() => null}
      hideCloseButton
      className={{ content: 'h-max max-h-full' }}
    >
      <H1 className={{ root: 'mb-4 text-4xl' }}>
        {t('manage.firstLogin.welcome')}
      </H1>
      <div className="prose mb-2 max-w-none">
        {t('manage.firstLogin.makeFirstSettings')}
      </div>
      {data.userProfile ? (
        <Formik
          validationSchema={Yup.object().shape({
            shortname: Yup.string()
              .required(t('manage.settings.shortnameRequired'))
              .min(5, t('manage.settings.shortnameMin'))
              .max(8, t('manage.settings.shortnameMax'))
              .matches(
                /^[a-zA-Z0-9]*$/,
                t('manage.settings.shortnameAlphanumeric')
              ),
          })}
          initialValues={{
            shortname: data.userProfile.shortname,
            locale: data.userProfile.locale,
            sendProjectUpdates: data.userProfile.sendProjectUpdates,
          }}
          onSubmit={async (values, { setSubmitting, setErrors }) => {
            setShowGenericError(false)
            setSubmitting(true)

            const trimmedUsername = values.shortname.trim()

            const result = await changeInitialSettings({
              variables: {
                shortname: trimmedUsername,
                locale: values.locale,
                sendUpdates: values.sendProjectUpdates,
              },
              refetchQueries: [GetUserQuestionsDocument],
            })

            if (!result) {
              setShowGenericError(true)
            } else if (
              result.data?.changeInitialSettings?.shortname !== trimmedUsername
            ) {
              setErrors({
                shortname: t('manage.settings.shortnameTaken'),
              })
            } else {
              setFirstLogin(false)
            }

            setSubmitting(false)
          }}
        >
          {({ isValid, isSubmitting, validateField }) => (
            <Form>
              <div className="mb-1 flex flex-col space-y-4 md:mb-5 md:flex-row md:justify-between md:space-y-0">
                <DebouncedUsernameField
                  t={t}
                  className={{
                    root: 'w-[250px] md:w-max',
                    input: 'bg-white',
                    icon: 'bg-transparent',
                  }}
                  name="shortname"
                  label={t('shared.generic.shortname')}
                  labelType="large"
                  valid={isShortnameAvailable}
                  setValid={(shortnameAvailable: boolean | undefined) =>
                    setIsShortnameAvailable(shortnameAvailable)
                  }
                  validateField={async () => {
                    await validateField('shortname')
                  }}
                  checkUsernameAvailable={async (name: string) => {
                    const { data: result } = await checkShortnameAvailable({
                      variables: { shortname: name },
                    })
                    return result?.checkShortnameAvailable ?? false
                  }}
                  unavailableMessage={t('shared.generic.usernameAvailability')}
                  data={{ cy: 'first-login-shortname' }}
                  required
                />
                <FormikSelectField
                  label={t('shared.generic.language')}
                  labelType="large"
                  name="locale"
                  items={[
                    { label: t('shared.generic.english'), value: 'en' },
                    { label: t('shared.generic.german'), value: 'de' },
                  ]}
                  className={{
                    root: 'w-full md:w-max',
                    select: { trigger: 'w-40' },
                  }}
                  required
                />
                <FormikSwitchField
                  name="sendProjectUpdates"
                  labelLeft
                  label={t('manage.settings.emailUpdates')}
                  tooltip={t('manage.settings.emailUpdatesTooltip')}
                  className={{ tooltip: 'max-w-[20rem] md:max-w-[35rem]' }}
                />
              </div>
              {showGenericError && (
                <UserNotification type="error">
                  {t('shared.generic.systemError')}
                </UserNotification>
              )}

              <div className="prose mb-4 max-w-none">
                {t('manage.firstLogin.relevantLinks')}
              </div>

              <div className="mb-4 grid grid-cols-3 gap-4">
                <Link
                  href="https://www.klicker.uzh.ch/getting_started/welcome"
                  target="_blank"
                >
                  <Button data={{ cy: 'first-login-documentation' }} fluid>
                    Documentation
                  </Button>
                </Link>
                <Link href="https://community.klicker.uzh.ch" target="_blank">
                  <Button data={{ cy: 'first-login-community' }} fluid>
                    Community
                  </Button>
                </Link>
                <Link href="https://klicker-uzh.feedbear.com" target="_blank">
                  <Button data={{ cy: 'first-login-roadmap' }} fluid>
                    Roadmap
                  </Button>
                </Link>
              </div>

              <div className="prose mb-6 max-w-none">
                {t('manage.firstLogin.watchVideo')}
              </div>

              <iframe
                id="kmsembed-0_ugtkafd3"
                width="100%"
                height="400"
                src="https://uzh.mediaspace.cast.switch.ch/embed/secure/iframe/entryId/0_ugtkafd3/uiConfId/23448425/st/0"
                className="kmsembed"
                allowFullScreen
                allow="autoplay *; fullscreen *; encrypted-media *"
                referrerPolicy="no-referrer-when-downgrade"
                sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
                title="KlickerUZH_CoreConcepts_AudioEnhanced"
              />

              <Button
                fluid
                className={{
                  root: 'bg-primary-80 float-right mt-4 w-32 justify-center text-white disabled:cursor-not-allowed disabled:opacity-50',
                }}
                disabled={!isValid || isSubmitting}
                type="submit"
                data={{ cy: 'first-login-save-settings' }}
              >
                {isSubmitting ? <Loader /> : t('shared.generic.save')}
              </Button>
            </Form>
          )}
        </Formik>
      ) : (
        <Loader />
      )}
    </Modal>
  )
}

export default SuspendedFirstLoginModal
