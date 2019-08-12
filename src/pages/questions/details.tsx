import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { convertToRaw } from 'draft-js'
import { defineMessages, useIntl } from 'react-intl'
import { useQuery, useMutation } from '@apollo/react-hooks'
import _pick from 'lodash/pick'
import _omitBy from 'lodash/omitBy'
import _isNil from 'lodash/isNil'
import _get from 'lodash/get'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import QuestionEditForm from '../../components/forms/questionManagement/QuestionEditForm'
import { omitDeep, omitDeepArray } from '../../lib/utils/omitDeep'
import { getPresignedURLs, uploadFilesToPresignedURLs } from '../../lib/utils/files'
import useLogging from '../../lib/hooks/useLogging'
import TagListQuery from '../../graphql/queries/TagListQuery.graphql'
import QuestionListQuery from '../../graphql/queries/QuestionListQuery.graphql'
import QuestionDetailsQuery from '../../graphql/queries/QuestionDetailsQuery.graphql'
import ModifyQuestionMutation from '../../graphql/mutations/ModifyQuestionMutation.graphql'
import RequestPresignedURLMutation from '../../graphql/mutations/RequestPresignedURLMutation.graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Edit Question',
    id: 'editQuestion.pageTitle',
  },
  title: {
    defaultMessage: 'Edit Question',
    id: 'editQuestion.title',
  },
})

function EditQuestion(): React.ReactElement {
  useLogging({ slaask: true })

  const intl = useIntl()
  const router = useRouter()

  const { data: tagList, loading: tagsLoading } = useQuery(TagListQuery)
  const { data: questionDetails, loading: questionLoading } = useQuery(QuestionDetailsQuery, {
    variables: { id: router.query.questionId },
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

  const onSubmit = id => isNewVersion => async (
    { title: newTitle, content, options, solution, tags: newTags, files },
    { setSubmitting }
  ) => {
    // split files into newly added and existing entities
    const existingFiles = files.filter(file => file.id)
    const newFiles = files.filter(file => !file.id)

    // request presigned urls and filenames for newly added files
    const fileEntities = await getPresignedURLs(newFiles, requestPresignedURL)

    // upload (put) the new files to the corresponding presigned urls
    await uploadFilesToPresignedURLs(fileEntities)

    // combine existing files and newly uploaded files into a single array
    const allFiles = existingFiles.concat(
      fileEntities.map(({ id: fileId, file, fileName }) => ({
        id: fileId,
        name: fileName,
        originalName: file.name,
        type: file.type,
      }))
    )

    // modify the question
    await editQuestion({
      // reload the question details and tags after update
      // TODO: replace with optimistic updates
      refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
      // update the cache after the mutation has completed
      update: (store, { data: { modifyQuestion } }) => {
        const query = {
          query: QuestionDetailsQuery,
          variables: { id: router.query.questionId },
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

  return (
    <TeacherLayout
      navbar={{
        title: intl.formatMessage(messages.title),
      }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'editQuestion' }}
    >
      {() => {
        // if the tags or the question is still loading, return null
        if (tagsLoading || questionLoading || !tagList.tags || !questionDetails.question) {
          return null
        }

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
            handleDiscard={() => {
              router.push('/questions')
            }}
            handleSubmit={onSubmit(id)}
            loading={loading}
            questionTags={tags}
            title={title}
            type={type}
            versions={versions}
          />
        )
      }}
    </TeacherLayout>
  )
}

export default EditQuestion
