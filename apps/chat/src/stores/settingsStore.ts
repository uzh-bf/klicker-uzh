'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getModelOptions, ModelID } from '../lib/config/models'
import { DEFAULT_PROMPT } from '../lib/config/prompts'

interface ModelOption {
  id: ModelID
  name: string
  description: string
  fallback: boolean
}

export interface ModeOption {
  name: string
  description: string
}

// Utility function for automatic model selection
function getAutomaticModel(credits: { current: number }): ModelID {
  // Use primary model (GPT-4.1) when credits are available
  // Use fallback model (GPT-4.1-mini) when no credits
  return credits.current > 0 ? 'gpt-4.1' : 'gpt-4.1-mini'
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
      credits: {
        current: 0.0,
        total: 0.0,
      },
      modelSelectionEnabled: false,
      modeOptions: {},

      // available options

      modelOptions: getModelOptions().filter((m) => m.fallback),

      // get mode options from db; if not available, use default prompt
      loadModeOptions: async (chatbotId: string) => {
        try {
          const response = await fetch(`api/chatbots/${chatbotId}`)
          const responseData = await response.json()
          if (response.ok) {
            // Load model selection setting
            const modelSelectionEnabled = responseData.modelSelection ?? false

            // Load mode options
            const modes: Record<string, string> = {}
            if (responseData.systemPrompts) {
              for (const [key, value] of Object.entries(
                responseData.systemPrompts
              )) {
                modes[key] = (value as { description: string }).description
              }
            }

            set({
              modeOptions: modes,
              modelSelectionEnabled,
            })

            // Set the first mode as selectedMode
            const firstModeKey = Object.keys(modes)[0]
            if (firstModeKey) set({ selectedMode: firstModeKey })
          } else {
            console.warn(
              'No valid mode options found, falling back to defaults.'
            )
            set({
              modeOptions: Object.fromEntries(
                Object.entries(DEFAULT_PROMPT).map(([key, value]) => [
                  key,
                  (value as { description: string }).description,
                ])
              ),
              selectedMode: Object.keys(DEFAULT_PROMPT)[0],
            })
          }
        } catch (error) {
          console.error('Error fetching mode options:', error)
        }
      },

      // actions
      setSelectedModel: (model) => set({ selectedModel: model }),
      setSelectedMode: (mode: string) => set({ selectedMode: mode }),

      loadCredits: async (chatbotId: string) => {
        try {
          const response = await fetch(`/api/chatbots/${chatbotId}/credits`)
          if (response.ok) {
            const creditsData = await response.json()

            const allModels = getModelOptions()
            const availableModels =
              creditsData.current > 0
                ? allModels
                : allModels.filter((m) => m.fallback)

            set((state) => {
              let selectedModel = state.selectedModel

              // If model selection is disabled, automatically select based on credits
              if (!state.modelSelectionEnabled) {
                selectedModel = getAutomaticModel(creditsData)
              } else {
                // For manual selection, check if current model is still available
                const isSelectedModelAvailable = availableModels.some(
                  (m) => m.id === state.selectedModel
                )
                if (!isSelectedModelAvailable) {
                  selectedModel = availableModels[0]?.id
                }
              }

              return {
                credits: creditsData,
                modelOptions: availableModels,
                selectedModel,
              }
            })
          } else {
            console.error('Failed to load credits:', response.statusText)
          }
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
      }),
    }
  )
)
