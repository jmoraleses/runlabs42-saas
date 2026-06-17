/** Artefactos Spec-Driven Development (inspirado en github/spec-kit, MIT).
 * Los archivos .md viven en la carpeta `spec/` del workspace.
 */

import { SPEC_KIT_PATHS } from '@/lib/projects/specPaths'

export {
  SPEC_DIR,
  SPEC_KIT_PATHS,
  isSpecWorkspacePath,
  migrateLegacySpecPath,
  migrateSpecFiles,
  specContentFromFiles,
  hasSpecWorkspaceContent,
} from '@/lib/projects/specPaths'

export type SpecKitPhase =
  | 'constitution'
  | 'specify'
  | 'plan'
  | 'tasks'
  | 'implement'

export type SpecKitArtifacts = {
  constitution: string
  spec: string
  plan: string
  tasks: string
}

export const EMPTY_ARTIFACTS: SpecKitArtifacts = {
  constitution: '',
  spec: '',
  plan: '',
  tasks: '',
}

export function artifactsFromFiles(
  files: { path: string; content: string }[],
  specContent = '',
): SpecKitArtifacts {
  const byPath = new Map(files.map((f) => [f.path, f.content]))
  return {
    constitution: byPath.get(SPEC_KIT_PATHS.constitution) ?? '',
    spec: byPath.get(SPEC_KIT_PATHS.spec) ?? specContent,
    plan: byPath.get(SPEC_KIT_PATHS.plan) ?? '',
    tasks: byPath.get(SPEC_KIT_PATHS.tasks) ?? '',
  }
}

export function artifactUpdatesForPhase(
  phase: SpecKitPhase,
  content: string,
): { path: string; content: string }[] {
  switch (phase) {
    case 'constitution':
      return [{ path: SPEC_KIT_PATHS.constitution, content }]
    case 'specify':
      return [{ path: SPEC_KIT_PATHS.spec, content }]
    case 'plan':
      return [{ path: SPEC_KIT_PATHS.plan, content }]
    case 'tasks':
      return [{ path: SPEC_KIT_PATHS.tasks, content }]
    case 'implement':
      return []
    default:
      return []
  }
}
