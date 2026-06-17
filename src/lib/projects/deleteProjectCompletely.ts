import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/errors'
import { requireProjectAccess } from '@/lib/projects/access'
import { deleteLocalProjectMemories } from '@/lib/studio/localMemoryStore'
import {
  chatMessagesPrefix,
  mobileBuildsPrefix,
  projectCoversPrefix,
  projectFilesPrefix,
} from '@/lib/storage/blobPaths'
import { isBlobStorageEnabled } from '@/lib/storage/config'
import { deleteAllProjectChatBlobs } from '@/lib/storage/chatImages'
import { purgeBlobPrefix } from '@/lib/storage/purgeBlobs'
import { adjustQuota } from '@/lib/storage/quota'

/** Elimina el proyecto, todas las filas hijas (CASCADE) y purga blobs asociados. */
export async function deleteProjectCompletely(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  await requireProjectAccess(supabase, projectId, userId)

  let freedBytes = 0
  if (isBlobStorageEnabled()) {
    freedBytes += await purgeBlobPrefix(projectFilesPrefix(userId, projectId))
    freedBytes += await purgeBlobPrefix(projectCoversPrefix(userId, projectId))
    freedBytes += await purgeBlobPrefix(chatMessagesPrefix(userId, projectId))
    freedBytes += await purgeBlobPrefix(mobileBuildsPrefix(userId, projectId))
    freedBytes += await deleteAllProjectChatBlobs(userId, projectId)
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw new ApiError(500, error.message)

  if (freedBytes > 0) {
    await adjustQuota(supabase, userId, -freedBytes)
  }

  await deleteLocalProjectMemories(projectId)
}
