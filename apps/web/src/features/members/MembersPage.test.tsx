import type { MemberDto, WorkspaceDto } from '@cordee/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession, useWorkspaceChoice } from '@/stores/session';
import { MembersPage } from './MembersPage';

const me = { id: 'u-admin', name: 'Bob Admin', email: 'bob@test.dev' };
const members: MemberDto[] = [
  { user: { id: 'u-owner', name: 'Alice Owner', email: 'alice@test.dev' }, role: 'OWNER' },
  { user: me, role: 'ADMIN' },
  { user: { id: 'u-member', name: 'Chloé Membre', email: 'chloe@test.dev' }, role: 'MEMBER' },
];

function renderAs(role: WorkspaceDto['role']) {
  const workspace: WorkspaceDto = { id: 'w1', name: 'Atelier', slug: 'atelier', role };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.endsWith('/workspaces') ? [workspace] : url.endsWith('/members') ? members : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MembersPage />
    </QueryClientProvider>,
  );
}

describe('MembersPage', () => {
  beforeEach(() => {
    useSession.setState({ status: 'signed-in', user: me });
    useWorkspaceChoice.setState({ workspaceId: 'w1' });
  });

  it("ne propose de modifier ni le propriétaire ni soi-même", async () => {
    renderAs('ADMIN');
    const owner = (await screen.findByText('Alice Owner')).closest('li')!;
    expect(within(owner).getByText('Propriétaire')).toBeInTheDocument();
    expect(within(owner).queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument();

    const self = screen.getByText('(vous)').closest('li')!;
    expect(within(self).queryByRole('combobox')).not.toBeInTheDocument();

    const member = screen.getByText('Chloé Membre').closest('li')!;
    expect(within(member).getByRole('combobox', { name: 'Rôle de Chloé Membre' })).toHaveValue('MEMBER');
    expect(within(member).getByRole('button', { name: 'Retirer' })).toBeInTheDocument();
  });

  it("cache les actions d'administration à un simple membre", async () => {
    renderAs('MEMBER');
    await screen.findByText('Chloé Membre');
    expect(screen.queryByRole('button', { name: 'Inviter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument();
  });
});
