import type { GetPendingChatbotRevisionReviewsQuery } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { getCustomModeSettingLabelKeys } from '../resources/chatbots/ChatbotAuthoring'
import ChatbotDisclaimerPreview from '../resources/chatbots/ChatbotDisclaimerPreview'

type Review =
  GetPendingChatbotRevisionReviewsQuery['getPendingChatbotPublications'][number]

function ReviewField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm text-gray-900">
        {children}
      </dd>
    </div>
  )
}

function ChatbotPublicationDetails({
  review,
  models,
}: {
  review: Review
  models: GetPendingChatbotRevisionReviewsQuery['getChatModelRegistry']
}) {
  const t = useTranslations()
  const revision = review.chatbot.authoringRevision
  const chatbot = { ...review.chatbot, ...revision }
  const disclaimerTitle = revision
    ? revision.disclaimerTitle
    : review.disclaimerTitle
  const disclaimerIntroText = revision
    ? revision.disclaimerIntroText
    : review.disclaimerIntroText
  const config = chatbot.standardModeConfig
  const unknown = t('shared.generic.unknown')
  const modelNames = chatbot.allowedModelIds.length
    ? chatbot.allowedModelIds
        .map((id) => models?.find((model) => model.id === id)?.name ?? id)
        .join(', ')
    : t('manage.resources.allowedModelsAll')
  const resetPeriod = {
    DAILY: t('manage.resources.creditResetPeriodDaily'),
    WEEKLY: t('manage.resources.creditResetPeriodWeekly'),
    BIWEEKLY: t('manage.resources.creditResetPeriodBiweekly'),
    MONTHLY: t('manage.resources.creditResetPeriodMonthly'),
    NONE: t('manage.resources.creditResetPeriodNone'),
  }[chatbot.creditResetPeriod]

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReviewField label={t('manage.admin.chatbotOwner')}>
          {review.ownerShortname}
          <br />
          {review.ownerEmail}
        </ReviewField>
        <ReviewField label={t('manage.resources.chatbotCourse')}>
          {chatbot.courses.map((course) => course.name).join(', ') || unknown}
        </ReviewField>
        <ReviewField label={t('manage.resources.chatbotId')}>
          {chatbot.id}
        </ReviewField>
        <ReviewField label={t('manage.admin.chatbotAccountApproval')}>
          {review.ownerPublishingEnabled
            ? t('manage.admin.chatbotAccountApproved')
            : t('manage.admin.chatbotAccountNotApproved')}
        </ReviewField>
      </dl>
      <dl className="space-y-4">
        <ReviewField label={t('manage.resources.chatbotDescription')}>
          {chatbot.description || unknown}
        </ReviewField>
        <ReviewField label={t('manage.resources.chatbotPublicationUseCase')}>
          {chatbot.publicationUseCase || unknown}
        </ReviewField>
      </dl>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReviewField
          label={t('manage.resources.chatbotPublicationExpectedStudentCount')}
        >
          {chatbot.expectedStudentCount ?? unknown}
        </ReviewField>
        <ReviewField label={t('manage.resources.creditResetPeriod')}>
          {resetPeriod}
        </ReviewField>
        <ReviewField label={t('manage.resources.creditInitialCredits')}>
          {chatbot.creditInitialCredits}
        </ReviewField>
        <ReviewField label={t('manage.resources.creditResetAmount')}>
          {chatbot.creditResetAmount}
        </ReviewField>
        <ReviewField label={t('manage.resources.creditMaxCredits')}>
          {chatbot.creditMaxCredits}
        </ReviewField>
        <ReviewField label={t('manage.resources.modelSelection')}>
          {chatbot.modelSelection
            ? t('manage.resources.modelSelectionEnabled')
            : t('manage.resources.modelSelectionDisabled')}
        </ReviewField>
        <ReviewField label={t('manage.resources.knowledgeGraphVisible')}>
          {chatbot.knowledgeGraphVisible
            ? t('shared.generic.yes')
            : t('shared.generic.no')}
        </ReviewField>
        <ReviewField label={t('manage.resources.knowledgeGraphRetrieval')}>
          {chatbot.knowledgeGraphRetrievalEnabled
            ? t('shared.generic.yes')
            : t('shared.generic.no')}
        </ReviewField>
        <ReviewField label={t('manage.resources.allowedModels')}>
          {modelNames}
        </ReviewField>
        <ReviewField label={t('manage.resources.chatbotSetupModesTitle')}>
          {[
            config?.tutorEnabled && t('manage.resources.chatbotModeTutor'),
            config?.explainerEnabled &&
              t('manage.resources.chatbotModeExplainer'),
            config?.quizzerEnabled && t('manage.resources.chatbotModeQuizzer'),
          ]
            .filter(Boolean)
            .join(', ') || unknown}
        </ReviewField>
      </dl>
      <dl className="space-y-4">
        <ReviewField label={t('manage.resources.reasoningEffortsByModel')}>
          {chatbot.allowedReasoningEffortsByModel.length
            ? chatbot.allowedReasoningEffortsByModel
                .map(
                  ({ modelId, efforts }) =>
                    `${models?.find((model) => model.id === modelId)?.name ?? modelId}: ${efforts.join(', ')}`
                )
                .join('\n')
            : t('manage.admin.chatbotDefaultReasoning')}
        </ReviewField>
        <ReviewField label={t('manage.resources.chatbotFraming')}>
          {[
            config?.courseName,
            config?.subjectDomain,
            config?.languageOfInstruction?.toUpperCase(),
            config?.scopeNote,
          ]
            .filter(Boolean)
            .join('\n') || unknown}
        </ReviewField>
        <ReviewField label={t('manage.admin.chatbotConnectedTools')}>
          {review.tools.length ? (
            <ul className="space-y-2">
              {review.tools.map((connection) => (
                <li key={`${connection.serverName}-${connection.chatMode}`}>
                  {connection.serverName} · {connection.chatMode} ·{' '}
                  {connection.enabled
                    ? t('manage.resources.chatbotModeEnabled')
                    : t('manage.resources.chatbotModeDisabled')}
                  <div className="text-gray-500">
                    {connection.allowedTools == null
                      ? unknown
                      : connection.allowedTools.join(', ') ||
                        t('manage.admin.chatbotAllTools')}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            t('manage.admin.chatbotNoConnectedTools')
          )}
        </ReviewField>
      </dl>
      {revision?.customModeConfig?.modes.length ? (
        <dl className="space-y-4">
          {revision.customModeConfig.modes.map((mode) => (
            <ReviewField key={mode.key} label={mode.name}>
              {mode.description && <p>{mode.description}</p>}
              {mode.welcomeMessage && (
                <div data-cy={`chatbot-admin-review-welcome-${mode.key}`}>
                  <p className="font-medium">
                    {t('manage.resources.chatbotCustomModeWelcomeMessage')}
                  </p>
                  <p>{mode.welcomeMessage}</p>
                </div>
              )}
              {mode.starterPrompts?.length ? (
                <div data-cy={`chatbot-admin-review-starters-${mode.key}`}>
                  <p className="font-medium">
                    {t('chat.suggestions.sectionLabel')}
                  </p>
                  <p>
                    {mode.starterPrompts
                      .map((prompt, index) => `${index + 1}. ${prompt}`)
                      .join('\n')}
                  </p>
                </div>
              ) : null}
              {mode.personaText && <p>{mode.personaText}</p>}
              <p data-cy={`chatbot-admin-review-reasoning-${mode.key}`}>
                {t(
                  mode.showReasoning
                    ? 'manage.resources.chatbotCustomModeReasoningShown'
                    : 'manage.resources.chatbotCustomModeReasoningHidden'
                )}
              </p>
              <p data-cy={`chatbot-admin-review-settings-${mode.key}`}>
                {`${t('manage.resources.chatbotCustomModeReplyLanguage')}: ${t(getCustomModeSettingLabelKeys(mode).replyLanguage)} · ${t('manage.resources.chatbotCustomModeMeetingClock')}: ${t(getCustomModeSettingLabelKeys(mode).meetingClock)}`}
              </p>
            </ReviewField>
          ))}
        </dl>
      ) : null}
      {disclaimerTitle ? (
        <ChatbotDisclaimerPreview
          title={disclaimerTitle}
          introText={disclaimerIntroText ?? ''}
        />
      ) : (
        <p className="text-sm text-amber-800">
          {t('manage.resources.noDisclaimer')}
        </p>
      )}
    </div>
  )
}

export default ChatbotPublicationDetails
