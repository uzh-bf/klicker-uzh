import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetLearningElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

function Repetition() {
  const { data } = useQuery(GetLearningElementsDocument)

  return (
    <Layout courseName="KlickerUZH" displayName="Kursübersicht">
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className="text-xl">Repetition</H1>
        {data?.learningElements.map((element) => (
          <Link href={`/course/${element.courseId}/element/${element.id}`}>
            <Button
              className={twMerge(
                'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 hover:bg-uzh-grey-40'
              )}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faBookOpenReader} />
              </Button.Icon>
              <Button.Label className="flex-1 text-left">
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
