import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons'
import { faEnvelope, faKey } from '@fortawesome/free-solid-svg-icons'
import Footer from '@klicker-uzh/shared-components/src/Footer'
import usePWAInstall, {
  BeforeInstallPromptEvent,
} from '@klicker-uzh/shared-components/src/hooks/usePWAInstall'
import {
  Button,
  FormikTextField,
  Tabs,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form } from 'formik'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useRef, useState } from 'react'
import CreateAccountJoinForm from './CreateAccountJoinForm'

interface LoginFormProps {
  labelIdentifier: string
  fieldIdentifier: string
  dataIdentifier?: {
    cy?: string
    test?: string
  }
  labelSecret: string
  fieldSecret: string
  dataSecret?: {
    cy?: string
    test?: string
  }
  isSubmitting: boolean
  installAndroid?: string
  installIOS?: string
  magicLinkLogin: boolean
  setMagicLinkLogin: (value: boolean) => void
}

function LoginForm({
  labelIdentifier,
  fieldIdentifier,
  dataIdentifier,
  labelSecret,
  fieldSecret,
  dataSecret,
  isSubmitting,
  installAndroid,
  installIOS,
  magicLinkLogin,
  setMagicLinkLogin,
}: LoginFormProps) {
  const router = useRouter()
  const [passwordHidden, setPasswordHidden] = useState(true)
  const t = useTranslations()
  const [oniOS, setOniOS] = useState(false)
  const [onChrome, setOnChrome] = useState(false)
  const deferredPrompt = useRef<undefined | BeforeInstallPromptEvent>(undefined)

  usePWAInstall({ deferredPrompt, setOnChrome, setOniOS })

  const onInstallClick = async () => {
    deferredPrompt.current!.prompt()
  }

  return (
    <div className="flex max-w-full flex-grow flex-col md:max-w-xl md:!flex-grow-0 md:rounded-lg md:border md:shadow">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-8 w-full text-center sm:my-12">
          <Image
            src="/KlickerLogo.png"
            width={300}
            height={90}
            alt="KlickerUZH Logo"
            className="mx-auto"
            data-cy="login-logo"
          />
        </div>

        <Tabs defaultValue="login" className={{ root: 'w-full border-t' }}>
          <Tabs.TabList>
            <Tabs.Tab
              key="login-tab"
              value="login"
              label={t('shared.generic.login')}
              className={{
                root: '!rounded-none',
                label: 'text-md font-bold',
              }}
            />
            <Tabs.Tab
              key="joinCourse-tab"
              value="joinCourse"
              label={t('pwa.login.createAccountJoin')}
              className={{
                root: '!rounded-none',
                label: 'text-md font-bold',
              }}
            />
          </Tabs.TabList>
          <Tabs.TabContent
            key="joinCourse"
            value="joinCourse"
            className={{ root: 'md:px-4' }}
          >
            <CreateAccountJoinForm />
          </Tabs.TabContent>
          <Tabs.TabContent
            key="login"
            value="login"
            className={{
              root: 'flex h-max items-center rounded-none md:-my-2 md:mt-3 md:px-4 md:pb-14',
            }}
          >
            <Form className="mx-auto w-full px-4">
              {router.query.newAccount ? (
                <UserNotification type="success">
                  {t('pwa.general.waitingForActivation')}
                </UserNotification>
              ) : null}

              {magicLinkLogin && (
                <UserNotification type="info">
                  {t('pwa.profile.forgotPasswordInfo')}
                </UserNotification>
              )}

              <FormikTextField
                required
                label={labelIdentifier}
                labelType="small"
                name={fieldIdentifier}
                data={dataIdentifier}
              />

              {magicLinkLogin && (
                <div className="mt-3 flex flex-col gap-2 md:mt-2">
                  {process.env.NEXT_PUBLIC_WITH_MAGIC_LINK === 'true' && (
                    <Button
                      fluid
                      primary
                      type="submit"
                      disabled={isSubmitting}
                      data={{ cy: 'magic-link-login' }}
                    >
                      <Button.Icon icon={faEnvelope} />
                      <Button.Label>
                        {t('pwa.general.magicLinkLogin')}
                      </Button.Label>
                    </Button>
                  )}
                  <Button
                    fluid
                    type="button"
                    onClick={() => setMagicLinkLogin(false)}
                    data={{ cy: 'password-login' }}
                  >
                    <Button.Icon icon={faKey} />
                    <Button.Label>
                      {t('pwa.general.passwordLogin')}
                    </Button.Label>
                  </Button>
                </div>
              )}

              {!magicLinkLogin && (
                <>
                  <FormikTextField
                    required
                    label={labelSecret}
                    labelType="small"
                    iconPosition="right"
                    name={fieldSecret}
                    data={dataSecret}
                    icon={passwordHidden ? faEye : faEyeSlash}
                    onIconClick={() => setPasswordHidden(!passwordHidden)}
                    className={{ root: 'mt-1', icon: 'bg-transparent' }}
                    type={passwordHidden ? 'password' : 'text'}
                  />

                  <div className="flex flex-row justify-between">
                    <Button
                      basic
                      onClick={() => setMagicLinkLogin(true)}
                      className={{
                        root: 'text-primary-100 mt-1 !p-0 text-sm hover:bg-transparent hover:underline',
                      }}
                    >
                      <Button.Label>
                        {t('shared.generic.forgotPassword')}
                      </Button.Label>
                    </Button>
                    <Button
                      primary
                      type="submit"
                      disabled={isSubmitting}
                      className={{
                        root: 'mt-3 md:mb-0 md:mt-2 md:w-max md:self-end',
                      }}
                      data={{ cy: 'submit-login' }}
                    >
                      <Button.Label>{t('shared.generic.signin')}</Button.Label>
                    </Button>
                  </div>
                </>
              )}

              {!magicLinkLogin && installAndroid && onChrome && (
                <div className="mt-4 flex flex-col justify-center md:hidden">
                  <UserNotification type="info" message={installAndroid}>
                    <Button
                      onClick={onInstallClick}
                      className={{
                        root: 'border-uzh-grey-80 mt-2 w-fit',
                      }}
                      data={{ cy: 'install-student-pwa' }}
                    >
                      <Button.Label>
                        {t('shared.login.installButton')}
                      </Button.Label>
                    </Button>
                  </UserNotification>
                </div>
              )}
              {!magicLinkLogin && installIOS && oniOS && (
                <UserNotification
                  className={{ root: 'mt-4' }}
                  type="info"
                  message={installIOS}
                />
              )}
            </Form>
          </Tabs.TabContent>
        </Tabs>
      </div>
      <div className="w-full flex-none">
        <Footer />
      </div>
    </div>
  )
}

export default LoginForm
