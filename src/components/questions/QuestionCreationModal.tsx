import React from 'react'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { convertToRaw } from 'draft-js'
import { Icon, Dropdown, Modal } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import QuestionCreationForm from '../forms/questionManagement/QuestionCreationForm'
import { getPresignedURLs, uploadFilesToPresignedURLs } from '../../lib/utils/files'
import QuestionPoolQuery from '../../graphql/queries/QuestionPoolQuery.graphql'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'
import CreateQuestionMutation from '../../graphql/mutations/CreateQuestionMutation.graphql'
import RequestPresignedURLMutation from '../../graphql/mutations/RequestPresignedURLMutation.graphql'

function QuestionCreationModal(): React.ReactElement {
  const [createQuestion] = useMutation(CreateQuestionMutation)
  const [requestPresignedURL] = useMutation(RequestPresignedURLMutation)
  const { data, loading: tagsLoading } = useQuery(TagListQuery)

  return (
    <Modal
      closeIcon
      size="large"
      trigger={
        <Dropdown.Item>
          <Icon name="plus" />
          <FormattedMessage defaultMessage="Create Question" id="questionPool.button.createQuestion" />
        </Dropdown.Item>
      }
    >
      {/* <Modal.Header>
        <FormattedMessage defaultMessage="Create Question" id="createQuestion.title" />
      </Modal.Header> */}
      <Modal.Content>
        <QuestionCreationForm
          tags={data ? data.tags : []}
          tagsLoading={tagsLoading}
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
              refetchQueries: [{ query: QuestionPoolQuery }, { query: TagListQuery }],
              variables: {
                content: JSON.stringify(convertToRaw(content.getCurrentContent())),
                files: fileEntities.map(({ file, fileName }): any => ({
                  name: fileName,
                  originalName: file.name,
                  type: file.type,
                  description: file.description,
                })),
                options,
                tags,
                title,
                type,
              },
            })

            setSubmitting(false)
          }}
        />
      </Modal.Content>
    </Modal>
  )
}

export default QuestionCreationModal
