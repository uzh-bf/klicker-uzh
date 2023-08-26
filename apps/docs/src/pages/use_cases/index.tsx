import Link from '@docusaurus/Link'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import UseCaseLayout from '@site/src/components/usecases/UseCaseLayout'
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
              <FontAwesomeIcon icon={faArrowRight} />
              Read More
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
    <UseCaseLayout path="/use_cases">
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
    </UseCaseLayout>
  )
}

export default Index
