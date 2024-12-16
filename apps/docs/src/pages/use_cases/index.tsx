import {
  faArrowRight,
  faComments,
  faFire,
  faLightbulb,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import UseCaseLayout from '@site/src/components/usecases/UseCaseLayout'
import { H2 } from '@uzh-bf/design-system'
import { USE_CASES, USE_CASE_CATEGORIES } from '../../constants'

function Card({ slug, title, image, abstract }) {
  return (
    <a
      href={`/use_cases/${slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow transition-all hover:shadow-lg"
    >
      <div className="relative h-40 shrink-0 sm:h-48 md:h-56">
        <img
          className="h-full w-full object-cover object-center transition-transform group-hover:scale-105"
          src={image}
          alt={title}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-black/0 p-4">
          <H2 className={{ root: 'text-lg text-white sm:text-xl md:text-2xl' }}>
            {title}
          </H2>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <p className="text-sm text-slate-600 sm:text-base">{abstract}</p>
        <div className="mt-auto border-t pt-4">
          <div className="group-hover:text-primary flex items-center gap-2 text-sm font-medium text-slate-600">
            <FontAwesomeIcon
              icon={faArrowRight}
              className="transition-transform group-hover:translate-x-1"
            />
            <div>More Details</div>
          </div>
        </div>
      </div>
    </a>
  )
}

function CategoryHeader({ title, description, icon }) {
  return (
    <div className="mb-6 flex flex-col items-start gap-4 rounded-lg bg-slate-100 p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="bg-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white">
        <FontAwesomeIcon icon={icon} size="lg" />
      </div>
      <div>
        <H2 className={{ root: 'mb-1 text-xl sm:text-2xl' }}>{title}</H2>
        <p className="mb-0 text-sm text-slate-600 sm:text-base">
          {description}
        </p>
      </div>
    </div>
  )
}

const CATEGORY_ICONS = {
  interaction: faComments,
  engagement: faFire,
  ai_enhanced_learning: faLightbulb,
}

function Index() {
  return (
    <UseCaseLayout path="/use_cases">
      <div className="mt-4 flex flex-col gap-12 pb-8">
        {Object.entries(USE_CASE_CATEGORIES).map(([categoryId, category]) => (
          <div key={categoryId}>
            <CategoryHeader
              title={category.title}
              description={category.description}
              icon={CATEGORY_ICONS[categoryId]}
            />
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
              {category.useCases.map((slug) => {
                const useCase = USE_CASES[slug]
                return (
                  <Card
                    key={slug}
                    slug={slug}
                    title={useCase.title}
                    image={useCase.headerImgSrc}
                    abstract={useCase.abstract}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </UseCaseLayout>
  )
}

export default Index
