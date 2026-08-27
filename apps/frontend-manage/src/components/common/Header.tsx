import { useQuery } from '@apollo/client'
import {
  faPlayCircle,
  faQuestionCircle,
} from '@fortawesome/free-regular-svg-icons'
import { faBolt, faUser } from '@fortawesome/free-solid-svg-icons'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  CountCatalogSharingRequestsDocument,
  GetLearningAnalyticsCoursesDocument,
  GetUserRunningLiveQuizzesDocument,
  type UserProfileQuery,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Navigation,
  type NavigationDropdownItemProps,
  type NavigationItemProps,
  type NavigationMenuItemProps,
  type NavigationSubmenuProps,
  Tooltip,
} from '@uzh-bf/design-system'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { isCourseLearningAnalyticsAvailable } from '../analytics/courseEligibility'
import SupportModal from './SupportModal'

type UserProfile = NonNullable<UserProfileQuery['userProfile']>

function Header({ user }: { user?: UserProfile | null }): React.ReactElement {
  const router = useRouter()
  const t = useTranslations()
  const [showSupportModal, setShowSupportModal] = useState(false)
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')

  const { data: pendingRequestData } = useQuery(
    CountCatalogSharingRequestsDocument
  )
  const { data: liveQuizData } = useQuery(GetUserRunningLiveQuizzesDocument, {
    fetchPolicy: 'cache-first',
  })
  const { data: courseData } = useQuery(GetLearningAnalyticsCoursesDocument, {
    fetchPolicy: 'network-only',
    skip: !learningAnalyticsEnabled,
  })

  const quizzes = liveQuizData?.userRunningLiveQuizzes
  const courses = courseData?.userCourses?.filter(
    isCourseLearningAnalyticsAvailable
  )

  const resourceElements: NavigationMenuItemProps[] = [
    {
      key: 'answer-collections-item',
      type: 'link' as const,
      label: t('manage.resources.answerCollections'),
      onClick: () => router.push('/resources/answerCollections'),
      data: { cy: 'answer-collections' },
    },
    ...(user?.privatePreview
      ? [
          {
            key: 'chatbots-item',
            type: 'link' as const,
            label: t('manage.resources.chatbots'),
            onClick: () => router.push('/resources/chatbots'),
            data: { cy: 'chatbots' },
          },
        ]
      : []),
    {
      key: 'catalog-item',
      type: 'link' as const,
      disabled: !user?.privatePreview,
      label: t('manage.general.catalog'),
      onClick: () => router.push('/resources/catalog'),
      badge: !user?.privatePreview ? t('shared.generic.comingSoon') : undefined,
      notification:
        pendingRequestData &&
        pendingRequestData.countCatalogSharingRequests !== 0,
      data: { cy: 'catalog' },
      className: {
        label: 'bg-opacity-100',
        text: twMerge(!user?.privatePreview ? 'mr-8' : undefined),
        badge: 'bg-green-700 hover:bg-green-800',
      },
    },
    {
      key: 'user-groups-item',
      type: 'link' as const,
      disabled: !user?.privatePreview,
      label: t('manage.general.userGroups'),
      onClick: () => router.push('/resources/userGroups'),
      badge: !user?.privatePreview ? t('shared.generic.comingSoon') : undefined,
      data: { cy: 'user-groups' },
      className: {
        label: 'bg-opacity-100',
        text: 'mr-8',
        badge: 'bg-green-700 hover:bg-green-800',
      },
    },
    {
      key: 'media-library-item',
      type: 'link' as const,
      disabled: true,
      label: t('manage.general.mediaLibrary'),
      onClick: () => router.push('/resources/mediaLibrary'),
      badge: t('shared.generic.comingSoon'),
      data: { cy: 'media-library' },
      className: {
        label: 'bg-opacity-100',
        text: 'mr-8',
        badge: 'bg-green-700 hover:bg-green-800',
      },
    },
  ]

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
      key: 'activities-menubar-item',
      label: t('shared.generic.activities'),
      onClick: () => router.push('/activities'),
      active: router.pathname == '/activities',
      data: { cy: 'activities' },
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
      type: 'dropdown',
      key: 'resources-menubar-item',
      label: t('manage.general.resources'),
      icon: faBolt,
      active:
        router.pathname == '/resources/answerCollections' ||
        router.pathname === '/resources/chatbots' ||
        router.pathname === '/resources/catalog' ||
        router.pathname === '/resources/userGroups' ||
        router.pathname === '/resources/mediaLibrary',
      notification:
        pendingRequestData &&
        pendingRequestData.countCatalogSharingRequests !== 0,
      elements: resourceElements,
      data: { cy: 'resources' },
      className: {
        icon: 'text-orange-400',
        content: 'flex flex-col gap-0.5',
      },
    },
  ]

  const analyticsElements: NavigationDropdownItemProps['elements'] = [
    ...(courses?.slice(0, 5).map<NavigationSubmenuProps>((course) => ({
      key: `course-analytics-${course.id}`,
      type: 'submenu',
      label: course.name,
      data: { cy: `course-analytics-menu-${course.name}` },
      options: [
        {
          key: `activity-dashboard-${course.name}`,
          type: 'link',
          label: t('manage.analytics.activity'),
          onClick: () => router.push(`/analytics/${course.id}/activity`),
        },
        {
          key: `progress-dashboard-${course.name}`,
          type: 'link',
          label: t('manage.analytics.performance'),
          onClick: () => router.push(`/analytics/${course.id}/performance`),
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
  ]
  const analyticsNavigation: NavigationDropdownItemProps = {
    type: 'dropdown',
    key: 'analytics-menubar-item',
    label: t('manage.general.analytics'),
    icon: faBolt,
    disabled: !learningAnalyticsEnabled,
    active: router.pathname.includes('/analytics'),
    elements: analyticsElements,
    data: { cy: 'analytics' },
    className: { icon: 'text-orange-400' },
  }
  const analyticsMenu = (
    <Navigation
      items={[analyticsNavigation]}
      className={{ root: 'shadow-none' }}
    />
  )

  const rightNavigation: NavigationItemProps[] = [
    {
      type: 'button',
      key: 'support-menubar-item',
      icon: faQuestionCircle,
      onClick: () => setShowSupportModal(true),
      data: { cy: 'support-menubar-item' },
      className: { icon: '-mx-1', root: 'px-3' },
    },
    {
      type: 'dropdown',
      key: 'quizzes-menubar-dropdown',
      icon: faPlayCircle,
      disabled: !quizzes || quizzes.length === 0,
      className: {
        trigger: 'px-3',
        content: 'border-green-600 mr-1 mt-0.5',
        icon: twMerge(
          '-mx-1',
          quizzes?.length !== 0 ? 'text-green-700' : 'text-slate-400'
        ),
      },
      data: { cy: 'running-live-quiz-dropdown' },
      elements:
        quizzes?.map((quiz) => ({
          key: quiz.id,
          type: 'link',
          label: quiz.name,
          onClick: () => router.push(`/quizzes/${quiz.id}/cockpit`),
          data: { cy: `running-live-quiz-${quiz.name}` },
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
        ...(user?.role === UserRole.Admin
          ? [
              {
                key: 'admin',
                type: 'link' as 'link',
                label: t('manage.general.adminPanel'),
                onClick: () => router.push('/admin'),
                data: { cy: 'admin-panel-page' },
              },
            ]
          : []),
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
        className="print:hidden! flex h-full w-full flex-row items-center justify-between border-b border-slate-300 bg-slate-100 font-bold text-slate-700"
        data-cy="navigation"
      >
        <div className="ml-4 flex flex-row items-center gap-1.5">
          <Image
            priority
            src="/img/klicker_icon_transparent.png"
            alt="KlickerUZH Logo"
            width={35}
            height={35}
            onClick={() => router.push('/')}
            className="hover:cursor-pointer"
          />
          <Navigation
            items={leftNavigation}
            className={{ root: 'shadow-none' }}
          />
          {learningAnalyticsEnabled ? (
            analyticsMenu
          ) : (
            <Tooltip
              tooltip={t('manage.analytics.featureUnavailable')}
              delay={0}
              dataContent={{ cy: 'analytics-disabled-reason' }}
              className={{ tooltip: 'z-30' }}
            >
              {analyticsMenu}
            </Tooltip>
          )}
        </div>
        <Navigation
          items={rightNavigation}
          className={{ root: '-gap-1 flex h-10 flex-row shadow-none' }}
        />
      </div>
      {showSupportModal && (
        <SupportModal onClose={() => setShowSupportModal(false)} user={user} />
      )}
    </>
  )
}

export default Header
