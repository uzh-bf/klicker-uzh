import React, { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { convertToRaw } from 'draft-js'
import { Modal } from 'semantic-ui-react'

import QuestionCreationForm from '../forms/questionManagement/QuestionCreationForm'
import { getPresignedURLs, uploadFilesToPresignedURLs } from '../../lib/utils/files'
import QuestionPoolQuery from '../../graphql/queries/QuestionPoolQuery.graphql'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'
import CreateQuestionMutation from '../../graphql/mutations/CreateQuestionMutation.graphql'
import RequestPresignedURLMutation from '../../graphql/mutations/RequestPresignedURLMutation.graphql'

interface Props {
  handleModalOpenChange: (newValue: boolean) => void
  children: ({ setIsModalOpen: any }) => React.ReactChild
}

function QuestionCreationModal({ handleModalOpenChange, children }: Props): React.ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createQuestion] = useMutation(CreateQuestionMutation)
  const [requestPresignedURL] = useMutation(RequestPresignedURLMutation)
  const { data, loading: tagsLoading } = useQuery(TagListQuery)

  useEffect(() => {
    handleModalOpenChange(isModalOpen)
  }, [isModalOpen])

  return (
    <Modal closeOnDimmerClick={false} open={isModalOpen} size="large" trigger={children({ setIsModalOpen })}>
      {/* <Modal.Header>
        <FormattedMessage defaultMessage="Create Question" id="createQuestion.title" />
      </Modal.Header> */}{' '}
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
