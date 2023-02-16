import { useQuery } from '@apollo/client'
import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetLearningElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import Layout from '../components/Layout'

function Repetition() {
  const { data } = useQuery(GetLearningElementsDocument)

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName="Repetition Lernelemente"
    >
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>Repetition</H1>
        {data?.learningElements?.map((element) => (
          <Link
            key={element.id}
            href={`/course/${element.courseId}/element/${element.id}`}
            legacyBehavior
          >
            <Button
              className={{
                root: twMerge(
                  'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 hover:bg-uzh-grey-40'
                ),
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faBookOpenReader} />
              </Button.Icon>
              <Button.Label className={{ root: 'flex-1 text-left' }}>
                <div>{element.displayName}</div>
              </Button.Label>
            </Button>
          </Link>
        ))}
      </div>
    </Layout>
  )
}

export default Repetition
