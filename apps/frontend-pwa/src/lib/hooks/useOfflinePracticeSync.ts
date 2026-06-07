import { useMutation } from '@apollo/client'
import { SyncOfflinePracticeAttemptsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  syncPendingOfflinePracticeAttempts,
  type OfflinePracticeSyncResult,
} from '../offlinePracticeSync'

interface UseOfflinePracticeSyncOptions {
  participantId?: string | null
  onSynced?: (result: OfflinePracticeSyncResult) => void | Promise<void>
}

interface ListenerHandle {
  remove: () => Promise<void>
}

export function useOfflinePracticeSync({
  participantId,
  onSynced,
}: UseOfflinePracticeSyncOptions) {
  const [syncOfflinePracticeAttempts] = useMutation(
    SyncOfflinePracticeAttemptsDocument
  )
  const [syncing, setSyncing] = useState(false)
  const syncInFlightRef = useRef(false)

  const syncNow = useCallback(async () => {
    if (!participantId || syncInFlightRef.current) {
      return null
    }

    syncInFlightRef.current = true
    setSyncing(true)

    try {
      const result = await syncPendingOfflinePracticeAttempts({
        participantId,
        syncAttempts: async (attempts) => {
          const response = await syncOfflinePracticeAttempts({
            variables: { attempts },
          })

          if (!response.data) {
            throw new Error('Offline practice sync returned no data.')
          }

          return response.data.syncOfflinePracticeAttempts
        },
      })

      await onSynced?.(result)
      return result
    } catch (error) {
      console.warn('Failed to sync offline practice attempts:', error)
      return null
    } finally {
      syncInFlightRef.current = false
      setSyncing(false)
    }
  }, [onSynced, participantId, syncOfflinePracticeAttempts])

  useEffect(() => {
    if (!participantId) return

    let removed = false
    const listenerHandles: ListenerHandle[] = []

    async function setupOfflinePracticeSyncListeners() {
      const handles: ListenerHandle[] = []

      try {
        const [{ App }, { Network }] = await Promise.all([
          import('@capacitor/app'),
          import('@capacitor/network'),
        ])

        const currentStatus = await Network.getStatus()
        if (!removed && currentStatus.connected) {
          void syncNow()
        }

        const networkHandle = await Network.addListener(
          'networkStatusChange',
          (status) => {
            if (status.connected) {
              void syncNow()
            }
          }
        )
        handles.push(networkHandle)

        const resumeHandle = await App.addListener('resume', () => {
          void syncNow()
        })
        handles.push(resumeHandle)

        if (removed) {
          await Promise.all(handles.map((handle) => handle.remove()))
          return
        }

        listenerHandles.push(...handles)
      } catch (error) {
        await Promise.all(handles.map((handle) => handle.remove()))
        throw error
      }
    }

    void setupOfflinePracticeSyncListeners().catch((error) => {
      console.warn('Failed to setup offline practice sync listeners:', error)
    })

    return () => {
      removed = true
      listenerHandles.forEach((handle) => {
        void handle.remove()
      })
    }
  }, [participantId, syncNow])

  return {
    syncNow,
    syncing,
  }
}
