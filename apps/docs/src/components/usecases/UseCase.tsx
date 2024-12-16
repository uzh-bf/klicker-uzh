import { faBook, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { H1, H2, Tag } from '@uzh-bf/design-system'
import { USE_CASES } from '../../constants'
import UseCaseLayout from './UseCaseLayout'

interface UseCaseProps {
  slug: string
}

function UseCase({ slug }: UseCaseProps) {
  const useCase = USE_CASES[slug]

  return (
    <UseCaseLayout path={`/use_cases/${slug}`}>
      <img
        className="h-32 w-full object-cover sm:h-48 md:h-64 lg:h-80"
        src={useCase.headerImgSrc}
      />
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3 lg:gap-8 lg:p-0 lg:pt-8">
        <div className="col-span-1 lg:col-span-3">
          <H1 className={{ root: 'mb-4' }}>{useCase.title}</H1>
          <div className="flex flex-row flex-wrap gap-2">
            {useCase.tags?.map((tag) => <Tag key={tag} label={tag} />)}
          </div>
        </div>

        <div className="prose col-span-1 max-w-none lg:col-span-2">
          <section id="Introduction" className="mb-8">
            <H2 className={{ root: 'mt-0' }}>Introduction</H2>
            {useCase.introduction}
          </section>
          <section id="Background" className="mb-8">
            <H2>Background</H2>
            {useCase.background}
          </section>
          <section id="Scenario" className="mb-8">
            <H2>Scenario Description with KlickerUZH</H2>
            {useCase.scenario}
          </section>
          <section id="Learnings" className="mb-8">
            <H2>Our Learnings</H2>
            {useCase.learnings}
          </section>
        </div>

        <div className="prose sticky top-4 col-span-1 h-fit bg-slate-100 p-4 shadow-sm lg:rounded-lg">
          <H2 className={{ root: 'mb-2 text-slate-600' }}>Goals</H2>
          <div className="space-y-2 text-sm">
            {useCase.goals?.map((goal, index) => {
              // Check if the goal is a nested structure
              if (Array.isArray(goal)) {
                const [category, subgoals] = goal
                return (
                  <div key={index} className="space-y-2">
                    <div className="font-bold text-slate-600">{category}</div>
                    {subgoals.map((subgoal, subIndex) => (
                      <div key={subIndex} className="flex items-start gap-3">
                        <FontAwesomeIcon
                          icon={faCircleCheck}
                          className="mt-1 text-slate-400"
                        />
                        <div>{subgoal}</div>
                      </div>
                    ))}
                  </div>
                )
              }
              // Handle flat goal structure
              return (
                <div key={index} className="flex items-start gap-3">
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="mt-1 text-slate-400"
                  />
                  <div>{goal}</div>
                </div>
              )
            })}
          </div>

          {useCase.references && (
            <div className="mt-8">
              <H2 className={{ root: 'mb-2 text-slate-600' }}>References</H2>
              <div className="space-y-2 text-sm">
                {useCase.references?.map((reference, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <FontAwesomeIcon
                      icon={faBook}
                      className="mt-1 text-slate-400"
                    />
                    <div>{reference}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </UseCaseLayout>
  )
}

export default UseCase
