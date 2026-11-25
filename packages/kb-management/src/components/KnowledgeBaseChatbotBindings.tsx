import { useMutation, useQuery } from '@apollo/client'
import {
  AddKbLinkToChatbotDocument,
  AttachKbToChatbotDocument,
  ChatbotStatus,
  DetachKbFromChatbotDocument,
  QGetKbChatbotBindingsWithKnowledgeBasesDocument,
  QGetChatbotsInfoWithKnowledgeBasesDocument,
  SetChatbotDefaultKbDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Badge,
  Button,
  Modal,
  SelectField,
  Skeleton,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { refreshAfterMutation } from '../refreshAfterMutation'

function KnowledgeBaseChatbotBindings({
  kbId,
  onChanged,
  perModeKbLinksEnabled,
}: {
  kbId: string
  onChanged: () => Promise<unknown>
  perModeKbLinksEnabled: boolean
}) {
  const t = useTranslations()
  const [selectedChatbotId, setSelectedChatbotId] = useState<
    string | undefined
  >()
  const [detachTargetId, setDetachTargetId] = useState<string | undefined>()
  const { data, loading, error } = useQuery(
    QGetKbChatbotBindingsWithKnowledgeBasesDocument,
    { variables: { kbId } }
  )
  const [addKbLink, { loading: attaching }] = useMutation(
    AddKbLinkToChatbotDocument
  )
  const [attachKb, { loading: attachingLegacy }] = useMutation(
    AttachKbToChatbotDocument
  )
  const [setDefaultKb, { loading: settingDefault }] = useMutation(
    SetChatbotDefaultKbDocument
  )
  const [detachKb, { loading: detaching }] = useMutation(
    DetachKbFromChatbotDocument
  )
  const bindings = data?.getKbChatbotBindings ?? []
  const linkedBindings = bindings.flatMap((binding) => {
    const link = binding.enabledKbs.find(
      (knowledgeBase) => knowledgeBase.kbId === kbId
    )
    return link ? [{ binding, link }] : []
  })
  const unlinkedChatbots = bindings.filter(
    ({ chatbotId }) =>
      !linkedBindings.some(({ binding }) => binding.chatbotId === chatbotId)
  )
  const selectedBinding = bindings.find(
    ({ chatbotId }) => chatbotId === selectedChatbotId
  )
  const selectedOtherKnowledgeBase = selectedBinding?.enabledKbs.find(
    ({ kbId: linkedKbId }) => linkedKbId !== kbId
  )
  const detachTarget = bindings.find(
    ({ chatbotId }) => chatbotId === detachTargetId
  )
  const detachTargetLink = linkedBindings.find(
    ({ binding }) => binding.chatbotId === detachTargetId
  )
  const mutating = attaching || attachingLegacy || settingDefault || detaching
  const summary = loading
    ? t('shared.generic.loading')
    : error
      ? t('kb.chatbotsLoadError')
      : linkedBindings.length > 0
        ? t('kb.linkedChatbots')
        : t('kb.noLinkedChatbots')

  const refetchQueries = [
    {
      query: QGetKbChatbotBindingsWithKnowledgeBasesDocument,
      variables: { kbId },
    },
    { query: QGetChatbotsInfoWithKnowledgeBasesDocument },
  ]

  const handleAttach = async () => {
    if (!selectedChatbotId || mutating) return

    try {
      if (perModeKbLinksEnabled) {
        await addKbLink({
          variables: { kbId, chatbotId: selectedChatbotId },
          refetchQueries,
        })
      } else {
        await attachKb({
          variables: { kbId, chatbotId: selectedChatbotId },
          refetchQueries,
        })
      }
    } catch (mutationError) {
      console.error('Failed to attach KB to chatbot', mutationError)
      toast({ type: 'error', message: t('kb.chatbotAttachError') })
      return
    }

    await refreshAfterMutation(onChanged, 'KB chatbot bindings after attach')
    setSelectedChatbotId(undefined)
    toast({ type: 'success', message: t('kb.chatbotAttachSuccess') })
  }

  const handleSetDefault = async (chatbotId: string, isDefault: boolean) => {
    if (mutating) return

    try {
      await setDefaultKb({
        variables: { chatbotId, kbId: isDefault ? null : kbId },
        refetchQueries,
      })
    } catch (mutationError) {
      console.error(
        'Failed to change the default knowledge base',
        mutationError
      )
      toast({ type: 'error', message: t('kb.chatbotDefaultError') })
      return
    }

    await refreshAfterMutation(
      onChanged,
      'KB chatbot default after default change'
    )
    toast({
      type: 'success',
      message: isDefault
        ? t('kb.chatbotDefaultCleared')
        : t('kb.chatbotDefaultSuccess'),
    })
  }

  const handleDetach = async () => {
    if (!detachTargetId) return
    if (mutating) return

    try {
      await detachKb({
        variables: { kbId, chatbotId: detachTargetId },
        refetchQueries,
      })
    } catch (mutationError) {
      console.error('Failed to detach KB from chatbot', mutationError)
      toast({ type: 'error', message: t('kb.chatbotDetachError') })
      return
    }

    await refreshAfterMutation(onChanged, 'KB chatbot bindings after detach')
    setDetachTargetId(undefined)
    toast({ type: 'success', message: t('kb.chatbotDetachSuccess') })
  }

  return (
    <details className="mt-6" data-cy="kb-chatbot-settings">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2">
        <span
          className="font-semibold text-slate-900"
          role="heading"
          aria-level={2}
        >
          {t('kb.chatbotsTitle')}
        </span>
        <span className="text-sm text-slate-600" data-cy="kb-chatbot-summary">
          {summary}
        </span>
        <span className="text-sm font-medium text-primary-100">
          {t('kb.configure')}
        </span>
      </summary>
      <section className="mt-3" data-cy="kb-chatbot-bindings">
        <p className="text-sm text-slate-600">
          {t(
            perModeKbLinksEnabled
              ? 'kb.chatbotsModeSourcesDescription'
              : 'kb.chatbotsDescription'
          )}
        </p>
        {/* The chatbots page validates this id against the lecturer's own
            knowledge bases before offering to connect it. */}
        <Link
          href={`/resources/chatbots?createForKb=${encodeURIComponent(kbId)}`}
          className="mt-2 inline-block text-sm font-medium text-primary-100 hover:underline"
          data-cy="kb-create-chatbot"
        >
          {t('manage.resources.chatbotKnowledgeBaseCreateChatbot')}
        </Link>

        {loading ? (
          <Skeleton
            className="mt-4 h-20 w-full motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : error ? (
          <UserNotification
            type="error"
            className={{ root: 'mt-4' }}
            message={t('kb.chatbotsLoadError')}
            data={{ cy: 'kb-chatbot-bindings-error' }}
          />
        ) : bindings.length === 0 ? (
          <UserNotification
            className={{ root: 'mt-4' }}
            message={t('kb.noChatbots')}
            data={{ cy: 'kb-chatbot-bindings-empty' }}
          />
        ) : (
          <>
            <div
              className="mt-4 flex flex-col items-end gap-3 sm:flex-row"
              data-cy="kb-chatbot-attach-form"
            >
              <div className="w-full flex-1">
                <SelectField
                  label={t('kb.chatbotSelectLabel')}
                  items={(perModeKbLinksEnabled
                    ? unlinkedChatbots
                    : bindings
                  ).map((binding) => ({
                    value: binding.chatbotId,
                    label: binding.chatbotName,
                  }))}
                  value={selectedChatbotId}
                  onChange={setSelectedChatbotId}
                  placeholder={t('kb.chatbotSelectPlaceholder')}
                  disabled={mutating}
                />
              </div>
              <Button
                primary
                disabled={!selectedChatbotId || mutating}
                onClick={handleAttach}
                data={{ cy: 'attach-kb-chatbot' }}
              >
                <Button.Label>
                  {perModeKbLinksEnabled
                    ? t('kb.attachChatbot')
                    : selectedOtherKnowledgeBase
                      ? t('kb.replaceChatbot')
                      : t('kb.attachChatbot')}
                </Button.Label>
              </Button>
            </div>

            {perModeKbLinksEnabled && unlinkedChatbots.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                {t('kb.allChatbotsLinked')}
              </p>
            ) : null}
            {perModeKbLinksEnabled ? (
              linkedBindings.some(
                ({ binding }) =>
                  binding.chatbotStatus === ChatbotStatus.Published
              )
            ) : selectedBinding?.chatbotStatus === ChatbotStatus.Published ? (
              <UserNotification
                type="warning"
                className={{ root: 'mt-3' }}
                message={t('kb.chatbotLiveChangeWarning')}
                data={{ cy: 'kb-chatbot-live-change-warning' }}
              />
            ) : null}
            {!perModeKbLinksEnabled && selectedOtherKnowledgeBase ? (
              <UserNotification
                type="warning"
                className={{ root: 'mt-3' }}
                message={t('kb.chatbotReplacementWarning', {
                  kbName: selectedOtherKnowledgeBase.name,
                })}
                data={{ cy: 'kb-chatbot-replacement-warning' }}
              />
            ) : null}

            <div className="mt-5">
              <div className="text-sm font-medium text-slate-700">
                {t('kb.linkedChatbots')}
              </div>
              {linkedBindings.length === 0 ? (
                <p
                  className="mt-2 text-sm text-slate-600"
                  data-cy="kb-no-linked-chatbots"
                >
                  {t('kb.noLinkedChatbots')}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-200">
                  {linkedBindings.map(({ binding, link }) => (
                    <li
                      key={binding.chatbotId}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                      data-cy={`kb-linked-chatbot-${binding.chatbotId}`}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="flex flex-wrap items-center gap-2 break-words font-medium">
                          {binding.chatbotName}
                          {perModeKbLinksEnabled && link.isDefault ? (
                            <Badge className="bg-primary-100 text-white">
                              {t('kb.chatbotDefaultBadge')}
                            </Badge>
                          ) : null}
                        </span>
                        {binding.chatbotStatus === ChatbotStatus.Published ? (
                          <span
                            className="text-sm text-amber-700"
                            data-cy={`kb-linked-chatbot-live-${binding.chatbotId}`}
                          >
                            {t('kb.linkedChatbotLiveNote')}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex flex-wrap gap-2">
                        {perModeKbLinksEnabled ? (
                          <Button
                            disabled={mutating}
                            onClick={() =>
                              void handleSetDefault(
                                binding.chatbotId,
                                link.isDefault
                              )
                            }
                            data={{
                              cy: `${link.isDefault ? 'clear' : 'set'}-kb-chatbot-default-${binding.chatbotId}`,
                            }}
                          >
                            <Button.Label>
                              {link.isDefault
                                ? t('kb.clearChatbotDefault')
                                : t('kb.makeChatbotDefault')}
                            </Button.Label>
                          </Button>
                        ) : null}
                        <Button
                          disabled={mutating}
                          onClick={() => setDetachTargetId(binding.chatbotId)}
                          data={{
                            cy: `detach-kb-chatbot-${binding.chatbotId}`,
                          }}
                        >
                          <Button.Label>{t('kb.detachChatbot')}</Button.Label>
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        {detachTarget && detachTargetLink ? (
          <Modal
            open
            onClose={() => setDetachTargetId(undefined)}
            title={t('kb.chatbotDetachTitle')}
            primaryLabel={t('kb.detachChatbot')}
            primaryButtonStyle="destructive"
            primaryLoading={detaching}
            onPrimaryAction={handleDetach}
            secondaryLabel={t('shared.generic.cancel')}
            onSecondaryAction={() => setDetachTargetId(undefined)}
            dataContent={{ cy: 'kb-chatbot-detach-modal' }}
            dataPrimaryAction={{ cy: 'confirm-kb-chatbot-detach' }}
            dataSecondaryAction={{ cy: 'cancel-kb-chatbot-detach' }}
          >
            <p>
              {t('kb.chatbotDetachDescription', {
                name: detachTarget.chatbotName,
              })}
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                {t('kb.chatbotDetachAffectedModes', {
                  modes:
                    detachTargetLink.link.modeBacklinks
                      .map(({ name }) => name)
                      .join(', ') || t('shared.generic.none'),
                })}
              </p>
              <p>{t('kb.chatbotDetachConsequence')}</p>
            </div>
          </Modal>
        ) : null}
      </section>
    </details>
  )
}

export default KnowledgeBaseChatbotBindings
