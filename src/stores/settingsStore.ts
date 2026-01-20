import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  theme: 'light' | 'dark';
  cloudSyncEnabled: boolean;
  language: 'zh-CN' | 'en-US';
}

interface SettingsActions {
  setTheme: (theme: SettingsState['theme']) => void;
  toggleTheme: () => void;
  setCloudSyncEnabled: (enabled: boolean) => void;
  setLanguage: (language: SettingsState['language']) => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'light',
      cloudSyncEnabled: false,
      language: 'zh-CN',

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
      setCloudSyncEnabled: (enabled) => set({ cloudSyncEnabled: enabled }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

