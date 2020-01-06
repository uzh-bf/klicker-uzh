import React, { useState } from 'react'
import _pick from 'lodash/pick'
import _omitBy from 'lodash/omitBy'
import _isNil from 'lodash/isNil'
import { ContentState, convertFromRaw, convertToRaw, EditorState } from 'draft-js'
import { useQuery, useMutation } from '@apollo/react-hooks'
import { Button, Modal } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import QuestionCreationForm from '../forms/questionManagement/QuestionCreationForm'
import QuestionPoolQuery from '../../graphql/queries/QuestionPoolQuery.graphql'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'
import QuestionDetailsQuery from '../../graphql/queries/QuestionDetailsQuery.graphql'
import CreateQuestionMutation from '../../graphql/mutations/CreateQuestionMutation.graphql'
import RequestPresignedURLMutation from '../../graphql/mutations/RequestPresignedURLMutation.graphql'
import { getPresignedURLs, uploadFilesToPresignedURLs } from '../../lib/utils/files'
import { omitDeepArray, omitDeep } from '../../lib/utils/omitDeep'
import { QUESTION_TYPES } from '../../constants'

interface Props {
  questionId: string
}

function QuestionDuplicationModal({ questionId }: Props): React.ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createQuestion] = useMutation(CreateQuestionMutation)
  const [requestPresignedURL] = useMutation(RequestPresignedURLMutation)
  const { data: questionDetails, loading: questionLoading } = useQuery(QuestionDetailsQuery, {
    variables: { id: questionId },
  })
  const { data: tagList, loading: tagsLoading } = useQuery(TagListQuery)

  const onSubmit = async (
    // eslint-disable-next-line no-shadow
    { content, options, tags, title, type, files, solution },
    { setSubmitting }
  ): Promise<void> => {
    // split files into newly added and existing entities
    const existingFiles = files.filter((file): boolean => !!file.id)
    const newFiles = files.filter((file): boolean => !file.id)

    // request presigned urls and filenames for newly added files
    const fileEntities = await getPresignedURLs(newFiles, requestPresignedURL)

    // upload (put) the new files to the corresponding presigned urls
    await uploadFilesToPresignedURLs(fileEntities)

    // combine existing files and newly uploaded files into a single array
    const allFiles = existingFiles.concat(
      fileEntities.map(({ id: fileId, file, fileName }): any => ({
        id: fileId,
        name: fileName,
        originalName: file.name,
        type: file.type,
      }))
    )

    // create the question
    await createQuestion({
      refetchQueries: [{ query: QuestionPoolQuery }, { query: TagListQuery }],
      variables: _omitBy(
        {
          content: JSON.stringify(convertToRaw(content.getCurrentContent())),
          files: omitDeepArray(allFiles, '__typename'),
          // HACK: omitDeep for typename removal
          // TODO: check https://github.com/apollographql/apollo-client/issues/1564
          options: options && omitDeep(options, '__typename'),
          solution,
          tags,
          title,
          type,
        },
        _isNil
      ),
    })
    setSubmitting(false)
    setIsModalOpen(false)
  }

  return (
    <Modal
      closeOnDimmerClick={false}
      open={isModalOpen}
      size="large"
      trigger={
        <Button fluid onClick={(): void => setIsModalOpen(true)}>
          <FormattedMessage defaultMessage="Duplicate" id="questionDetails.button.duplicate" />
        </Button>
      }
      onClose={(): void => setIsModalOpen(false)}
    >
      {/* <Modal.Header>
        <FormattedMessage defaultMessage="Create Question" id="createQuestion.title" />
      </Modal.Header> */}
      <Modal.Content>
        {((): React.ReactElement => {
          if (tagsLoading || questionLoading || !tagList.tags || !questionDetails.question) {
            return null
          }

          const { tags, title, type, versions } = _pick(questionDetails.question, ['tags', 'title', 'type', 'versions'])

          const duplicateTitle = ' (Duplicate)'

          // When duplicating, duplicate newest version of the question
          const initializeVersion = versions.length - 1

          // Depending on original question type, populate newly created question instance
          // with missing fields.
          const prepForm = versions
          switch (type) {
            case QUESTION_TYPES.FREE:
              prepForm[initializeVersion].options = []
              prepForm[initializeVersion].options[type] = {
                choices: [],
                randomized: false,
                restrictions: {
                  max: null,
                  min: null,
                },
              }
              break
            case QUESTION_TYPES.FREE_RANGE:
              prepForm[initializeVersion].options[type].choices = []
              prepForm[initializeVersion].options[type].randomized = false
              break
            case QUESTION_TYPES.MC:
              prepForm[initializeVersion].options[type].randomized = false
              prepForm[initializeVersion].options[type].restrictions = {
                max: null,
                min: null,
              }
              break
            case QUESTION_TYPES.SC:
              prepForm[initializeVersion].options[type].randomized = false
              prepForm[initializeVersion].options[type].restrictions = {
                max: null,
                min: null,
              }
              break
            default:
              break
          }

          const initialValues = {
            content: prepForm[initializeVersion].content
              ? EditorState.createWithContent(convertFromRaw(JSON.parse(prepForm[initializeVersion].content)))
              : EditorState.createWithContent(ContentState.createFromText(prepForm[initializeVersion].description)),
            files: prepForm[initializeVersion].files || [],
            options: prepForm[initializeVersion].options[type] || {},
            tags: tags.map((tag): string => tag.name),
            title: title + duplicateTitle,
            type,
            versions: prepForm,
          }

          return (
            <QuestionCreationForm
              isInitialValid
              initialValues={initialValues}
              tags={tagList.tags}
              tagsLoading={tagsLoading}
              onDiscard={(): void => setIsModalOpen(false)}
              // handle submitting a new question
              onSubmit={onSubmit}
            />
          )
        })()}
      </Modal.Content>
    </Modal>
  )
}

export default QuestionDuplicationModal
