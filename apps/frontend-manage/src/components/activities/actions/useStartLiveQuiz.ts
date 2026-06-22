import { trpc } from '../../../lib/trpc'

function useStartLiveQuiz({ id }: { id: string; name: string }) {
  const utils = trpc.useUtils()
  const startLiveQuiz = trpc.liveQuiz.start.useMutation({
    onSuccess: async (result) => {
      if (!result.liveQuiz) return
      await utils.liveQuiz.running.invalidate().catch(console.error)
    },
  })

  return {
    onStart: () => startLiveQuiz.mutateAsync({ id }),
    starting: startLiveQuiz.isLoading,
  }
}

export default useStartLiveQuiz
