import { useMutation, useQuery } from '@apollo/client'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  RequestMigrationTokenDocument,
  TriggerMigrationDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, TextField } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

import Layout from 'src/components/Layout'
import { twMerge } from 'tailwind-merge'

type SetBooleanState = React.Dispatch<React.SetStateAction<boolean>>

function Migration({ query }: any) {
  //TODO: refactor code and simplify state handling
  const t = useTranslations()
  const router = useRouter()

  const [isStep1Shown, setIsStep1Shown] = useState(true)
  const [isStep2Shown, setIsStep2Shown] = useState(false)
  const [isStep3Shown, setIsStep3Shown] = useState(false)
  const [isStep4Shown, setIsStep4Shown] = useState(false)
  const [email, setEmail] = useState('')
  const [isStep1Completed, setIsStep1Completed] = useState(false)
  const [isStep2Completed, setIsStep2Completed] = useState(false)
  const [isStep3Completed, setIsStep3Completed] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  const [requestMigrationToken, { loading: requestingToken }] = useMutation(
    RequestMigrationTokenDocument
  )
  const [triggerMigration, { loading: triggeringMigration }] = useMutation(
    TriggerMigrationDocument
  )

  const { data } = useQuery(UserProfileDocument)

  const toggleStep = (setStepFunction: SetBooleanState) => {
    setStepFunction((prev: boolean) => !prev)
  }

  const proceedToNextStep = () => {
    setCurrentStep((prev) => prev + 1)
  }

  useEffect(() => {
    if (query?.step) {
      setIsStep1Completed(true)
      setIsStep2Completed(true)
      setIsStep3Completed(true)
      setIsStep1Shown(false)
      setIsStep2Shown(false)
      setIsStep3Shown(false)
      setIsStep4Shown(true)
      setCurrentStep(4)
    } else if (query?.token && !isStep1Completed && !isStep2Completed) {
      setIsStep1Completed(true)
      setIsStep2Completed(true)
      setIsStep1Shown(false)
      setIsStep2Shown(false)
      setIsStep3Shown(true)
      proceedToNextStep()
    }
  }, [query])

  return (
    <Layout displayName={t('manage.migration.pageName')}>
      <h1 className="text-center text-3xl font-bold">
        {t('manage.migration.pageName')}
      </h1>
      <div className="md-pt-8 flex w-[1000px] flex-col items-center self-center p-4">
        <div className="mb-4 w-2/3 bg-gray-50">
          <Button
            className={{
              root: twMerge('h-16 w-full justify-between bg-gray-50 shadow-sm'),
            }}
            onClick={() => toggleStep(setIsStep1Shown)}
            disabled={currentStep !== 1}
            data={{ cy: 'first-step-migration' }}
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
            <div className="flex w-full flex-col border border-t border-slate-200 pl-2 pr-2">
              <p className="mb-4 mt-4">
                {t('manage.migration.step1Description')}
              </p>
              <TextField
                placeholder="E-Mail..."
                value={email}
                label="E-Mail: "
                onChange={(newValue: string) => setEmail(newValue)}
                className={{
                  field: 'w-[500px]',
                  input: 'w-[500px]',
                }}
              />
              <Button
                loading={requestingToken}
                className={{
                  root: twMerge('bg-uzh-blue-80 mb-5 mt-8 self-end text-white'),
                }}
                onClick={async () => {
                  try {
                    await requestMigrationToken({
                      variables: { email: email },
                    })
                    setIsStep1Completed(true)
                    proceedToNextStep()
                    toggleStep(setIsStep1Shown)
                    toggleStep(setIsStep2Shown)
                    setEmail('')
                  } catch (error) {
                    console.log(
                      'An error occured while requesting a token: ',
                      error
                    )
                  }
                }}
                disabled={email === ''}
                data={{ cy: 'migration-old-klicker-email' }}
              >
                {t('manage.migration.requestMigrationToken')}
              </Button>
            </div>
          )}
        </div>

        <div className="mb-4 w-2/3 bg-gray-50">
          <Button
            className={{
              root: twMerge('h-16 w-full justify-between bg-gray-50 shadow-sm'),
            }}
            onClick={() => toggleStep(setIsStep2Shown)}
            disabled={currentStep !== 2}
            data={{ cy: 'second-step-migration' }}
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
            <div className="flex w-full flex-col border border-t border-slate-200 pl-2 pr-2">
              <p className="mb-4 mt-4">
                {t('manage.migration.step2Description')}
              </p>
            </div>
          )}
        </div>

        <div className="mb-4 w-2/3 bg-gray-50">
          <Button
            className={{
              root: twMerge('h-16 w-full justify-between bg-gray-50 shadow-sm'),
            }}
            onClick={() => toggleStep(setIsStep3Shown)}
            disabled={currentStep !== 3}
            data={{ cy: 'third-step-migration' }}
          >
            <h2 className="text-xl font-bold">
              {t('manage.migration.step3Title')}
            </h2>
            {isStep3Completed && (
              <Button.Icon>
                <FontAwesomeIcon icon={faCheck} />
              </Button.Icon>
            )}
          </Button>
          {isStep3Shown && (
            <div className="flex w-full flex-col border border-t border-slate-200 pl-2 pr-2">
              <p className="mb-4 mt-4">
                {t('manage.migration.step3Description', {
                  email: data?.userProfile?.email,
                })}
              </p>
              <Button
                loading={triggeringMigration}
                className={{
                  root: twMerge(
                    'bg-uzh-blue-80 mb-5 mt-8 self-center text-white'
                  ),
                }}
                onClick={async () => {
                  try {
                    await triggerMigration({
                      variables: { token: query.token },
                    })
                    setIsStep3Completed(true)
                    toggleStep(setIsStep3Shown)
                    toggleStep(setIsStep4Shown)
                    proceedToNextStep()

                    router.push(
                      {
                        pathname: router.pathname,
                        query: { ...router.query, step: 4 },
                      },
                      undefined,
                      { shallow: true }
                    )
                  } catch (error) {
                    console.log(
                      'An error occured while triggering the migration: ',
                      error
                    )
                  }
                }}
                disabled={!isStep1Completed || !isStep2Completed}
                data={{ cy: 'start-migration' }}
              >
                {t('manage.migration.startMigration')}
              </Button>
            </div>
          )}
        </div>

        <div className="mb-4 w-2/3 bg-gray-50">
          <Button
            className={{ root: twMerge('h-16 w-full bg-gray-50 shadow-sm') }}
            onClick={() => toggleStep(setIsStep4Shown)}
            disabled={currentStep !== 4}
            data={{ cy: 'fourth-step-migration' }}
          >
            <h2 className="text-xl font-bold">
              {t('manage.migration.step4Title')}
            </h2>
          </Button>
          {isStep4Shown && (
            <div className="flex w-full flex-col border border-t border-slate-200 pl-2 pr-2">
              <p className="mb-4 mt-4">
                {t('manage.migration.step4Description', {
                  email: data?.userProfile?.email,
                })}
              </p>
            </div>
          )}
        </div>
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
