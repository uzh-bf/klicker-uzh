'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authedFetch } from '../lib/client/authedFetch'
import { DEFAULT_MODE_DESCRIPTIONS } from '../lib/config/mode-descriptions'
import { type ModelID, type ModelOption } from '../lib/config/models'
import { parseModeOptions, resolveSelectedMode } from '../lib/config/modes'
import { type ReasoningEffort } from '../lib/config/reasoning'

export interface ModeOption {
  name: string
  description: string
}

export type AuthMode = 'account' | 'anonymous'

const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'none'
let creditsRequestGeneration = 0
let creditsLoadedChatbotId: string | null = null
let modeOptionsRequestGeneration = 0
const SAFE_FALLBACK_MODE_OPTIONS = {
  tutor: DEFAULT_MODE_DESCRIPTIONS.tutor,
}

const resolveAllowedReasoningEfforts = (
  model?: ModelOption
): ReasoningEffort[] => {
  if (!model?.supportsReasoning) {
    return []
  }

  return model.allowedReasoningEfforts.length > 0
    ? model.allowedReasoningEfforts
    : [DEFAULT_REASONING_EFFORT]
}

const resolveReasoningEffortForModel = (
  currentEffort: ReasoningEffort,
  model?: ModelOption
): ReasoningEffort => {
  const allowedReasoningEfforts = resolveAllowedReasoningEfforts(model)
  if (allowedReasoningEfforts.length === 0) {
    return DEFAULT_REASONING_EFFORT
  }

  if (allowedReasoningEfforts.includes(currentEffort)) {
    return currentEffort
  }

  if (allowedReasoningEfforts.includes('medium')) {
    return 'medium'
  }

  return allowedReasoningEfforts[0]
}

interface SettingsState {
  // Current selections
  selectedModel: ModelID
  selectedMode: string
  selectedReasoningEffort: ReasoningEffort
  credits: {
    current: number
    total: number
    // ISO timestamp of the next refill; null when the chatbot never refills.
    nextResetAt: string | null
  }
  // False until a credits fetch has succeeded. The placeholder credits below
  // would otherwise read as "0 left, never refills", which is a claim we
  // cannot make before the server has answered.
  creditsLoaded: boolean
  modelSelectionEnabled: boolean
  authMode: AuthMode

  // Available options
  modelOptions: ModelOption[]
  modeOptions: Record<string, string>
  modeOptionsChatbotId: string | null

  // Actions
  setSelectedModel: (model: ModelID) => void
  setSelectedMode: (mode: string) => void
  setSelectedReasoningEffort: (effort: ReasoningEffort) => void
  loadModeOptions: (
    chatbotId: string,
    initialModeOptions?: Record<string, string>
  ) => Promise<void>
  loadCredits: (chatbotId: string) => Promise<void>
  decrementCredits: (amount: number) => void
  resetCredits: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // initial state
      selectedModel: 'gpt-5.5',
      selectedMode: 'tutor',
      selectedReasoningEffort: 'none',
      credits: {
        current: 0.0,
        total: 0.0,
        nextResetAt: null,
      },
      creditsLoaded: false,
      modelSelectionEnabled: false,
      authMode: 'account' as AuthMode,
      modeOptions: {},
      modeOptionsChatbotId: null,

      // available options
      modelOptions: [],

      // actions
      setSelectedModel: (model) =>
        set((state) => {
          const selectedModelOption = state.modelOptions.find(
            (option) => option.id === model
          )

          return {
            selectedModel: model,
            selectedReasoningEffort: resolveReasoningEffortForModel(
              state.selectedReasoningEffort,
              selectedModelOption
            ),
          }
        }),
      setSelectedMode: (mode: string) => set({ selectedMode: mode }),
      setSelectedReasoningEffort: (effort: ReasoningEffort) =>
        set((state) => {
          const selectedModelOption = state.modelOptions.find(
            (option) => option.id === state.selectedModel
          )
          const resolvedEffort = resolveReasoningEffortForModel(
            effort,
            selectedModelOption
          )

          return { selectedReasoningEffort: resolvedEffort }
        }),

