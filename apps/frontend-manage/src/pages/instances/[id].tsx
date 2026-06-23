import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState, type ComponentProps } from 'react'
import {
  ElementType,
  type ElementInstance,
} from '../../lib/constants/elementTypes'
import { trpc } from '../../lib/trpc'

type StudentElementInstance = ComponentProps<typeof StudentElement>['element']
const previewShellClassName =
  'flex min-h-screen w-full items-center justify-center'

function InstancePreview() {
  const t = useTranslations()
  const router = useRouter()

  const instanceId =
    typeof router.query.id === 'string' ? Number(router.query.id) : -1
  const shouldFetchInstance = Number.isInteger(instanceId) && instanceId > 0

  const { data, isLoading } = trpc.element.singleInstance.useQuery(
    {
      id: instanceId,
    },
    {
      enabled: shouldFetchInstance,
    }
  )
  const instance = data?.singleInstance as ElementInstance | null | undefined

  // initialize student response with default state (FT question) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.FreeText as InstanceStackStudentResponseType['type'],
      response: undefined,
      valid: false,
    })

  // hook running on every instance change to initialize the student response correctly
  useSingleStudentResponse({
    instance: instance as StudentElementInstance | null | undefined,
    setStudentResponse,
  })

  if (!router.isReady || (shouldFetchInstance && isLoading)) {
    return (
      <div className={`${previewShellClassName} p-6`}>
        <Loader />
      </div>
    )
  }

  if (!instance) {
    return (
      <div className={`${previewShellClassName} p-6`}>
        <UserNotification className={{ root: 'w-full max-w-lg' }} type="error">
          {t('shared.generic.systemError')}
        </UserNotification>
      </div>
    )
  }

  return (
    <div className={previewShellClassName}>
      <div className="flex w-full flex-col items-center p-6">
        <H2 className={{ root: 'mb-3' }}>
          {t('manage.general.elementPreview', {
            element: instance.elementData.name,
          })}
        </H2>
        <div className="w-256 max-w-full rounded-lg border border-solid p-5">
          <StudentElement
            element={instance as StudentElementInstance}
            elementIx={0}
            singleStudentResponse={studentResponse}
            setSingleStudentResponse={setStudentResponse}
            hideReadButton={false}
            disabledInput={false}
          />
        </div>
      </div>
    </div>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default InstancePreview
