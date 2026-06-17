/** Indica si el turno de stream ya aplicó archivos al workspace. */
export function streamFilesWereApplied(input: {
  streamFilesAppliedFlag: boolean
  streamAppliedPathsCount: number
  appliedTouchedCount: number
  alreadyInBuffers: boolean
  updateOpsCount: number
}): boolean {
  return (
    input.streamFilesAppliedFlag ||
    input.streamAppliedPathsCount > 0 ||
    input.appliedTouchedCount > 0 ||
    (input.alreadyInBuffers && input.updateOpsCount > 0)
  )
}
