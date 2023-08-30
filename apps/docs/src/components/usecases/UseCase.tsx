import { H1, H2, Tag } from '@uzh-bf/design-system'
import UseCaseLayout from './UseCaseLayout'

import { USE_CASES } from '../../constants'

interface UseCaseProps {
  slug: string
}

function UseCase({ slug }: UseCaseProps) {
  const useCase = USE_CASES[slug]

  return (
    <UseCaseLayout path={`/use_cases/${slug}`}>
      <img
        className={'max-h-20 w-full object-cover md:max-h-80'}
        src={useCase.headerImgSrc}
      />
      <div className="grid grid-cols-3 gap-4 md:mt-4 md:gap-8">
        <div className="order-1 col-span-3">
          <H1>{useCase.title}</H1>
          <div className="flex flex-row flex-wrap gap-2">
            {useCase.tags?.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>
        </div>
        <div className="prose order-3 col-span-3 max-w-none md:order-2 md:col-span-2">
          <section id="Introduction">
            <H2 className={{ root: 'mt-0' }}>Introduction</H2>
            {useCase.introduction}
          </section>
          <section id="Background">
            <H2>Background</H2>
            {useCase.background}
          </section>
          <section id="Scenario">
            <H2>Scenario Description with KlickerUZH</H2>
            {useCase.scenario}
          </section>
          <section id="Learnings">
            <H2>Our Learnings</H2>
            {useCase.learnings}
          </section>
        </div>

        <div className="prose order-2 col-span-3 bg-slate-50 p-4 md:order-2 md:col-span-1 md:rounded">
          <H2>Goals</H2>
          <ul>
            {useCase.goals?.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </div>
      </div>
    </UseCaseLayout>
  )
}

export default UseCase
