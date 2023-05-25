import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons'
import {
  Button,
  FormikTextField,
  H1,
  PinField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form } from 'formik'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import React, { useEffect, useRef, useState } from 'react'
import Footer from './Footer'

interface BeforeInstallPromptEventReturn {
  userChoice: string
  platform: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<BeforeInstallPromptEventReturn>
}

interface LoginFormProps {
  header: string
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
  installationHint?: boolean
}

export function LoginForm({
  header,
  labelIdentifier,
  fieldIdentifier,
  dataIdentifier,
  labelSecret,
  fieldSecret,
  dataSecret,
  isSubmitting,
  usePinField = false,
  installationHint = false,
}: LoginFormProps) {
  const [passwordHidden, setPasswordHidden] = useState(true)
  const t = useTranslations()
  const [oniOS, setOniOS] = useState(false)
  const [onChrome, setOnChrome] = useState(false)
  const deferredPrompt = useRef<undefined | BeforeInstallPromptEvent>(undefined)

  useEffect(() => {
    // Check if event is supported
    if ('onbeforeinstallprompt' in window) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        deferredPrompt.current = e as BeforeInstallPromptEvent
        setOnChrome(true)
      })
    } else {
      // TODO: resolve this fallback - currently shows install symbol on all mac browsers (also PCs)
      // We assume users are on iOS (for now)
      setOniOS(true)
    }
  }, [])

  const onInstallClick = async () => {
    deferredPrompt.current!.prompt()
  }

  return (
    <div className="flex flex-col flex-grow max-w-xl md:!flex-grow-0 md:border md:rounded-lg md:shadow">
      <div className="flex flex-col items-center justify-center flex-1 md:p-12">
        <div className="w-full mb-8 text-center sm:mb-12">
          <Image
            src="/KlickerLogo.png"
            width={300}
            height={90}
            alt="KlickerUZH Logo"
            className="mx-auto"
            data-cy="login-logo"
          />
        </div>
        <div>
          <H1>{header}</H1>
          <Form className="w-72 sm:w-96">
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

            <div className="flex flex-row justify-between">
              <div>
                {/* // TODO: add possibilities to reset password and register new user accounts here */}
              </div>
              <Button
                className={{ root: 'mt-2 border-uzh-grey-80' }}
                type="submit"
                disabled={isSubmitting}
                data={{ cy: 'submit-login' }}
              >
                <Button.Label>{t('shared.generic.signin')}</Button.Label>
              </Button>
            </div>

            {installationHint && onChrome && (
              <div className="flex flex-col justify-center mt-4 md:hidden">
                <UserNotification
                  type="info"
                  message={t('shared.login.installPWA')}
                >
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
            {installationHint && oniOS && (
              <UserNotification
                className={{ root: 'mt-4' }}
                type="info"
                message={t('shared.login.installHomeScreen')}
              />
            )}
          </Form>
        </div>
      </div>
      <div className="flex-none w-full">
        <Footer />
      </div>
    </div>
  )
}

export default LoginForm
