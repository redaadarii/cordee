import type { IssueDto, ProjectEvent } from '@cordee/shared';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSession } from '@/stores/session';
import { getAccessToken } from './api';
import { queryClient } from './query';

let socket: Socket | null = null;

function connect(): Socket {
  socket ??= io({
    // Rappelé à chaque (re)connexion : le jeton d'accès a pu tourner entre-temps.
    auth: (cb) => cb({ token: getAccessToken() }),
    transports: ['websocket'],
  });
  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

export function upsertIssue(issue: IssueDto) {
  queryClient.setQueryData<IssueDto[]>(['issues', issue.projectId], (current) => {
    if (!current) return current;
    const others = current.filter((existing) => existing.id !== issue.id);
    return [...others, issue];
  });
}

function apply(event: ProjectEvent, myId: string | undefined) {
  // Mes propres changements sont déjà dans le cache (mise à jour optimiste).
  if (event.actorId === myId) return;

  switch (event.type) {
    case 'issue.created':
    case 'issue.updated':
    case 'issue.moved':
      upsertIssue(event.issue);
      void queryClient.invalidateQueries({ queryKey: ['issue', event.issue.id] });
      void queryClient.invalidateQueries({ queryKey: ['activity', event.issue.id] });
      break;
    case 'issue.deleted':
      queryClient.setQueryData<IssueDto[]>(['issues', event.projectId], (current) =>
        current?.filter((issue) => issue.id !== event.issueId),
      );
      break;
    case 'comment.created':
    case 'issue.touched':
      void queryClient.invalidateQueries({ queryKey: ['comments', event.issueId] });
      void queryClient.invalidateQueries({ queryKey: ['issue', event.issueId] });
      void queryClient.invalidateQueries({ queryKey: ['issues', event.projectId] });
      break;
    case 'board.changed':
      void queryClient.invalidateQueries({ queryKey: ['project', event.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['issues', event.projectId] });
      break;
  }
}

export function useProjectRealtime(projectId: string) {
  const myId = useSession((state) => state.user?.id);

  useEffect(() => {
    const client = connect();
    const join = () => client.emit('project:join', projectId);
    const onEvent = (event: ProjectEvent) => apply(event, myId);

    join();
    client.on('connect', join);
    client.on('project:event', onEvent);
    return () => {
      client.emit('project:leave', projectId);
      client.off('connect', join);
      client.off('project:event', onEvent);
    };
  }, [projectId, myId]);
}

export function useNotificationRealtime() {
  useEffect(() => {
    const client = connect();
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['my-issues'] });
    };
    client.on('notification', refresh);
    return () => {
      client.off('notification', refresh);
    };
  }, []);
}
