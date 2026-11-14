import type { AuthDto, UserDto } from '@cordee/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, refreshSession, setAccessToken, setSessionLostHandler } from '@/lib/api';
import { queryClient } from '@/lib/query';
import { disconnectRealtime } from '@/lib/realtime';

interface SessionState {
  status: 'loading' | 'signed-in' | 'signed-out';
  user: UserDto | null;
  restore: () => Promise<void>;
  open: (session: AuthDto) => void;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  restore: async () => {
    const session = await refreshSession();
    set(session ? { status: 'signed-in', user: session.user } : { status: 'signed-out', user: null });
  },
  open: (session) => {
    setAccessToken(session.accessToken);
    set({ status: 'signed-in', user: session.user });
  },
  signOut: async () => {
    await api.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    disconnectRealtime();
    queryClient.clear();
    set({ status: 'signed-out', user: null });
  },
}));

setSessionLostHandler(() => {
  disconnectRealtime();
  queryClient.clear();
  useSession.setState({ status: 'signed-out', user: null });
});

export const useCurrentUser = () => useSession((state) => state.user!);

interface WorkspaceChoice {
  workspaceId: string | null;
  choose: (workspaceId: string) => void;
}

export const useWorkspaceChoice = create<WorkspaceChoice>()(
  persist(
    (set) => ({
      workspaceId: null,
      choose: (workspaceId) => set({ workspaceId }),
    }),
    { name: 'cordee.workspace' },
  ),
);
