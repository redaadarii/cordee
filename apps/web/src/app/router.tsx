import { type ComponentType, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AuthPage } from '@/features/auth/AuthPage';
import { ProjectLayout } from '@/features/projects/ProjectLayout';
import { AppShell } from './AppShell';

// Une page par morceau de bundle : on ne charge que l'écran ouvert.
function page(load: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(load);
  return <Page />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/register', element: <AuthPage mode="register" /> },
  { path: '/forgot-password', element: page(() => import('@/features/auth/PasswordPages').then((m) => ({ default: m.ForgotPasswordPage }))) },
  { path: '/reset-password', element: page(() => import('@/features/auth/PasswordPages').then((m) => ({ default: m.ResetPasswordPage }))) },
  { path: '/invite/:token', element: page(() => import('@/features/auth/InvitePage').then((m) => ({ default: m.InvitePage }))) },
  {
    element: <AppShell />,
    children: [
      { index: true, element: page(() => import('@/features/home/MyWorkPage').then((m) => ({ default: m.MyWorkPage }))) },
      { path: 'projects', element: page(() => import('@/features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage }))) },
      { path: 'members', element: page(() => import('@/features/members/MembersPage').then((m) => ({ default: m.MembersPage }))) },
      { path: 'account', element: page(() => import('@/features/account/AccountPage').then((m) => ({ default: m.AccountPage }))) },
      {
        path: 'p/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Navigate to="board" replace /> },
          { path: 'board', element: page(() => import('@/features/board/BoardPage').then((m) => ({ default: m.BoardPage }))) },
          { path: 'backlog', element: page(() => import('@/features/backlog/BacklogPage').then((m) => ({ default: m.BacklogPage }))) },
          { path: 'list', element: page(() => import('@/features/list/ListPage').then((m) => ({ default: m.ListPage }))) },
          { path: 'calendar', element: page(() => import('@/features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage }))) },
          { path: 'reports', element: page(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage }))) },
          { path: 'settings', element: page(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
