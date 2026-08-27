import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus } from '@klicker-uzh/prisma/client'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { OwnerPreviewAssistant } from '@/src/components/owner-preview-assistant'
import {
  hasConfiguredModeDescriptions,
  resolveModeDescriptions,
} from '@/src/lib/config/modes'
import { getOwnerPreviewAccess } from '@/src/lib/server/ownerPreviewAuth'

type OwnerPreviewPageProps = {
  params: Promise<{ chatbotId: string }>
}

export default async function OwnerPreviewPage({
  params,
}: OwnerPreviewPageProps) {
  const { chatbotId } = await params
  if (!z.string().uuid().safeParse(chatbotId).success) notFound()

  const access = await getOwnerPreviewAccess(chatbotId)
  if ('error' in access) {
    if (access.error === 'UNAUTHORIZED') return <PreviewLoginRequired />
    notFound()
  }

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId, ownerId: access.userId },
    select: {
      avatar: true,
      id: true,
      name: true,
      status: true,
      systemPrompts: true,
    },
  })
  if (!chatbot || chatbot.status === ChatbotStatus.PAUSED) notFound()

  const initialModeOptions = resolveModeDescriptions(chatbot.systemPrompts)
  const initialModeOptionsAreFallback = !hasConfiguredModeDescriptions(
    chatbot.systemPrompts
  )
  const manageBaseUrl = (
    process.env.NEXT_PUBLIC_MANAGE_URL ?? 'https://manage.klicker.uzh.ch'
  ).replace(/\/$/, '')

  return (
    <OwnerPreviewAssistant
      chatbot={{
        avatar: chatbot.avatar ?? undefined,
        id: chatbot.id,
        name: chatbot.name,
      }}
      initialModeOptions={initialModeOptions}
      initialModeOptionsAreFallback={initialModeOptionsAreFallback}
      manageUrl={`${manageBaseUrl}/resources/chatbots/${encodeURIComponent(chatbot.id)}`}
    />
  )
}

async function PreviewLoginRequired() {
  const t = await getTranslations('chat.ownerPreview')
  const manageBaseUrl = (
    process.env.NEXT_PUBLIC_MANAGE_URL ?? 'https://manage.klicker.uzh.ch'
  ).replace(/\/$/, '')

  return (
    <main
      id="main-content"
      className="bg-muted flex min-h-dvh items-center justify-center px-4"
    >
      <div className="bg-card w-full max-w-lg rounded-lg border p-8 text-center shadow-sm">
        <h1 className="text-foreground text-2xl font-semibold">
          {t('loginTitle')}
        </h1>
        <p className="text-muted-foreground mt-4">{t('loginMessage')}</p>
        <Link
          href={`${manageBaseUrl}/login`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 py-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2"
          prefetch={false}
        >
          {t('loginButton')}
        </Link>
      </div>
    </main>
  )
}
