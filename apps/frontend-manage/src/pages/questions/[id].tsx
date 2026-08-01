import { useQuery } from '@apollo/client'
import {
  ElementType,
  GetArtificialInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'

function QuestionDetails() {
  const t = useTranslations()
  const router = useRouter()

  const { data, loading } = useQuery(GetArtificialInstanceDocument, {
    variables: {
      elementId: Number(router.query.id),
    },
    skip: !router.query.id,
  })
  const instance = data?.artificialInstance

  // initialize student response with default state (FT question) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.FreeText,
      response: undefined,
      valid: false,
    })

  // hook running on every instance change to initialize the student response correctly
  useSingleStudentResponse({
    instance,
    setStudentResponse,
  })

  if (loading) {
    return <Loader />
  }

  if (!instance) {
    return (
      <UserNotification className={{ root: 'm-auto w-max' }} type="error">
        {t('shared.generic.systemError')}
      </UserNotification>
    )
  }

  return (
    <div className="flex w-full items-center justify-center">
      <div className="flex w-full flex-col items-center p-6">
        <H2 className={{ root: 'mb-3' }}>
          {t('manage.general.elementPreview', {
            element: instance.elementData.name,
          })}
        </H2>
        <div
          data-cy="question-preview-container"
          className="w-256 max-w-full rounded-lg border border-solid p-5"
        >
          <StudentElement
            element={instance}
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

export default QuestionDetails
