import type {
  ActivityDto,
  AttachmentDto,
  CommentDto,
  CreateIssueInput,
  IssueDetailDto,
  IssueDto,
  MoveIssueInput,
  MyIssueDto,
  UpdateIssueInput,
} from '@cordee/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { upsertIssue } from '@/lib/realtime';

export const byRank = (a: IssueDto, b: IssueDto) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0);

export function useIssues(projectId: string) {
  return useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => api.get<IssueDto[]>(`/projects/${projectId}/issues`),
  });
}

export function useIssue(issueId: string) {
  return useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => api.get<IssueDetailDto>(`/issues/${issueId}`),
  });
}

export function useMyIssues() {
  return useQuery({ queryKey: ['my-issues'], queryFn: () => api.get<MyIssueDto[]>('/me/issues') });
}

export function useComments(issueId: string) {
  return useQuery({
    queryKey: ['comments', issueId],
    queryFn: () => api.get<CommentDto[]>(`/issues/${issueId}/comments`),
  });
}

export function useActivity(issueId: string) {
  return useQuery({
    queryKey: ['activity', issueId],
    queryFn: () => api.get<ActivityDto[]>(`/issues/${issueId}/activity`),
  });
}

export function useCreateIssue(projectId: string) {
  return useMutation({
    mutationFn: (input: Partial<CreateIssueInput> & { title: string }) =>
      api.post<IssueDto>(`/projects/${projectId}/issues`, input),
    onSuccess: upsertIssue,
  });
}

export function useUpdateIssue(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, changes }: { issueId: string; changes: UpdateIssueInput }) =>
      api.patch<IssueDto>(`/issues/${issueId}`, changes),
    onSuccess: (issue) => {
      upsertIssue(issue);
      void client.invalidateQueries({ queryKey: ['issue', issue.id] });
      void client.invalidateQueries({ queryKey: ['activity', issue.id] });
      void client.invalidateQueries({ queryKey: ['my-issues'] });
    },
    onError: () => client.invalidateQueries({ queryKey: ['issues', projectId] }),
  });
}

export function useMoveIssue(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, ...input }: MoveIssueInput & { issueId: string }) =>
      api.post<IssueDto>(`/issues/${issueId}/move`, input),
    onSuccess: (issue) => {
      upsertIssue(issue);
      void client.invalidateQueries({ queryKey: ['activity', issue.id] });
    },
    // Le tableau a déjà bougé à l'écran : en cas de refus, on recharge l'état réel.
    onError: () => client.invalidateQueries({ queryKey: ['issues', projectId] }),
  });
}

export function useDeleteIssue(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) => api.delete(`/issues/${issueId}`),
    onSuccess: (_, issueId) => {
      client.setQueryData<IssueDto[]>(['issues', projectId], (current) =>
        current?.filter((issue) => issue.id !== issueId),
      );
    },
  });
}

export function useCommentActions(issueId: string, projectId: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['comments', issueId] });
    void client.invalidateQueries({ queryKey: ['issues', projectId] });
    void client.invalidateQueries({ queryKey: ['issue', issueId] });
  };
  return {
    update: useMutation({
      mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
        api.patch<CommentDto>(`/comments/${commentId}`, { body }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (commentId: string) => api.delete(`/comments/${commentId}`),
      onSuccess: refresh,
    }),
  };
}

export function useAttachmentActions(issueId: string) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ['issue', issueId] });
  return {
    upload: useMutation({
      mutationFn: (file: File) => api.upload<AttachmentDto>(`/issues/${issueId}/attachments`, file),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (attachmentId: string) => api.delete(`/attachments/${attachmentId}`),
      onSuccess: refresh,
    }),
  };
}

export function useAddComment(issueId: string, projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<CommentDto>(`/issues/${issueId}/comments`, { body }),
    onSuccess: (comment) => {
      client.setQueryData<CommentDto[]>(['comments', issueId], (current) => [...(current ?? []), comment]);
      void client.invalidateQueries({ queryKey: ['issues', projectId] });
      void client.invalidateQueries({ queryKey: ['issue', issueId] });
    },
  });
}
