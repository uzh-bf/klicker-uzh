import React from 'react'
import { useQuery, useMutation } from '@apollo/client'

import { convertToMd } from '../../lib/utils/slateMdConversion'
import { getPresignedURLs, uploadFilesToPresignedURLs } from '../../lib/utils/files'
import QuestionPoolQuery from '../../graphql/queries/QuestionPoolQuery.graphql'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'
import CreateQuestionMutation from '../../graphql/mutations/CreateQuestionMutation.graphql'
import RequestPresignedURLMutation from '../../graphql/mutations/RequestPresignedURLMutation.graphql'
import CustomModal from '../common/CustomModal'
import QuestionCreationForm from '../forms/questionManagement/QuestionCreationForm'

interface Props {
  trigger: React.ReactNode
  open: boolean
  onModalClose: () => void
  className?: string
}

const defaultProps = { className: '' }

function QuestionCreationModal({ trigger, open, onModalClose, className }: Props): React.ReactElement {
  const [createQuestion] = useMutation(CreateQuestionMutation)
  const [requestPresignedURL] = useMutation(RequestPresignedURLMutation)
  const { data, loading: tagsLoading } = useQuery(TagListQuery)

  return (
    <CustomModal className={className} open={open} trigger={trigger}>
      <QuestionCreationForm
        tags={data ? data.tags : []}
        tagsLoading={tagsLoading}
        onDiscard={(): void => onModalClose()}
        // handle submitting a new question
        onSubmit={async ({ content, options, tags, title, type, files }, { setSubmitting }): Promise<void> => {
          // request presigned urls and filenames for all files
          const fileEntities = await getPresignedURLs(files, requestPresignedURL)

          // upload (put) the files to the corresponding presigned urls
          await uploadFilesToPresignedURLs(fileEntities)

          // create the question
          await createQuestion({
            // reload the list of questions and tags after creation
            refetchQueries: [{ query: QuestionPoolQuery }, { query: TagListQuery }],
            variables: {
              content: convertToMd(content),
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
          onModalClose()
        }}
      />
    </CustomModal>
  )
}

QuestionCreationModal.defaultProps = defaultProps
export default QuestionCreationModal
