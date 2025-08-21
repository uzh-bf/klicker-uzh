'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModelProvider = 'openai' | 'anthropic'
export type ChatbotMode = 'tutor' | 'explainer'

interface ModelOption {
  id: ModelProvider
  name: string
  description: string
}

interface ModeOption {
  id: ChatbotMode
  name: string
  description: string
  systemPrompt: string
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
        current: 850,
        total: 1000,
      },

      // available options
      modelOptions: [
        {
          id: 'openai',
          name: 'GPT-4.1',
          description: 'OpenAI model',
        },
        {
          id: 'anthropic',
          name: 'Claude 4 Sonnet',
          description: 'Anthropic model',
        },
      ],

      modeOptions: [
        {
          id: 'tutor',
          name: 'Tutor',
          description: 'Step-by-step learning guidance',
          systemPrompt:
            'You are an educational tutor who provides step-by-step guidance and helps users learn concepts gradually. Break down complex topics into manageable parts and encourage learning through questions and examples.',
        },
        {
          id: 'explainer',
          name: 'Explainer',
          description: 'Clear and comprehensive explanations',
          systemPrompt:
            'You are an expert explainer who provides clear, comprehensive, and detailed explanations of topics. Focus on making complex subjects understandable with thorough coverage and context.',
        },
      ],

      // actions
      setSelectedModel: (model) => set({ selectedModel: model }),
      setSelectedMode: (mode) => set({ selectedMode: mode }),
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
        credits: state.credits,
      }),
    }
  )
)
