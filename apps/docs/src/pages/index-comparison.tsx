import Layout from '@theme/Layout'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { CTA } from '../components/landing/CTA'
import { FeatureFocusSection } from '../components/landing/FeatureFocusSection'
import FeatureAccordion from '../components/landing/FeatureAccordion'
import FeatureBentoGrid from '../components/landing/FeatureBentoGrid'
import FeatureJourney from '../components/landing/FeatureJourney'
import FeatureSection from '../components/landing/FeatureSection'
import FeatureTabExplorer from '../components/landing/FeatureTabExplorer'
import FeatureSmartGrid from '../components/landing/FeatureSmartGrid'
import { SimplifiedSocialProof } from '../components/landing/SimplifiedSocialProof'
import { SimplifiedOSSProof } from '../components/landing/SimplifiedOSSProof'
import { DeveloperShowcase } from '../components/landing/DeveloperShowcase'
import { SocialProof } from '../components/landing/SocialProof'
import { TitleImage } from '../components/landing/TitleImage'
import { UseCaseOverview } from '../components/landing/UseCaseOverview'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'

type LayoutVersion = 'original' | 'tabbed' | 'bento' | 'accordion' | 'journey' | 'hybrid'

const versionInfo = {
  original: {
    name: 'Original Layout',
    description: 'Current production layout with sequential feature sections',
    features: ['4 separate FeatureSections', 'Full social proof with testimonials', 'Side-by-side text/image layout'],
    pros: ['Familiar pattern', 'Works well on all devices', 'Clear information hierarchy'],
    cons: ['Very long page', 'Repetitive layout', 'Limited feature discovery']
  },
  tabbed: {
    name: 'Tabbed Explorer',
    description: 'Organized features into categorized tabs with grid layouts',
    features: ['Category-based navigation', 'Compact vertical space', 'Grid feature cards'],
    pros: ['Reduces page length by 60%', 'Easy category navigation', 'Better information density'],
    cons: ['Content hidden behind tabs', 'Requires interaction to see all features']
  },
  bento: {
    name: 'Bento Grid',
    description: 'Magazine-style layout with varied card sizes for visual hierarchy',
    features: ['Mixed card sizes', 'Visual hierarchy', 'Hero features emphasized'],
    pros: ['Modern, engaging design', 'Clear feature prioritization', 'Excellent visual appeal'],
    cons: ['Complex responsive behavior', 'May overwhelm some users']
  },
  accordion: {
    name: 'Progressive Disclosure',
    description: 'Collapsible sections allowing user-controlled exploration',
    features: ['Expandable sections', 'User-controlled depth', 'Clean initial view'],
    pros: ['Minimal initial cognitive load', 'Progressive information reveal', 'Good for focused exploration'],
    cons: ['Content hidden by default', 'Requires multiple interactions']
  },
  journey: {
    name: 'Interactive Journey',
    description: 'Search and filter-driven feature discovery with personalization',
    features: ['Search functionality', 'Multiple filters', 'Popular features showcase'],
    pros: ['Personalized experience', 'Excellent feature discovery', 'Modern interaction patterns'],
    cons: ['More complex implementation', 'May be overwhelming for some']
  },
  hybrid: {
    name: 'Smart Grid (Hybrid)',
    description: 'Best-of-breed approach combining smart categorization, feature DNA, and OSS focus',
    features: ['Feature DNA badges', 'Smart filtering', 'Compact view toggle', 'Developer showcase', 'OSS positioning'],
    pros: ['Best features from all approaches', 'Progressive disclosure', 'Developer-friendly', 'Strong OSS message'],
    cons: ['Most complex implementation', 'Requires careful balance']
  }
}

