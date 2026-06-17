export function designMdNarrativeBody(markdown: string): string {
  return markdown.includes('\n---\n')
    ? markdown.slice(markdown.indexOf('\n---\n') + 5)
    : markdown
}

export function extractDesignMdSection(markdown: string, heading: string): string {
  const body = designMdNarrativeBody(markdown)
  const re = new RegExp(
    `(${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)(?=\\n## |$)`,
  )
  return body.match(re)?.[1]?.trim() ?? ''
}
