import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons'
import Footer from '@klicker-uzh/shared-components/src/Footer'
import usePWAInstall, {
  BeforeInstallPromptEvent,
} from '@klicker-uzh/shared-components/src/hooks/usePWAInstall'
import {
  Button,
  FormikTextField,
  PinField,
  Tabs,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form } from 'formik'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
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
  usePinField?: boolean
  installAndroid?: string
  installIOS?: string
}

export function LoginForm({
  labelIdentifier,
  fieldIdentifier,
  dataIdentifier,
  labelSecret,
  fieldSecret,
  dataSecret,
  isSubmitting,
  usePinField = false,
  installAndroid,
  installIOS,
}: LoginFormProps) {
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
    <div className="flex flex-col flex-grow max-w-xl md:!flex-grow-0 md:border md:rounded-lg md:shadow">
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="w-full mb-8 text-center sm:my-12">
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
                override: '!rounded-none',
                label: 'font-bold text-md',
              }}
            />
            <Tabs.Tab
              key="joinCourse-tab"
              value="joinCourse"
              label={t('pwa.login.createAccountJoin')}
              className={{
                override: '!rounded-none',
                label: 'font-bold text-md',
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
              root: 'md:px-4 rounded-none h-full flex items-center md:pb-14 md:-my-2',
            }}
          >
            {/* // TODO: move this into login form component / shared-components or similar */}
            <Form className="w-72 sm:w-96 mx-auto">
              <FormikTextField
                required
                label={labelIdentifier}
                labelType="small"
                name={fieldIdentifier}
                data={dataIdentifier}
              />

              {usePinField ? (
                <PinField
                  required
                  label={labelSecret}
                  labelType="small"
                  name={fieldSecret}
                  className={{ root: 'mt-1' }}
                  data={dataSecret}
                />
              ) : (
                <FormikTextField
                  required
                  label={labelSecret}
                  labelType="small"
                  name={fieldSecret}
                  data={dataSecret}
                  icon={passwordHidden ? faEye : faEyeSlash}
                  onIconClick={() => setPasswordHidden(!passwordHidden)}
                  className={{ root: 'mt-1' }}
                  type={passwordHidden ? 'password' : 'text'}
                />
              )}

              <div className="w-full flex flex-row justify-end">
                <Button
                  className={{
                    root: 'w-full md:w-max mt-3 md:mt-2 border-uzh-grey-80 !justify-center',
                  }}
                  type="submit"
                  disabled={isSubmitting}
                  data={{ cy: 'submit-login' }}
                >
                  <Button.Label>{t('shared.generic.signin')}</Button.Label>
                </Button>
              </div>

              {installAndroid && onChrome && (
                <div className="flex flex-col justify-center mt-4 md:hidden">
                  <UserNotification type="info" message={installAndroid}>
                    <Button
                      className={{
                        root: 'mt-2 w-fit border-uzh-grey-80',
                      }}
                      onClick={onInstallClick}
                    >
                      <Button.Label>
                        {t('shared.login.installButton')}
                      </Button.Label>
                    </Button>
                  </UserNotification>
                </div>
              )}
              {installIOS && oniOS && (
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
      <div className="flex-none w-full">
        <Footer />
      </div>
    </div>
  )
}

export default LoginForm
