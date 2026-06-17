import { promisify } from 'node:util'
import { exec as execCb } from 'node:child_process'

const exec = promisify(execCb)

export type PlatformSeedResult = {
  message: string
  details: string[]
}

async function tryExec(
  cmd: string,
  workspaceRoot: string,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const out = await exec(cmd, { cwd: workspaceRoot })
    return {
      ok: true,
      stdout: String(out.stdout ?? '').trim(),
      stderr: String(out.stderr ?? '').trim(),
    }
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runPlatformSeed(
  platformId: string,
  workspaceRoot: string,
  templateProducts: Array<{ title: string; description: string }>,
  productSource: string,
): Promise<PlatformSeedResult> {
  if (platformId === 'wordpress') {
    const details: string[] = [`Origen productos: ${productSource}`]
    for (const product of templateProducts) {
      const created = await tryExec(
        `docker run --rm --user 33:33 --network cms-net --volumes-from wp-local wordpress:cli wp post create --post_type=post --post_status=publish --post_title="${product.title.replace(/"/g, '\\"')}" --post_content="${product.description.replace(/"/g, '\\"')}" --allow-root`,
        workspaceRoot,
      )
      if (created.ok) details.push(`WordPress item creado: ${product.title}`)
      else details.push(`WordPress item no creado (${product.title}): ${created.stderr}`)
    }
    return { message: 'Seed WordPress ejecutado con productos detectados en plantilla.', details }
  }

  if (platformId === 'joomla') {
    const details: string[] = [`Origen productos: ${productSource}`]
    const resolvePrefix = await tryExec(
      `docker exec joomla-db-local mysql -ujoomla -pjoomla -Nse "SELECT table_name FROM information_schema.tables WHERE table_schema='joomla' AND table_name LIKE '%_content' LIMIT 1;"`,
      workspaceRoot,
    )
    if (!resolvePrefix.ok || !resolvePrefix.stdout) {
      return {
        message: 'Joomla instalado, pero no se detectó tabla de contenido para seed automático.',
        details: [...details, resolvePrefix.stderr || 'No se encontró prefijo de tablas Joomla.'],
      }
    }
    const tableName = resolvePrefix.stdout.trim()
    const prefix = tableName.endsWith('_content')
      ? tableName.slice(0, tableName.length - '_content'.length)
      : 'joom'
    details.push(`Tabla detectada: ${tableName}`)
    let created = 0
    for (const product of templateProducts) {
      const alias = product.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 90) || `producto-${Date.now()}`
      const safeTitle = product.title.replace(/["\\]/g, '\\$&')
      const safeDescription = product.description.replace(/["\\]/g, '\\$&')
      const insert = await tryExec(
        `docker exec joomla-db-local mysql -ujoomla -pjoomla joomla -e 'INSERT INTO ${prefix}_content (\`asset_id\`, \`title\`, \`alias\`, \`introtext\`, \`fulltext\`, \`state\`, \`catid\`, \`created\`, \`created_by\`, \`created_by_alias\`, \`modified\`, \`modified_by\`, \`images\`, \`urls\`, \`attribs\`, \`version\`, \`ordering\`, \`metadesc\`, \`access\`, \`hits\`, \`metadata\`, \`featured\`, \`language\`, \`note\`) VALUES (0, "${safeTitle}", "${alias}", "${safeDescription}", "", 1, 2, NOW(), 0, "", NOW(), 0, "", "", "{}", 1, 0, "", 1, 0, "{}", 0, "*", "");'`,
        workspaceRoot,
      )
      if (insert.ok) {
        created += 1
        details.push(`Joomla item creado: ${product.title}`)
      } else {
        details.push(`Joomla item no creado (${product.title}): ${insert.stderr}`)
      }
    }
    return {
      message:
        created > 0
          ? `Seed Joomla aplicado (${created}/${templateProducts.length}).`
          : 'Joomla instalado, pero el seed de productos no pudo crear registros.',
      details,
    }
  }

  return { message: 'Sin seed específico para esta plataforma.', details: [] }
}
