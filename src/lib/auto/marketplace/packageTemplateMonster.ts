import 'server-only'

import JSZip from 'jszip'
import type { CodeTemplate } from '@/lib/codeTemplates'
import type { ProjectFilesContext } from '@/lib/storage/requireProjectFilesContext'
import type { MarketplaceListing } from '@/lib/auto/marketplace/generateListingMetadata'

export async function packageTemplateMonsterZip(opts: {
  ctx: ProjectFilesContext
  variantId: string
  codeTemplate: CodeTemplate
  projectName: string
  listing: MarketplaceListing
  coverPngBase64: string
  installablePath: string
}): Promise<{ zipBase64: string; packagePath: string; listingPath: string }> {
  const files = await opts.ctx.store.list()
  const prefix = `export/variants/${opts.variantId}/${opts.codeTemplate}/`
  const variantFiles = files.filter((f) => f.path.startsWith(prefix) || f.path.startsWith(`spec/store-templates/${opts.variantId}/`))

  const zip = new JSZip()
  zip.file('marketplace/templatemonster/readme.txt', `Template: ${opts.projectName}\nPlatform: ${opts.codeTemplate}\n`)
  zip.file(
    'marketplace/templatemonster/Documentation/index.html',
    `<!doctype html><html><head><meta charset="utf-8"><title>${opts.listing.title}</title></head><body><h1>${opts.listing.title}</h1><p>${opts.listing.shortDescription}</p><h2>Install</h2><p>Use files in ${opts.installablePath}</p></body></html>`,
  )
  zip.file(
    'marketplace/templatemonster/Demo Content/README.txt',
    `Demo content placeholder for ${opts.projectName}`,
  )
  zip.file('marketplace/templatemonster/Preview/cover.png', Buffer.from(opts.coverPngBase64, 'base64'))

  for (const f of variantFiles) {
    if (f.path.endsWith('.png') && f.content.length > 100) {
      try {
        zip.file(f.path.replace(/^export\/variants\/[^/]+\/[^/]+\//, ''), Buffer.from(f.content, 'base64'))
      } catch {
        zip.file(f.path, f.content)
      }
    } else if (!f.path.endsWith('.png')) {
      const rel = f.path.replace(new RegExp(`^export/variants/${opts.variantId}/${opts.codeTemplate}/`), '')
      if (rel && !rel.startsWith('spec/')) zip.file(rel, f.content)
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const zipBase64 = zipBuffer.toString('base64')
  const packagePath = `spec/marketplace-listings/${opts.variantId}/package.zip`
  const listingPath = `spec/marketplace-listings/${opts.variantId}/listing.json`

  const listingWithCover = {
    ...opts.listing,
    coverImagePath: `assets/covers/${opts.variantId}/cover.png`,
    packagePath,
    codeTemplate: opts.codeTemplate,
    variantId: opts.variantId,
  }

  await opts.ctx.store.putMany([
    { path: packagePath, content: zipBase64 },
    { path: listingPath, content: JSON.stringify(listingWithCover, null, 2) },
    {
      path: `spec/marketplace-listings/${opts.variantId}/submit-log.json`,
      content: JSON.stringify({ status: 'packaged', at: new Date().toISOString() }, null, 2),
    },
  ])

  return { zipBase64, packagePath, listingPath }
}
