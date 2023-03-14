import { useQuery } from '@apollo/client'
import { GetUserTagsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import Folder from './Folder'

function QuestionFolders() {
  const router = useRouter()
  const { data, loading, error } = useQuery(GetUserTagsDocument)

  if (loading) {
    return <div>Loading...</div>
  }

  if (!loading && error) {
    router.push('/404')
    return <></>
  }

  return (
    <div className="ml-8">
      <div className="grid grid-cols-2 text-center gap-y-4 lg:grid-cols-3 xl:grid-cols-4">
        <Folder key="..." name="..." />
        {data?.userTags?.map((tag) => (
          <Folder key={tag.id} name={tag.name} />
        ))}
        <Folder key="unassigned" name="Unassigned" />
      </div>
    </div>
  )
}

export default QuestionFolders
