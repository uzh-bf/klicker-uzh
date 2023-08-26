import Link from '@docusaurus/Link'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import UseCaseLayout from '@site/src/components/usecases/UseCaseLayout'
import { Button, H1, H3 } from '@uzh-bf/design-system'
import USE_CASES from '../../constants'

function Card({ slug, title, image, abstract }) {
  return (
    <div className="mt-4 flex max-h-80 flex-row rounded-xl bg-slate-100">
      <div className="flex flex-1 flex-col justify-center p-8 md:p-16">
        <H3 className={{ root: 'text-xl' }}>{title}</H3>
        <p className="font-sans text-lg">{abstract}</p>
        <div>
          <Link href={`/use_cases/${slug}`}>
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
  return (
    <UseCaseLayout path="/use_cases">
      <H1>Use Cases</H1>
      {Object.entries(USE_CASES).map(([slug, useCase]) => (
        <Card
          key={useCase.title}
          slug={slug}
          title={useCase.title}
          image={useCase.headerImgSrc}
          abstract={useCase.abstract}
        />
      ))}
    </UseCaseLayout>
  )
}

export default Index
