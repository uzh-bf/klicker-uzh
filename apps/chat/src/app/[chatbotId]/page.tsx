import { Assistant } from '../../components/assistant'

interface ChatPageProps {
  params: Promise<{ chatbotId: string }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { chatbotId } = await params
  return <Assistant chatbotId={chatbotId} />
}
