/** Blob pathname for a demo/local project source file (sin Supabase). */
export function demoProjectFileBlobPath(projectId: string, filePath: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, '_')
  const safe = filePath
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/')
  return `demo-projects/${safeId}/${safe}`.replace(/\/+/g, '/')
}

export function demoProjectManifestBlobPath(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `demo-projects/${safeId}/manifest.json`
}

/** Blob pathname for a project source file. */
export function projectFileBlobPath(userId: string, projectId: string, filePath: string): string {
  const safe = filePath
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/')
  return `projects/${userId}/${projectId}/${safe}`.replace(/\/+/g, '/')
}

/** Prefix for all source files of a project — used for bulk deletion. */
export function projectFilesPrefix(userId: string, projectId: string): string {
  return `projects/${userId}/${projectId}/`
}

/** Blob pathname for a project cover image. */
export function coverBlobPath(userId: string, projectId: string, index: number, ext: string): string {
  return `covers/${userId}/${projectId}/cover-${index}.${ext}`
}

/** Prefix for all cover images of a project — used for bulk deletion. */
export function projectCoversPrefix(userId: string, projectId: string): string {
  return `covers/${userId}/${projectId}/`
}

/** Prefix for chat blobs scoped to a project session. */
export function chatSessionPrefix(
  userId: string,
  projectId: string,
  sessionId: string,
): string {
  return `chat/${userId}/${projectId}/${sessionId}/`
}

/** Legacy prefix (pre project-scoped chat paths). */
export function legacyChatSessionPrefix(userId: string, sessionId: string): string {
  return `chat/${userId}/${sessionId}/`
}

export function chatImageBlobPath(
  userId: string,
  projectId: string,
  sessionId: string,
  fileId: string,
): string {
  return `${chatSessionPrefix(userId, projectId, sessionId)}${fileId}`
}

/** Prefix for all chat blobs of a project (all sessions). */
export function projectChatPrefix(userId: string, projectId: string): string {
  return `chat/${userId}/${projectId}/`
}

/** Prefix for mobile build artifacts. */
export function mobileBuildsPrefix(userId: string, projectId: string): string {
  return `mobile-builds/${userId}/${projectId}/`
}

/** Prefix for large chat message bodies stored in Blob. */
export function chatMessagesPrefix(userId: string, projectId: string): string {
  return `chat-messages/${userId}/${projectId}/`
}

/** Prefix for all demo project files (manifest + sources). */
export function demoProjectsPrefix(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `demo-projects/${safeId}/`
}

/** Referencia visual de diseño (boceto / captura). */
export function designRefBlobPath(
  userId: string,
  projectId: string,
  fileId: string,
): string {
  return `design-refs/${userId}/${projectId}/${fileId}`
}

/** Snapshot JSON de importación Figma. */
export function figmaImportBlobPath(
  userId: string,
  projectId: string,
  importId: string,
): string {
  return `figma-imports/${userId}/${projectId}/${importId}.json`
}

/** Bundle de exportación hacia Figma (plugin companion). */
export function figmaExportBlobPath(
  userId: string,
  projectId: string,
  exportId: string,
): string {
  return `figma-exports/${userId}/${projectId}/${exportId}.json`
}
