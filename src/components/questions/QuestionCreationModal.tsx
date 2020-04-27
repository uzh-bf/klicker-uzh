import React, { useState } from 'react'
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createQuestion] = useMutation(CreateQuestionMutation)
  const [requestPresignedURL] = useMutation(RequestPresignedURLMutation)
  const { data, loading: tagsLoading } = useQuery(TagListQuery)

  return (
    <Modal
      closeOnDimmerClick={false}
      open={isModalOpen}
      size="large"
      trigger={
        <Dropdown.Item onClick={(): void => setIsModalOpen(true)}>
          <Icon name="question circle" />
          <FormattedMessage defaultMessage="New Question" id="questionPool.button.createQuestion" />
        </Dropdown.Item>
      }
      // we don't want to have ESC close the modal, so don't do this
      // onClose={(): void => setIsModalOpen(false)}
    >
      {/* <Modal.Header>
        <FormattedMessage defaultMessage="Create Question" id="createQuestion.title" />
      </Modal.Header> */}
      <Modal.Content>
        <QuestionCreationForm
          tags={data ? data.tags : []}
          tagsLoading={tagsLoading}
          onDiscard={(): void => setIsModalOpen(false)}
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
            setIsModalOpen(false)
          }}
        />
      </Modal.Content>
    </Modal>
  )
}

export default QuestionCreationModal
