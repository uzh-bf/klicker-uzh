'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type ModelID, type ModelOption } from '../lib/config/models'
import { DEFAULT_PROMPT } from '../lib/config/prompts'
import { type ReasoningEffort } from '../lib/config/reasoning'

export interface ModeOption {
  name: string
  description: string
}

const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'none'

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

  // Available options
  modelOptions: ModelOption[]
  modeOptions: Record<string, string>

  // Actions
  setSelectedModel: (model: ModelID) => void
  setSelectedMode: (mode: string) => void
  setSelectedReasoningEffort: (effort: ReasoningEffort) => void
  loadModeOptions: (chatbotId: string) => Promise<void>
  loadCredits: (chatbotId: string) => Promise<void>
  decrementCredits: (amount: number) => void
  resetCredits: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // initial state
      selectedModel: 'gpt-4.1',
      selectedMode: 'tutor',
      selectedReasoningEffort: 'none',
      credits: {
        current: 0.0,
        total: 0.0,
        nextResetAt: null,
      },
      creditsLoaded: false,
      modelSelectionEnabled: false,
      modeOptions: {},

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

      loadModeOptions: async (chatbotId: string) => {
        try {
          const response = await fetch(`/api/chatbots/${chatbotId}`)
          const responseData = await response.json()
          if (!response.ok) {
            console.warn(
              'No valid mode options found, falling back to defaults.'
            )
            set((state) => ({
              modeOptions: Object.fromEntries(
                Object.entries(DEFAULT_PROMPT).map(([key, value]) => [
                  key,
                  (value as { description: string }).description,
                ])
              ),
              selectedMode:
                Object.keys(DEFAULT_PROMPT)[0] ?? state.selectedMode,
              modelSelectionEnabled: false,
            }))
            return
          }

          const modelSelectionEnabled = responseData.modelSelection ?? false

          const modes: Record<string, string> = {}
          if (responseData.systemPrompts) {
            for (const [key, value] of Object.entries(
              responseData.systemPrompts
            )) {
              const description = (value as { description?: string })
                ?.description
              modes[key] = typeof description === 'string' ? description : ''
            }
          }

          const resolvedModeOptions: Record<string, string> =
            Object.keys(modes).length > 0
              ? modes
              : Object.fromEntries(
                  Object.entries(DEFAULT_PROMPT).map(([key, value]) => [
                    key,
                    (value as { description: string }).description,
                  ])
                )

          set((state) => {
            let selectedMode = state.selectedMode
            if (!resolvedModeOptions[selectedMode]) {
              selectedMode = Object.keys(resolvedModeOptions)[0] ?? selectedMode
            }

            return {
              modeOptions: resolvedModeOptions,
              modelSelectionEnabled,
              selectedMode,
            }
          })
        } catch (error) {
          console.error('Error fetching mode options:', error)
          set((state) => ({
            modeOptions: Object.fromEntries(
              Object.entries(DEFAULT_PROMPT).map(([key, value]) => [
                key,
                (value as { description: string }).description,
              ])
            ),
            selectedMode: Object.keys(DEFAULT_PROMPT)[0] ?? state.selectedMode,
            modelSelectionEnabled: false,
          }))
        }
      },

      loadCredits: async (chatbotId: string) => {
        try {
          const response = await fetch(`/api/chatbots/${chatbotId}/credits`)
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

          set((state) => {
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
