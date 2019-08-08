import React from 'react'
import { useRouter } from 'next/router'
import { compose } from 'recompose'
import { Query, Mutation } from 'react-apollo'
import { defineMessages, useIntl } from 'react-intl'
import { convertToRaw } from 'draft-js'

import { TeacherLayout } from '../../components/layouts'
import { QuestionCreationForm } from '../../components/forms'
import { withDnD, getPresignedURLs, uploadFilesToPresignedURLs } from '../../lib'
import { QuestionListQuery, TagListQuery, CreateQuestionMutation, RequestPresignedURLMutation } from '../../graphql'
import useLogging from '../../lib/useLogging'

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

  return (
    <TeacherLayout
      navbar={{
        title: intl.formatMessage(messages.title),
      }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'createQuestion' }}
    >
      <Query query={TagListQuery}>
        {({ data, loading: tagsLoading }) => (
          <Mutation mutation={CreateQuestionMutation}>
            {createQuestion => (
              <Mutation mutation={RequestPresignedURLMutation}>
                {requestPresignedURL => (
                  <QuestionCreationForm
                    tags={data.tags}
                    tagsLoading={tagsLoading}
                    // handle discarding a new question
                    onDiscard={() => router.push('/questions')}
                    // handle submitting a new question
                    onSubmit={async (
                      { content, options, tags, title, type, files },
                      { setSubmitting }
                    ): Promise<void> => {
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
                          files: fileEntities.map(({ file, fileName }) => ({
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
                )}
              </Mutation>
            )}
          </Mutation>
        )}
      </Query>
    </TeacherLayout>
  )
}

export default compose(withDnD)(CreateQuestion)
