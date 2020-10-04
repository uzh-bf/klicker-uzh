import React, { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { convertToRaw } from 'draft-js'
import { Modal } from 'semantic-ui-react'
import _pick from 'lodash/pick'
import _omitBy from 'lodash/omitBy'
import _isNil from 'lodash/isNil'
import _get from 'lodash/get'

import QuestionEditForm from '../forms/questionManagement/QuestionEditForm'
import { getPresignedURLs, uploadFilesToPresignedURLs } from '../../lib/utils/files'
import QuestionPoolQuery from '../../graphql/queries/QuestionPoolQuery.graphql'
import QuestionDetailsQuery from '../../graphql/queries/QuestionDetailsQuery.graphql'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'
import ModifyQuestionMutation from '../../graphql/mutations/ModifyQuestionMutation.graphql'
import RequestPresignedURLMutation from '../../graphql/mutations/RequestPresignedURLMutation.graphql'
import { omitDeep, omitDeepArray } from '../../lib/utils/omitDeep'

interface Props {
  isOpen: boolean
  handleSetIsOpen: (boolean) => void
  questionId: string
}

function QuestionDetailsModal({ isOpen, handleSetIsOpen, questionId }: Props): React.ReactElement {
  const { data: tagList, loading: tagsLoading } = useQuery(TagListQuery)
  const { data: questionDetails, loading: questionLoading } = useQuery(QuestionDetailsQuery, {
    variables: { id: questionId },
  })
  const [editQuestion, { loading, data, error }] = useMutation(ModifyQuestionMutation)
  const [requestPresignedURL] = useMutation(RequestPresignedURLMutation)

  const [activeVersion, setActiveVersion] = useState(0)

  // if the question has finished loading, set the activeVersion state to the latest version
  useEffect((): void => {
    const versions = _get(questionDetails, 'question.versions')
    if (versions) {
      setActiveVersion(versions.length)
    }
  }, [questionLoading])

  const onSubmit = (id: string): any => (isNewVersion: boolean): any => async (
    { title: newTitle, content, options, solution, tags: newTags, files },
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
        description: file.description,
      }))
    )

    // modify the question
    await editQuestion({
      // reload the question details and tags after update
      // TODO: replace with optimistic updates
      refetchQueries: [{ query: QuestionPoolQuery }, { query: TagListQuery }],
      // update the cache after the mutation has completed
      update: (store, { data: { modifyQuestion } }): void => {
        const query = {
          query: QuestionDetailsQuery,
          variables: { id: questionId },
        }

        // get the data from the store
        const cache: any = store.readQuery(query)

        cache.question.title = modifyQuestion.title
        cache.question.versions = modifyQuestion.versions
        cache.question.tags = modifyQuestion.tags

        // write the updated data to the store
        store.writeQuery({
          ...query,
          data: cache,
        })
      },
      variables: _omitBy(
        isNewVersion
          ? {
              content: JSON.stringify(convertToRaw(content.getCurrentContent())),
              files: omitDeepArray(allFiles, '__typename'),
              id,
              // HACK: omitDeep for typename removal
              // TODO: check https://github.com/apollographql/apollo-client/issues/1564
              // this shouldn't be necessary at all
              options: options && omitDeep(options, '__typename'),
              solution,
              tags: newTags,
              title: newTitle,
            }
          : {
              id,
              tags: newTags,
              title: newTitle,
            },
        _isNil
      ),
    })

    setActiveVersion(activeVersion + 1)
    setSubmitting(false)
  }

  // if the tags or the question is still loading, return null
  if (tagsLoading || questionLoading || !tagList || !tagList.tags || !questionDetails || !questionDetails.question) {
    return null
  }

  return (
    <Modal
      closeOnDimmerClick={false}
      open={isOpen}
      size="large"
      // we don't want to have ESC close the modal, so don't do this
      // onClose={(): void => setIsModalOpen(false)}
    >
      {/* <Modal.Header>
        <FormattedMessage defaultMessage="Edit Question" id="editQuestion.title" />
      </Modal.Header> */}
      <Modal.Content>
        {((): React.ReactElement => {
          // if everything was loaded successfully, render the edit form
          const { id, tags, title, type, versions } = _pick(questionDetails.question, [
            'id',
            'tags',
            'title',
            'type',
            'versions',
          ])

          return (
            <QuestionEditForm
              activeVersion={activeVersion}
              allTags={tagList.tags}
              editSuccess={{
                message: (error && error.message) || null,
                success: (data && !error) || null,
              }}
              handleActiveVersionChange={setActiveVersion}
              handleDiscard={(): void => handleSetIsOpen(false)}
              handleSubmit={onSubmit(id)}
              loading={loading}
              questionTags={tags}
              title={title}
              type={type}
              versions={versions}
            />
          )
        })()}
      </Modal.Content>
    </Modal>
  )
}

export default QuestionDetailsModal
