import MainStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Main/styles.module.css'
import SidebarStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/Sidebar/styles.module.css'
import DocPageStyles from '@docusaurus/theme-classic/lib/theme/DocRoot/Layout/styles.module.css'
import { ThemeClassNames } from '@docusaurus/theme-common'
import DocSidebar from '@theme/DocSidebar'
import Layout from '@theme/Layout'
import { H1, H2, Tag } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface UseCaseLayoutProps {
  path: string
  headerImgSrc?: string
  title: string
  tags: string[]
  introduction: React.ReactNode
  background: React.ReactNode
  scenario: React.ReactNode
  learnings: React.ReactNode
  goals: string[]
}

function UseCaseLayout({
  path,
  headerImgSrc,
  title,
  tags,
  introduction,
  background,
  scenario,
  learnings,
  goals = [],
}: UseCaseLayoutProps) {
  return (
    <Layout>
      <div className={twMerge(DocPageStyles.docPage, 'flex flex-row')}>
        <aside
          className={twMerge(
            ThemeClassNames.docs.docSidebarContainer,
            SidebarStyles.docSidebarContainer
          )}
        >
          <DocSidebar
            isHidden={false}
            onCollapse={null}
            sidebar={[
              { type: 'link', href: '/use_cases', label: 'Overview' },
              {
                type: 'link',
                href: '/use_cases/live_quiz',
                label: '(Gamified) Live Quizzes',
              },
              {
                type: 'link',
                href: '/use_cases/flipped_classroom',
                label: 'Flipped Classroom',
              },
              {
                type: 'link',
                href: '/use_cases/microlearning',
                label: 'Microlearning',
              },
              {
                type: 'link',
                href: '/use_cases/practive_quiz',
                label: 'Practice Quizzes and Flashcards',
              },
              {
                type: 'link',
                href: '/use_cases/group_activity',
                label: 'Group Activities',
              },
              {
                type: 'link',
                href: '/use_cases/live_qa',
                label: 'Live Q&A and Real-Time Feedback',
              },
              {
                type: 'link',
                href: '/use_cases/gamification',
                label: 'Gamification',
              },
            ]}
            path={path}
          />
        </aside>
        <main className={twMerge(MainStyles.docMainContainer)}>
          <div className={twMerge('m-auto max-w-7xl p-4')}>
            <img
              className={'max-h-20 w-full object-cover md:max-h-80'}
              src={headerImgSrc}
            />
            <div className="grid grid-cols-3 gap-4 md:mt-4 md:gap-8">
              <div className="order-1 col-span-3">
                <H1>{title}</H1>
                <div className="flex flex-row flex-wrap gap-2">
                  {tags?.map((tag) => (
                    <Tag key={tag} label={tag} />
                  ))}
                </div>
              </div>
              <div className="prose order-3 col-span-3 max-w-none md:order-2 md:col-span-2">
                <section id="Introduction">
                  <H2 className={{ root: 'mt-0' }}>Introduction</H2>
                  {introduction}
                </section>
                <section id="Background">
                  <H2>Background</H2>
                  {background}
                </section>
                <section id="Scenario">
                  <H2>Scenario Description with KlickerUZH</H2>
                  {scenario}
                </section>
                <section id="Learnings">
                  <H2>Our Learnings</H2>
                  {learnings}
                </section>
              </div>

              <div className="prose order-2 col-span-3 bg-slate-50 p-4 md:order-2 md:col-span-1 md:rounded">
                <H2>Goals</H2>
                <ul>
                  {goals.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  )
}

export default UseCaseLayout
