import { ActivityTemplate } from '@klicker-uzh/graphql/dist/ops'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import SectionCollapsible from './SectionCollapsible'
import TemplateInfo from './TemplateInfo'

type CollapsibleState = {
  open: boolean
  status: 'due' | 'success' | 'error'
}

function LiveQuizTemplate({ template }: { template: ActivityTemplate }) {
  const t = useTranslations()
  const liveQuiz = template.liveQuiz

  // TODO: replace with proper state for all blocks, settings, etc.
  const [collapsibles, setCollapsibles] = useState<{
    settings: CollapsibleState
    [blockIx: number]: {
      [elementIx: number]: CollapsibleState
    }
  }>({
    settings: {
      open: true,
      status: 'due',
    },
    ...liveQuiz?.blocks?.reduce<{
      [blockIx: number]: {
        [elementIx: number]: CollapsibleState
      }
    }>((acc, block, blockIx) => {
      acc[blockIx] =
        block.elements?.reduce<{ [elementIx: number]: CollapsibleState }>(
          (acc, _, elementIx) => {
            acc[elementIx] = {
              open: false,
              status: 'due',
            }
            return acc
          },
          {}
        ) ?? {}

      return acc
    }, {}),
  })

  if (!liveQuiz) {
    return (
      <UserNotification
        type="error"
        message={t('manage.template.errorLoadingTemplate')}
      />
    )
  }

  return (
    <div>
      <TemplateInfo
        activityType={template.activityType}
        name={liveQuiz.name}
        instructions={template.instructions}
      />
      <div className="mt-6 flex flex-col">
        <SectionCollapsible
          title={t('shared.generic.settings')}
          status={collapsibles.settings.status}
          isOpen={collapsibles.settings.open}
          onOpenChange={() =>
            setCollapsibles((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                open: !prev.settings.open,
              },
            }))
          }
        >
          {/* Settings content */}
          <div>Settings content goes here</div>
        </SectionCollapsible>

        {liveQuiz?.blocks?.map((block, blockIx) => (
          <div key={`block-${blockIx}`} className="mt-4">
            <H3>{`${t('shared.generic.block')} ${blockIx + 1}`}</H3>
            {block.elements?.map((element, elementIx) => (
              <SectionCollapsible
                key={`element-${blockIx}-${elementIx}`}
                title={`${t('shared.generic.element')} ${elementIx + 1}: ${t(`shared.types.${element.elementType}`)}`}
                status={collapsibles[blockIx]?.[elementIx]?.status || 'due'}
                isOpen={collapsibles[blockIx]?.[elementIx]?.open || false}
                onOpenChange={() =>
                  setCollapsibles((prev) => ({
                    ...prev,
                    [blockIx]: {
                      ...prev[blockIx],
                      [elementIx]: {
                        ...prev[blockIx]?.[elementIx],
                        open: !prev[blockIx]?.[elementIx]?.open,
                      },
                    },
                  }))
                }
              >
                {/* Element content */}
                <div>
                  Content for element {elementIx + 1} in block {blockIx + 1}
                </div>
              </SectionCollapsible>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default LiveQuizTemplate
