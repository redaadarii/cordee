import type { IssueDto, SprintDto, StatusDto } from '@cordee/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Rope } from './Rope';

const statuses: StatusDto[] = [
  { id: 'todo', name: 'À faire', category: 'TODO', position: 0, wipLimit: null },
  { id: 'doing', name: 'En cours', category: 'IN_PROGRESS', position: 1, wipLimit: null },
  { id: 'done', name: 'Terminé', category: 'DONE', position: 2, wipLimit: null },
];

const issue = (id: string, statusId: string) => ({ id, statusId }) as IssueDto;

const sprint: SprintDto = {
  id: 's1',
  name: 'Sprint 7',
  goal: 'Paiement en ligne',
  state: 'ACTIVE',
  startDate: null,
  endDate: null,
};

describe('Rope', () => {
  it("décrit l'avancement en texte, pas seulement par la couleur des nœuds", () => {
    render(
      <Rope
        sprint={sprint}
        statuses={statuses}
        issues={[issue('a', 'done'), issue('b', 'done'), issue('c', 'doing'), issue('d', 'todo')]}
      />,
    );
    expect(screen.getByRole('img', { name: '2 tickets terminés sur 4, 1 en cours' })).toBeInTheDocument();
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getByText('Paiement en ligne')).toBeInTheDocument();
  });

  it("n'affiche pas de corde pour un sprint vide", () => {
    render(<Rope sprint={sprint} statuses={statuses} issues={[]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
