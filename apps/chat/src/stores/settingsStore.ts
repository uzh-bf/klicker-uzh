'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getModelOptions, type ModelProvider } from '../lib/config/models'
import { getModeOptions } from '../lib/config/modes'
import { type ChatbotMode } from '../lib/config/prompts'

interface ModelOption {
  id: ModelProvider
  name: string
  description: string
}

interface ModeOption {
  id: ChatbotMode
  name: string
  description: string
}

interface SettingsState {
  // Current selections
  selectedModel: ModelProvider
  selectedMode: ChatbotMode
  credits: {
    current: number
    total: number
  }

  // Available options
  modelOptions: ModelOption[]
  modeOptions: ModeOption[]

  // Actions
  setSelectedModel: (model: ModelProvider) => void
  setSelectedMode: (mode: ChatbotMode) => void
  loadCredits: (chatbotId: string) => Promise<void>
  decrementCredits: (amount: number) => void
  resetCredits: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // initial state
      selectedModel: 'openai',
      selectedMode: 'tutor',
      credits: {
        current: 0,
        total: 0,
      },

      // available options
      modelOptions: getModelOptions(),

      modeOptions: getModeOptions(),

      // actions
      setSelectedModel: (model) => set({ selectedModel: model }),
      setSelectedMode: (mode) => set({ selectedMode: mode }),

      loadCredits: async (chatbotId) => {
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
