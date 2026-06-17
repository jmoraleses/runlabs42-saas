export type FileOperation =
  | { type: 'create' | 'update'; path: string; content: string; language?: string }
  | { type: 'delete'; path: string }

export type ParsedSegment =
  | { kind: 'text'; content: string }
  | { kind: 'code'; lang: string; path: string | null; content: string; complete: boolean }
