import { IconProp } from '@fortawesome/fontawesome-svg-core'
import {
  faBook,
  faBookOpen,
  faCircleCheck,
  faHandshake,
  faLightbulb,
  faToolbox,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { H1, H2, Tag } from '@uzh-bf/design-system'
import { USE_CASES } from '../../constants'
import UseCaseLayout from './UseCaseLayout'

interface SectionHeaderProps {
  icon: IconProp
  header: string
}

function SectionHeader({ icon, header }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-row items-center gap-4 rounded bg-slate-100 p-4 text-slate-700">
      <FontAwesomeIcon icon={icon} className="text-3xl" />
      <H2 className={{ root: 'm-0!' }}>{header}</H2>
    </div>
  )
}

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
        alt={`${useCase.title} header`}
      />
      <div className="grid grid-cols-1 gap-4 md:p-4 lg:grid-cols-3 lg:gap-8 lg:p-0 lg:pt-8">
        <div className="col-span-1 lg:col-span-3">
          <H1 className={{ root: 'mb-4' }}>{useCase.title}</H1>
          <div className="flex flex-row flex-wrap gap-2">
            {useCase.tags?.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>
        </div>

        <div className="prose sticky top-4 order-1 col-span-1 h-fit bg-slate-100 p-4 shadow-sm md:order-2 lg:rounded-lg">
          <H2 className={{ root: 'mb-2 text-slate-600' }}>Goals</H2>
          <div className="space-y-2 text-sm">
            {useCase.goals?.map((goal) => {
              // Check if the goal is a nested structure
              if (Array.isArray(goal)) {
                const [category, subgoals] = goal
                return (
                  <div key={`goal-${category}`} className="space-y-2">
                    <div className="font-bold text-slate-600">{category}</div>
                    {subgoals.map((subgoal) => (
                      <div
                        key={`subgoal-${category}-${subgoal}`}
                        className="flex items-start gap-3"
                      >
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
                <div key={`goal-${goal}`} className="flex items-start gap-3">
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
                {useCase.references?.map((reference) => (
                  <div
                    key={`reference-${reference}`}
                    className="flex items-start gap-3"
                  >
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

        <div className="prose order-2 col-span-1 max-w-none md:order-1 lg:col-span-2">
          <section id="Introduction">{useCase.introduction}</section>
        </div>

        <div className="prose order-3 col-span-1 max-w-none lg:col-span-3">
          <section id="Background" className="mb-12">
            <SectionHeader icon={faBookOpen} header="Background" />
            {useCase.background}
          </section>

          <section id="Scenario" className="mb-12">
            <SectionHeader
              icon={faToolbox}
              header="Scenario Description with KlickerUZH"
            />
            {useCase.scenario}
          </section>

          <section id="Learnings" className="mb-8">
            <SectionHeader icon={faLightbulb} header="Our Learnings" />
            {useCase.learnings}
          </section>

          {useCase.acknowledgements && (
            <section id="Acknowledgements" className="mb-8">
              <SectionHeader icon={faHandshake} header="Acknowledgements" />
              {useCase.acknowledgements}
            </section>
          )}
        </div>
      </div>
    </UseCaseLayout>
  )
}

export default UseCase
