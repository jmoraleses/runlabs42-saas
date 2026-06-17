import { removeProjectChatSessions } from '@/lib/chat/projectChatStore'
import { removeAllWorkspaceSnapshots } from '@/lib/chat/workspaceSnapshots'

/** Limpia estado de chat y snapshots del navegador para un proyecto eliminado. */
export function cleanupProjectClientState(projectId: string): void {
  removeProjectChatSessions(projectId)
  removeAllWorkspaceSnapshots(projectId)
}
