import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import UseCaseLayout from '@site/src/components/usecases/UseCaseLayout'
import { H1, H2 } from '@uzh-bf/design-system'
import { USE_CASES } from '../../constants'

function Card({ slug, title, image, abstract }) {
  return (
    <div className="flex flex-col rounded-xl bg-slate-100 md:flex-row">
      <div className="order-2 flex-1 space-y-4 p-8 md:order-1 md:p-16">
        <H2>{title}</H2>
        <p className="font-sans text-lg">{abstract}</p>
        <div>
          <a
            className="inline-flex items-center gap-2"
            href={`/use_cases/${slug}`}
          >
            <FontAwesomeIcon icon={faArrowRight} />
            <div>More Details</div>
          </a>
        </div>
      </div>
      <div className="order-1 flex-1 md:order-2">
        <img className="h-full w-full rounded-r-xl object-cover" src={image} />
      </div>
    </div>
  )
}

function Index() {
  return (
    <UseCaseLayout path="/use_cases">
      <H1>Use Cases</H1>
      <div className="w-full space-y-4">
        {Object.entries(USE_CASES).map(([slug, useCase]) => (
          <Card
            key={useCase.title}
            slug={slug}
            title={useCase.title}
            image={useCase.headerImgSrc}
            abstract={useCase.abstract}
          />
        ))}
      </div>
    </UseCaseLayout>
  )
}

export default Index
