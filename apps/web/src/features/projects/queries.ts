import type {
  CreateProjectInput,
  CreateSprintInput,
  MemberDto,
  ProjectDetailDto,
  ProjectDto,
  SprintDto,
  WorkspaceDto,
} from '@cordee/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspaceChoice } from '@/stores/session';

export function useWorkspaces() {
  return useQuery({ queryKey: ['workspaces'], queryFn: () => api.get<WorkspaceDto[]>('/workspaces') });
}

/** Espace courant : le dernier choisi s'il existe encore, sinon le premier. */
export function useWorkspace(): WorkspaceDto | undefined {
  const { data } = useWorkspaces();
  const chosen = useWorkspaceChoice((state) => state.workspaceId);
  return data?.find((workspace) => workspace.id === chosen) ?? data?.[0];
}

export function useProjects() {
  const workspace = useWorkspace();
  return useQuery({
    queryKey: ['projects', workspace?.id],
    queryFn: () => api.get<ProjectDto[]>(`/workspaces/${workspace!.id}/projects`),
    enabled: !!workspace,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<ProjectDetailDto>(`/projects/${projectId}`),
  });
}

export function useMembers() {
  const workspace = useWorkspace();
  return useQuery({
    queryKey: ['members', workspace?.id],
    queryFn: () => api.get<MemberDto[]>(`/workspaces/${workspace!.id}/members`),
    enabled: !!workspace,
  });
}

export function useCreateProject() {
  const client = useQueryClient();
  const workspace = useWorkspace();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api.post<ProjectDto>(`/workspaces/${workspace!.id}/projects`, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useSprintActions(projectId: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['project', projectId] });
    void client.invalidateQueries({ queryKey: ['issues', projectId] });
  };
  return {
    create: useMutation({
      mutationFn: (input: CreateSprintInput) => api.post<SprintDto>(`/projects/${projectId}/sprints`, input),
      onSuccess: refresh,
    }),
    start: useMutation({
      mutationFn: (sprintId: string) => api.post<SprintDto>(`/sprints/${sprintId}/start`),
      onSuccess: refresh,
    }),
    complete: useMutation({
      mutationFn: (sprintId: string) => api.post<SprintDto>(`/sprints/${sprintId}/complete`),
      onSuccess: refresh,
    }),
  };
}
