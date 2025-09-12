'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getModelOptions, ModelID } from '../lib/config/models'
import { DEFAULT_PROMPT } from '../lib/config/prompts'

interface ModelOption {
  id: ModelID
  name: string
  description: string
}

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
      selectedMode: 'Tutor',
      credits: {
        current: 0.0,
        total: 0.0,
      },
      modeOptions: {},

      // available options
      modelOptions: getModelOptions(),

      // get mode options from db; if not available, use default prompt
      loadModeOptions: async (chatbotId: string) => {
        try {
          const response = await fetch(`api/chatbots/${chatbotId}`)
          const responseData = await response.json()
          if (response.ok && responseData.systemPrompts) {
            const modes: Record<string, string> = {}
            for (const [key, value] of Object.entries(
              responseData.systemPrompts
            )) {
              modes[key] = (value as { description: string }).description
            }
            set({ modeOptions: modes })
            // Set the first mode as selectedMode
            const firstModeKey = Object.keys(modes)[0]
            if (firstModeKey) set({ selectedMode: firstModeKey })
            console.log('First mode key:', firstModeKey)
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
            set({ credits: creditsData })
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
