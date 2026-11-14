import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeChoice = 'system' | 'light' | 'dark';

interface ThemeState {
  choice: ThemeChoice;
  choose: (choice: ThemeChoice) => void;
}

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && systemDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      choice: 'system',
      choose: (choice) => {
        apply(choice);
        set({ choice });
      },
    }),
    { name: 'cordee.theme', onRehydrateStorage: () => (state) => apply(state?.choice ?? 'system') },
  ),
);

systemDark.addEventListener('change', () => apply(useTheme.getState().choice));
