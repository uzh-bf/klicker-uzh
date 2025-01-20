import { useQuery } from '@apollo/client'
import {
  faPlayCircle,
  faQuestionCircle,
} from '@fortawesome/free-regular-svg-icons'
import { faBolt, faUser } from '@fortawesome/free-solid-svg-icons'
import {
  GetCollectionSharingRequestsDocument,
  GetUserCoursesDocument,
  GetUserRunningLiveQuizzesDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import { Navigation, NavigationItemProps } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SupportModal from './SupportModal'

interface HeaderProps {
  user?: User | null
}

function Header({ user }: HeaderProps): React.ReactElement {
  const router = useRouter()
  const t = useTranslations()
  const [showSupportModal, setShowSupportModal] = useState(false)

  const { data: requestData } = useQuery(GetCollectionSharingRequestsDocument) // TODO: generalize this query for the new catalogue
  const { data: liveQuizData } = useQuery(GetUserRunningLiveQuizzesDocument, {
    fetchPolicy: 'cache-first',
  })
  const { data: courseData } = useQuery(GetUserCoursesDocument, {
    fetchPolicy: 'cache-first',
  })

  const quizzes = liveQuizData?.userRunningLiveQuizzes
  const courses = courseData?.userCourses

  const leftNavigation: NavigationItemProps[] = [
    {
      type: 'button',
      key: 'library-menubar-item',
      label: t('manage.general.library'),
      onClick: () => router.push('/'),
      active: router.pathname == '/',
      data: { cy: 'library' },
    },
    {
      type: 'button',
      key: 'live-quizzes-menubar-item',
      label: t('manage.general.liveQuizzes'),
      onClick: () => router.push('/quizzes'),
      active: router.pathname == '/quizzes',
      data: { cy: 'live-quizzes' },
    },
    {
      type: 'button',
      key: 'courses-menubar-item',
      label: t('manage.general.courses'),
      onClick: () => router.push('/courses'),
      active: router.pathname == '/courses',
      data: { cy: 'courses' },
    },
    {
      type: 'button',
      key: 'resources-menubar-item',
      label: t('manage.general.resources'),
      icon: faBolt,
      onClick: () => router.push('/resources'),
      active: router.pathname == '/resources',
      data: { cy: 'resources' },
      className: { icon: 'text-orange-400' },
    },
    ...(user?.featurePreview
      ? [
          {
            type: 'dropdown',
            key: 'analytics-menubar-item',
            label: t('manage.general.analytics'),
            icon: faBolt,
            active: router.pathname.includes('/analytics'),
            elements: [
              ...(courses?.slice(0, 5).map((course) => ({
                key: `course-analytics-${course.id}`,
                type: 'submenu',
                label: course.name,
                data: { cy: `course-analytics-menu-${course.name}` },
                options: [
                  {
                    key: `activity-dashboard-${course.name}`,
                    type: 'link',
                    label: t('manage.analytics.activity'),
                    onClick: () =>
                      router.push(`/analytics/${course.id}/activity`),
                  },
                  {
                    key: `progress-dashboard-${course.name}`,
                    type: 'link',
                    label: t('manage.analytics.performance'),
                    onClick: () =>
                      router.push(`/analytics/${course.id}/performance`),
                  },
                  {
                    key: `quiz-dashboard-${course.name}`,
                    type: 'link',
                    label: t('manage.analytics.quizzes'),
                    onClick: () =>
                      router.push(`/analytics/${course.id}/quizzes`),
                  },
                ],
              })) ?? []),
              {
                key: 'analytics-all-courses-separator',
                type: 'separator',
              },
              {
                key: 'analytics-all-courses',
                type: 'link',
                label: t('manage.analytics.olderCourses'),
                onClick: () => router.push('/analytics'),
              },
            ],
            data: { cy: 'analytics' },
            className: { icon: 'text-orange-400' },
          } as NavigationItemProps,
        ]
      : []),
  ]

  const rightNavigation: NavigationItemProps[] = [
    {
      type: 'button',
      key: 'support-menubar-item',
      icon: faQuestionCircle,
      onClick: () => setShowSupportModal(true),
      className: { icon: '-mx-1 ' },
    },
    {
      type: 'dropdown',
      key: 'quizzes-menubar-dropdown',
      icon: faPlayCircle,
      disabled: !quizzes || quizzes.length === 0,
      className: {
        content: 'border-green-600 mr-1 mt-0.5',
        icon: twMerge(
          '-mx-1',
          quizzes?.length !== 0 ? 'text-green-600' : 'text-slate-400'
        ),
      },
      elements:
        quizzes?.map((quiz) => ({
          key: quiz.id,
          type: 'link',
          label: quiz.name,
          onClick: () => router.push(`/quizzes/${quiz.id}/cockpit`),
        })) ?? [],
    },
    {
      type: 'dropdown',
      key: 'user-menubar-dropdown',
      label: user?.shortname ?? '',
      icon: faUser,
      data: { cy: 'user-menu' },
      elements: [
        {
          key: 'settings',
          type: 'link',
          label: t('shared.generic.settings'),
          onClick: () => router.push('/user/settings'),
          data: { cy: 'menu-user-settings' },
        },
        {
          key: 'token',
          type: 'link',
          label: t('manage.general.generateToken'),
          onClick: () => router.push('/token'),
          data: { cy: 'token-generation-page' },
        },
        {
          key: 'separator-token-logout',
          type: 'separator',
        },
        {
          key: 'logout',
          type: 'link',
          label: t('shared.generic.logout'),
          onClick: () =>
            router.push(process.env.NEXT_PUBLIC_AUTH_URL + '/logout'),
          data: { cy: 'logout' },
        },
      ],
      className: {
        content: 'mr-1',
      },
    },
  ]

  return (
    <>
      <div
        className="flex h-full w-full flex-row items-center justify-between border-b border-slate-300 bg-slate-100 font-bold text-slate-700 print:!hidden"
        data-cy="navigation"
      >
        <div className="ml-4 flex flex-row items-center gap-1.5">
          <Image
            src="/img/klicker_icon_transparent.png"
            alt="KlickerUZH Logo"
            width={35}
            height={35}
            onClick={() => router.push('/')}
            className="hover:cursor-pointer"
          />
          <Navigation items={leftNavigation} />
        </div>
        <Navigation
          items={rightNavigation}
          className={{ root: '-gap-1 flex flex-row' }}
        />
      </div>
      <SupportModal
        open={showSupportModal}
        setOpen={setShowSupportModal}
        user={user}
      />
    </>
  )
}

export default Header
