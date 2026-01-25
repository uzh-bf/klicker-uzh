'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type ModelID, type ModelOption } from '../lib/config/models'
import { DEFAULT_PROMPT } from '../lib/config/prompts'

export interface ModeOption {
  name: string
  description: string
}

interface SettingsState {
  // Current selections
  selectedModel: ModelID
  selectedMode: string
  credits: {
    current: number
    total: number
  }
  modelSelectionEnabled: boolean

  // Available options
  modelOptions: ModelOption[]
  modeOptions: Record<string, string>

  // Actions
  setSelectedModel: (model: ModelID) => void
  setSelectedMode: (mode: string) => void
  loadBootstrap: (chatbotId: string) => Promise<void>
  decrementCredits: (amount: number) => void
  resetCredits: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // initial state
      selectedModel: 'gpt-4.1',
      selectedMode: 'tutor',
      credits: {
        current: 0.0,
        total: 0.0,
      },
      modelSelectionEnabled: false,
      modeOptions: {},

      // available options
      modelOptions: [],

      // actions
      setSelectedModel: (model) => set({ selectedModel: model }),
      setSelectedMode: (mode: string) => set({ selectedMode: mode }),

      loadBootstrap: async (chatbotId: string) => {
        try {
          const response = await fetch(`/api/chatbots/${chatbotId}/bootstrap`)
          if (!response.ok) {
            console.error('Failed to load bootstrap:', response.statusText)
            return
          }

          const data = await response.json()

          const creditsData = data.credits ?? { current: 0, total: 0 }
          const modelSelectionEnabled = data.modelSelectionEnabled ?? false
          const availableModels: ModelOption[] = data.availableModels ?? []
          const automaticModelId: string | undefined = data.automaticModelId

          const resolvedModeOptions: Record<string, string> =
            data.modeOptions && Object.keys(data.modeOptions).length > 0
              ? data.modeOptions
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

            let selectedModel = state.selectedModel
            if (!modelSelectionEnabled) {
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

            return {
              credits: creditsData,
              modelSelectionEnabled,
              modeOptions: resolvedModeOptions,
              modelOptions: availableModels,
              selectedMode,
              selectedModel,
            }
          })
        } catch (error) {
          console.error('Error loading bootstrap:', error)
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
      }),
    }
  )
)
