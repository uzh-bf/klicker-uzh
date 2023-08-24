import { useMutation } from '@apollo/client'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  RequestMigrationTokenDocument,
  TriggerMigrationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, TextField } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import Layout from 'src/components/Layout'
import { twMerge } from 'tailwind-merge'

type SetBooleanState = React.Dispatch<React.SetStateAction<boolean>>

function Migration({ query }) {
  const t = useTranslations()
  const [isStep1Shown, setIsStep1Shown] = useState(true)
  const [isStep2Shown, setIsStep2Shown] = useState(false)
  const [isStep3Shown, setIsStep3Shown] = useState(false)
  const [email, setEmail] = useState('')
  const [isStep1Completed, setIsStep1Completed] = useState(false)
  const [isStep2Completed, setIsStep2Completed] = useState(false)
  const [isStep3Completed, setIsStep3Completed] = useState(false)

  const [requestMigrationToken] = useMutation(RequestMigrationTokenDocument)
  const [triggerMigration] = useMutation(TriggerMigrationDocument)

  const toggleStep = (setStepFunction: SetBooleanState) => {
    setStepFunction((prev: boolean) => !prev)
  }

  useEffect(() => {
    if (query?.token) {
      setIsStep1Completed(true)
      setIsStep2Completed(true)
      setIsStep1Shown(false)
      setIsStep2Shown(false)
      setIsStep3Shown(true)
    }
  }, [query])

  return (
    <Layout displayName={t('manage.migration.pageName')}>
      <h1 className="text-3xl font-bold text-center">
        {t('manage.migration.pageName')}
      </h1>
      <div className="flex flex-col self-center items-center p-4 w-[1000px] md-pt-8">
        <div className="w-2/3 mb-4 bg-gray-50">
          <Button
            className={{
              root: twMerge('w-full shadow-sm h-16 bg-gray-50 justify-between'),
            }}
            onClick={() => toggleStep(setIsStep1Shown)}
          >
            <h2 className="text-xl font-bold">
              {t('manage.migration.step1Title')}
            </h2>
            {isStep1Completed && (
              <Button.Icon>
                <FontAwesomeIcon icon={faCheck} />
              </Button.Icon>
            )}
          </Button>
          {isStep1Shown && (
            <div className="flex flex-col w-full pl-2 pr-2 border border-t border-slate-200">
              <p className="mt-4 mb-4">
                {t('manage.migration.step1Description')}
              </p>
              <TextField
                placeholder="E-Mail..."
                value={email}
                label="E-Mail: "
                onChange={(newValue: string) => setEmail(newValue)}
                className={{
                  root: 'w-full',
                  field: 'w-[500px]',
                  input: 'w-[500px]',
                }}
              />
              <Button
                className={{
                  root: twMerge('mt-8 mb-5 self-end bg-uzh-blue-80 text-white'),
                }}
                onClick={() =>
                  requestMigrationToken({
                    variables: { email: email },
                  })
                    .then(() => {
                      setIsStep1Completed(true)
                      toggleStep(setIsStep2Shown)
                      setEmail('')
                    })
                    .catch((error) => {
                      console.log(
                        'An error occured while requesting a migration token',
                        error
                      )
                    })
                }
                disabled={email === ''}
              >
                {t('manage.migration.requestMigrationToken')}
              </Button>
            </div>
          )}
        </div>

        <div className="w-2/3 mb-4 bg-gray-50">
          <Button
            className={{
              root: twMerge('w-full shadow-sm h-16 justify-between bg-gray-50'),
            }}
            onClick={() => toggleStep(setIsStep2Shown)}
          >
            <h2 className="text-xl font-bold">
              {t('manage.migration.step2Title')}
            </h2>
            {isStep2Completed && (
              <Button.Icon>
                <FontAwesomeIcon icon={faCheck} />
              </Button.Icon>
            )}
          </Button>
          {isStep2Shown && (
            <div className="flex flex-col w-full pl-2 pr-2 border border-t border-slate-200">
              <p className="mt-4 mb-4">
                {t('manage.migration.step2Description')}
              </p>
            </div>
          )}
        </div>

        <div className="w-2/3 mb-4 bg-gray-50">
          <Button
            className={{ root: twMerge('w-full shadow-sm h-16 bg-gray-50') }}
            onClick={() => toggleStep(setIsStep3Shown)}
          >
            <h2 className="text-xl font-bold">
              {t('manage.migration.step3Title')}
            </h2>
          </Button>
          {isStep3Shown && (
            <div className="flex flex-col w-full pl-2 pr-2 border border-t border-slate-200">
              <p className="mt-4 mb-4">
                {t('manage.migration.step3Description')}
              </p>
              <Button
                className={{
                  root: twMerge(
                    'mt-8 mb-5 self-center bg-uzh-blue-80 text-white'
                  ),
                }}
                onClick={() =>
                  triggerMigration({
                    variables: { token: query.token },
                  })
                }
                disabled={!isStep1Completed || !isStep2Completed}
              >
                {t('manage.migration.startMigration')}
              </Button>
            </div>
          )}
        </div>

        {/* <Button
          className={{
            root: twMerge('w-full', 'md-w-auto'),
          }}
          onClick={() =>
            requestMigrationToken({
              variables: { email: 'rolandschlaefli@gmail.com' },
            })
          }
        >
          Request Migration Token
        </Button> */}
      </div>
    </Layout>
  )
}

export default Migration

export async function getServerSideProps({
  query,
  locale,
}: GetServerSidePropsContext) {
  return {
    props: {
      query,
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}