function HomeComparison() {
  const [activeVersion, setActiveVersion] = useState<LayoutVersion>('original')

  const renderFeatureContent = () => {
    switch (activeVersion) {
      case 'original':
        return (
          <>
            <SocialProof />
            <FeatureSection
              title="Core Teaching Tools"
              description="Essential real-time interaction features for engaging classroom experiences"
              features={[
                {
                  title: 'Live Quizzes',
                  icon: faArrowRight,
                  text: 'Launch interactive quizzes during class with real-time results. Students participate using any device, with instant feedback and dynamic visualizations.',
                  hoverImage: '/img/live_quiz/lq_student_view.png',
                },
                {
                  title: 'Live Q&A & Feedback',
                  icon: faArrowRight,
                  text: 'Enable students to ask questions, upvote topics, and provide real-time feedback. Moderate discussions and respond instantly to maintain engagement.',
                  hoverImage: '/img/landing/live_qa.png',
                },
                {
                  title: 'Anonymous Participation',
                  icon: faArrowRight,
                  text: 'NEW: Allow students to participate anonymously in all activities, reducing anxiety and encouraging honest responses while maintaining engagement.',
                  hoverImage: '/img/live_quiz/lq_student_view.png',
                },
              ]}
            />
            <FeatureSection
              title="Enhanced Engagement"
              description="Gamification features that motivate and reward participation"
              features={[
                {
                  title: 'Anonymous Gamified Quizzes',
                  icon: faArrowRight,
                  text: 'NEW: Combine gamification with anonymous participation. Students compete for points without revealing their identity, perfect for sensitive topics.',
                  hoverImage: '/img/leaderboard/course_leaderboard.png',
                  shadow: false,
                },
                {
                  title: 'Points & Leaderboards',
                  icon: faArrowRight,
                  text: 'Track progress with individual and group rankings. Customizable point systems reward speed, accuracy, and participation.',
                  hoverImage: '/img/leaderboard/course_leaderboard.png',
                  shadow: false,
                },
                {
                  title: 'Achievements & Rewards',
                  icon: faArrowRight,
                  text: 'Motivate students with badges, milestones, and level progression. Create custom achievements aligned with learning objectives.',
                  hoverImage: '/img/group/group_student_view.png',
                },
              ]}
            />
          </>
        )
      case 'tabbed':
        return (
          <>
            <SimplifiedSocialProof />
            <FeatureTabExplorer />
          </>
        )
      case 'bento':
        return (
          <>
            <SimplifiedSocialProof />
            <FeatureBentoGrid />
          </>
        )
      case 'accordion':
        return (
          <>
            <SimplifiedSocialProof />
            <FeatureAccordion />
          </>
        )
      case 'journey':
        return (
          <>
            <SimplifiedSocialProof />
            <FeatureJourney />
          </>
        )
      case 'hybrid':
        return (
          <>
            <SimplifiedOSSProof />
            <FeatureSmartGrid />
            <DeveloperShowcase />
          </>
        )
      default:
        return null
    }
  }

  return (
    <Layout>
      {/* Version Selector */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-gray-900">Layout Comparison</h1>
              <span className="text-sm text-gray-500">
                {versionInfo[activeVersion].name}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {Object.entries(versionInfo).map(([version, info]) => (
                <button
                  key={version}
                  onClick={() => setActiveVersion(version as LayoutVersion)}
                  className={twMerge(
                    'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    activeVersion === version
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {info.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Version Description */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">{versionInfo[activeVersion].description}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="font-medium text-gray-900 mb-1">Features:</div>
                <ul className="text-gray-600 space-y-0.5">
                  {versionInfo[activeVersion].features.map((feature, idx) => (
                    <li key={idx}>• {feature}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-green-700 mb-1">Pros:</div>
                <ul className="text-gray-600 space-y-0.5">
                  {versionInfo[activeVersion].pros.map((pro, idx) => (
                    <li key={idx}>✓ {pro}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-orange-700 mb-1">Considerations:</div>
                <ul className="text-gray-600 space-y-0.5">
                  {versionInfo[activeVersion].cons.map((con, idx) => (
                    <li key={idx}>⚠ {con}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero - Same for all versions */}
      <TitleImage />
      
      {/* Dynamic Feature Content */}
      {renderFeatureContent()}
      
      {/* Bottom sections - Same for all versions */}
      <div className="mx-auto max-w-7xl space-y-8 p-4">
        <UseCaseOverview />
        <CTA />
      </div>
    </Layout>
  )
}

export default HomeComparison