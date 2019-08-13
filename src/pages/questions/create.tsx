import React from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { defineMessages, useIntl } from 'react-intl'
import { convertToRaw } from 'draft-js'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import QuestionCreationForm from '../../components/forms/questionManagement/QuestionCreationForm'
import { getPresignedURLs, uploadFilesToPresignedURLs } from '../../lib/utils/files'
import QuestionListQuery from '../../graphql/queries/QuestionListQuery.graphql'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'
import CreateQuestionMutation from '../../graphql/mutations/CreateQuestionMutation.graphql'
import RequestPresignedURLMutation from '../../graphql/mutations/RequestPresignedURLMutation.graphql'

import useLogging from '../../lib/hooks/useLogging'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Create Question',
    id: 'createQuestion.pageTitle',
  },
  title: {
    defaultMessage: 'Create Question',
    id: 'createQuestion.title',
  },
})

function CreateQuestion(): React.ReactElement {
  useLogging({ slaask: true })

  const intl = useIntl()
  const router = useRouter()

  const [createQuestion] = useMutation(CreateQuestionMutation)
  const [requestPresignedURL] = useMutation(RequestPresignedURLMutation)
  const { data, loading: tagsLoading } = useQuery(TagListQuery)

  return (
    <TeacherLayout
      navbar={{
        title: intl.formatMessage(messages.title),
      }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'createQuestion' }}
    >
      <QuestionCreationForm
        tags={data.tags}
        tagsLoading={tagsLoading}
        // handle discarding a new question
        onDiscard={(): Promise<boolean> => router.push('/questions')}
        // handle submitting a new question
        onSubmit={async ({ content, options, tags, title, type, files }, { setSubmitting }): Promise<void> => {
          // request presigned urls and filenames for all files
          const fileEntities = await getPresignedURLs(files, requestPresignedURL)

          // upload (put) the files to the corresponding presigned urls
          await uploadFilesToPresignedURLs(fileEntities)

          // create the question
          await createQuestion({
            // reload the list of questions and tags after creation
            // TODO: replace with optimistic updates
            refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
            variables: {
              content: JSON.stringify(convertToRaw(content.getCurrentContent())),
              files: fileEntities.map(({ file, fileName }): any => ({
                name: fileName,
                originalName: file.name,
                type: file.type,
              })),
              options,
              tags,
              title,
              type,
            },
          })

          setSubmitting(false)

          router.push('/questions')
        }}
      />
    </TeacherLayout>
  )
}

export default CreateQuestion
