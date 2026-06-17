figma.showUI(__html__, { width: 360, height: 420 })

async function loadImage(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function nodeFromExport(n) {
  if (n.type === 'TEXT') {
    const text = figma.createText()
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    text.name = n.name
    text.characters = n.characters || n.name
    if (n.fills && n.fills[0] && n.fills[0].color) {
      const c = n.fills[0].color
      text.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }]
    }
    return text
  }

  if (n.type === 'IMAGE' && n.imageUrl) {
    const frame = figma.createFrame()
    frame.name = n.name
    frame.resize(n.width || 200, n.height || 120)
    const bytes = await loadImage(n.imageUrl)
    if (bytes) {
      const img = figma.createImage(bytes)
      frame.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: img.hash }]
    }
    return frame
  }

  const frame = figma.createFrame()
  frame.name = n.name
  frame.resize(n.width || 390, n.height || 844)
  frame.layoutMode = 'VERTICAL'
  frame.primaryAxisSizingMode = 'AUTO'
  frame.counterAxisSizingMode = 'FIXED'
  if (n.fills && n.fills[0] && n.fills[0].color) {
    const c = n.fills[0].color
    frame.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }]
  }
  for (const child of n.children || []) {
    frame.appendChild(await nodeFromExport(child))
  }
  return frame
}

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'import') return
  const { apiBase, projectId, exportId, token } = msg
  if (!apiBase || !projectId || !exportId || !token) {
    figma.ui.postMessage({ type: 'status', text: 'Completa todos los campos' })
    return
  }
  figma.ui.postMessage({ type: 'status', text: 'Descargando bundle…' })
  try {
    const url =
      apiBase.replace(/\/$/, '') +
      '/api/projects/' +
      projectId +
      '/design/figma/export/' +
      exportId +
      '?token=' +
      encodeURIComponent(token)
    const res = await fetch(url)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const bundle = await res.json()
    let x = 0
    for (const page of bundle.pages) {
      const root = await nodeFromExport(page.root)
      root.x = x
      root.y = 0
      figma.currentPage.appendChild(root)
      x += (page.root.width || 390) + 80
    }
    figma.ui.postMessage({
      type: 'status',
      text: 'Importadas ' + bundle.pages.length + ' pantallas',
    })
    figma.closePlugin()
  } catch (e) {
    figma.ui.postMessage({
      type: 'status',
      text: e && e.message ? e.message : 'Error al importar',
    })
  }
}