      loadModeOptions: async (
        chatbotId: string,
        initialModeOptions?: Record<string, string>
      ) => {
        const requestGeneration = ++modeOptionsRequestGeneration
        const hasInitialModeOptions = initialModeOptions !== undefined
        const fallbackModeOptions = hasInitialModeOptions
          ? initialModeOptions
          : SAFE_FALLBACK_MODE_OPTIONS
        const applyFallbackModeOptions = () =>
          set((state) => ({
            modeOptions: fallbackModeOptions,
            modeOptionsChatbotId: chatbotId,
            selectedMode: resolveSelectedMode(
              fallbackModeOptions,
              state.selectedMode
            ),
            modelSelectionEnabled: false,
          }))
        set({
          modeOptions: {},
          modeOptionsChatbotId: null,
          modelSelectionEnabled: false,
        })

        try {
          const response = await authedFetch(`/api/chatbots/${chatbotId}`)
          const responseData = await response.json()
          if (requestGeneration !== modeOptionsRequestGeneration) return

          if (!response.ok) {
            console.warn(
              'No valid mode options found, falling back to initial or default mode options.'
            )
            applyFallbackModeOptions()
            return
          }

          const modelSelectionEnabled = responseData.modelSelection ?? false

          const resolvedModeOptions = parseModeOptions(responseData.modeOptions)
          if (!resolvedModeOptions) {
            throw new Error('Invalid mode options response')
          }

          set((state) => {
            return {
              modeOptions: resolvedModeOptions,
              modeOptionsChatbotId: chatbotId,
              modelSelectionEnabled,
              selectedMode: resolveSelectedMode(
                resolvedModeOptions,
                state.selectedMode
              ),
            }
          })
        } catch (error) {
          console.error('Error fetching mode options:', error)
          if (requestGeneration !== modeOptionsRequestGeneration) return

          applyFallbackModeOptions()
        }
      },

      loadCredits: async (chatbotId: string) => {
        // `creditsLoaded` is sticky once a load has succeeded FOR THIS
        // chatbot: a refresh (or a failed one) keeps the last known balance
        // visible instead of hiding the footer for the rest of the session.
        // A different chatbot id must not inherit the stickiness, or a failed
        // cross-chatbot load would pin the previous chatbot's balance.
        const requestGeneration = ++creditsRequestGeneration
        if (
          creditsLoadedChatbotId !== null &&
          creditsLoadedChatbotId !== chatbotId
        ) {
          creditsLoadedChatbotId = null
          set({ creditsLoaded: false })
        }

        try {
          const response = await authedFetch(
            `/api/chatbots/${chatbotId}/credits`
          )
          if (requestGeneration !== creditsRequestGeneration) return

          if (!response.ok) {
            console.error('Failed to load credits:', response.statusText)
            return
          }

          const data = await response.json()

          const creditsData = {
            current: data.current ?? 0,
            total: data.total ?? 0,
            nextResetAt: data.nextResetAt ?? null,
          }
          const availableModels: ModelOption[] = data.availableModels ?? []
          const automaticModelId: string | undefined = data.automaticModelId
          const authMode: AuthMode =
            data.authMode === 'anonymous' ? 'anonymous' : 'account'

          set((state) => {
            if (requestGeneration !== creditsRequestGeneration) return state
            creditsLoadedChatbotId = chatbotId

            let selectedModel = state.selectedModel

            if (!state.modelSelectionEnabled) {
              if (automaticModelId) selectedModel = automaticModelId
            } else {
              const isSelectedModelAvailable = availableModels.some(
                (m) => m.id === selectedModel
              )
              if (!isSelectedModelAvailable) {
                selectedModel =
                  availableModels[0]?.id ?? automaticModelId ?? selectedModel
              }
            }

            const selectedModelOption = availableModels.find(
              (modelOption) => modelOption.id === selectedModel
            )
            const selectedReasoningEffort = resolveReasoningEffortForModel(
              state.selectedReasoningEffort,
              selectedModelOption
            )

            return {
              credits: creditsData,
              creditsLoaded: true,
              modelOptions: availableModels,
              selectedModel,
              selectedReasoningEffort,
              authMode,
            }
          })
        } catch (error) {
          console.error('Error loading credits:', error)
        }
      },

      decrementCredits: (amount) =>
        set((state) => ({
          credits: {
            ...state.credits,
            current: Math.max(0, state.credits.current - amount),
          },
        })),
      resetCredits: () =>
        set((state) => ({
          credits: {
            ...state.credits,
            current: state.credits.total,
          },
        })),
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        selectedMode: state.selectedMode,
        selectedReasoningEffort: state.selectedReasoningEffort,
      }),
    }
  )
)
