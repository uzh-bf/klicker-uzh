import { useLazyQuery, useMutation, useSuspenseQuery } from '@apollo/client'
import {
  ChangeInitialSettingsDocument,
  CheckShortnameAvailableDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DebouncedUsernameField from '@klicker-uzh/shared-components/src/DebouncedUsernameField'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'

import {
  faBook,
  faListCheck,
  faPeopleGroup,
} from '@fortawesome/free-solid-svg-icons'
import { routing } from '@klicker-uzh/i18n'
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

function SuspendedFirstLoginModal({
  refetchElements,
}: {
  refetchElements: () => Promise<void>
}) {
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
      loading={!data.userProfile}
      onClose={() => null}
      hideCloseButton
      className={{ content: 'h-max pb-1' }}
    >
      <H1 className={{ root: 'mb-4 text-4xl' }}>
        {t('manage.firstLogin.welcome')}
      </H1>
      <div className="mb-3 max-w-none">
        {t('manage.firstLogin.makeFirstSettings')}
      </div>
      {data.userProfile && (
        <Formik
          isInitialValid={false}
          validateOnMount
          initialTouched={{
            shortname: false,
            locale: false,
            sendProjectUpdates: false,
            seedDemoElements: true,
          }}
          validationSchema={Yup.object().shape({
            shortname: Yup.string()
              .required(t('manage.settings.shortnameRequired'))
              .min(5, t('manage.settings.shortnameMin'))
              .max(10, t('manage.settings.shortnameMax'))
              .matches(
                /^[a-zA-Z0-9]*$/,
                t('manage.settings.shortnameAlphanumeric')
              ),
            seedDemoElements: Yup.boolean().required(
              t('manage.firstLogin.seedDemoElementsDecisionRequired')
            ),
          })}
          initialValues={{
            shortname: data.userProfile.shortname,
            locale: data.userProfile.locale,
            sendProjectUpdates: data.userProfile.sendProjectUpdates,
            seedDemoElements: undefined,
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
                seedDemoElements: values.seedDemoElements ?? false,
              },
            })
            await refetchElements()

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
            <Form className="flex flex-col">
              <div className="mb-1 flex flex-col space-y-4 md:mb-5 md:flex-row md:justify-between md:space-y-0">
                <DebouncedUsernameField
                  required
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
                  className={{
                    root: 'w-[250px] md:w-max',
                    input: 'pl-8! bg-white',
                    icon: 'bg-transparent',
                  }}
                  data={{ cy: 'first-login-shortname' }}
                />
                <FormikSelectField
                  label={t('shared.generic.language')}
                  labelType="large"
                  name="locale"
                  items={routing.locales.map((loc) => ({
                    label: t(`shared.generic.${loc}`),
                    value: loc,
                  }))}
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
                  className={{ tooltip: 'md:max-w-140 max-w-80' }}
                />
              </div>
              {showGenericError && (
                <UserNotification type="error">
                  {t('shared.generic.systemError')}
                </UserNotification>
              )}

              <div className="mb-1.5">
                {t('manage.firstLogin.seedDemoElementsExplanation')}
              </div>
              <FormikSwitchField
                name="seedDemoElements"
                labelLeft
                label={t('manage.firstLogin.seedDemoElements')}
                className={{ root: 'mb-5' }}
              />

              <div className="mb-1.5 max-w-none">
                {t('manage.firstLogin.relevantLinks')}
              </div>
              <div className="mb-5 grid grid-cols-3 gap-4">
                <Link
                  href="https://www.klicker.uzh.ch/getting_started/welcome"
                  target="_blank"
                >
                  <Button data={{ cy: 'first-login-documentation' }} fluid>
                    <Button.Icon icon={faBook} />
                    <Button.Label>
                      {t('shared.generic.documentation')}
                    </Button.Label>
                  </Button>
                </Link>
                <Link href="https://community.klicker.uzh.ch" target="_blank">
                  <Button data={{ cy: 'first-login-community' }} fluid>
                    <Button.Icon icon={faPeopleGroup} />
                    <Button.Label>{t('shared.generic.community')}</Button.Label>
                  </Button>
                </Link>
                <Link
                  href="https://www.klicker.uzh.ch/development"
                  target="_blank"
                >
                  <Button data={{ cy: 'first-login-roadmap' }} fluid>
                    <Button.Icon icon={faListCheck} />
                    <Button.Label>{t('shared.generic.roadmap')}</Button.Label>
                  </Button>
                </Link>
              </div>

              <div className="mb-2 max-w-none">
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
                primary
                type="submit"
                loading={isSubmitting}
                disabled={!isValid}
                className={{ root: 'mt-4 w-32 self-end' }}
                data={{ cy: 'first-login-save-settings' }}
              >
                <Button.Label>{t('shared.generic.save')}</Button.Label>
              </Button>
            </Form>
          )}
        </Formik>
      )}
    </Modal>
  )
}

export default SuspendedFirstLoginModal
