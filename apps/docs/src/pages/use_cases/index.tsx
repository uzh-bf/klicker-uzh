import Link from '@docusaurus/Link'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Button, H1, H3 } from '@uzh-bf/design-system'
import { useState } from 'react'
import { useCases } from '../../constants'

function Card({ title, image, children, detailsRef }) {
  return (
    <div className="mt-4 flex max-h-80 flex-row rounded-xl bg-slate-100">
      <div className="flex flex-1 flex-col justify-center p-8 md:p-16">
        <H3 className={{ root: 'text-xl' }}>{title}</H3>
        <p className="font-sans text-lg">{children}</p>
        <div>
          <Link href={`/use_cases/${detailsRef}`}>
            <Button>
              <>
                <FontAwesomeIcon icon={faArrowRight} />
                Read More
              </>
            </Button>
          </Link>
        </div>
      </div>
      <div className="relative hidden flex-1 items-center justify-items-center md:flex">
        <img className="h-full w-full rounded-r-xl object-cover" src={image} />
      </div>
    </div>
  )
}

function Index() {
  const [filteredUseCases, setFilteredUseCases] = useState(useCases)

  return (
    <Layout>
      <div className="m-auto grid max-w-7xl grid-cols-5 items-start gap-4 p-4 pt-8">
        <div className="col-span-1 hidden rounded-xl border shadow md:grid">
          SIDEBAR
        </div>
        <div className="col-span-5 md:col-span-4">
          <div onClick={() => setFilteredUseCases(useCases)}>
            <H1>Use Cases</H1>
          </div>
          {filteredUseCases.map((useCase) => (
            <Card
              title={useCase.title}
              image={useCase.imageSrc}
              detailsRef={useCase.detailsRef}
            >
              {useCase.description}
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default Index
