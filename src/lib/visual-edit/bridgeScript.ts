/** Bridge de edición visual (inline en srcdoc del preview sandbox). */
export const VISUAL_EDIT_BRIDGE_SCRIPT = `(function () {
  const CHANNEL = 'runlabs42-visual-edit'
  var UNASSIGNED_LINK_ATTR = 'data-sk-unassigned-link'
  var UNASSIGNED_LINK_STYLE_ID = 'sk-unassigned-link-style'
  var connectedSkIdsByPage = {}
  var mode = 'off'
  var placementKind = null
  var placementSession = null
  var selectedId = null
  var overlay = null
  var label = null
  var panPointerId = null
  var panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 }
  var panScrollEl = null
  function getPanScrollEl() {
    var root = document.getElementById('root')
    if (root) {
      var sh = root.scrollHeight - root.clientHeight
      var sw = root.scrollWidth - root.clientWidth
      if (sh > 2 || sw > 2) return root
    }
    return document.scrollingElement || document.documentElement
  }
  function endPan() {
    panPointerId = null
    panScrollEl = null
    if (mode === 'pan') document.body.style.cursor = ''
    else document.body.style.cursor = ''
  }
  function parentPostTarget() {
    var o = window.location.origin
    return !o || o === 'null' ? '*' : o
  }
  function post(type, payload) {
    window.parent.postMessage(
      { channel: CHANNEL, type: type, payload: payload },
      parentPostTarget(),
    )
  }
  function isDesignPreview() {
    return window.__RUNLABS42_DESIGN_PREVIEW__ === true
  }
  function findAnchor(el) {
    var node = el
    while (node && node !== document.body && node !== document.documentElement) {
      if (node.nodeType === 1 && node.tagName === 'A') return node
      node = node.parentElement
    }
    return null
  }
  function blockDesignPreviewNavigation(e) {
    if (!isDesignPreview()) return false
    var a = findAnchor(e.target)
    if (!a) return false
    var href = a.getAttribute('href')
    if (href == null || href === '') return false
    e.preventDefault()
    e.stopPropagation()
    return true
  }
  function ensureUnassignedLinkStyle() {
    if (!isDesignPreview()) return
    if (document.getElementById(UNASSIGNED_LINK_STYLE_ID)) return
    var style = document.createElement('style')
    style.id = UNASSIGNED_LINK_STYLE_ID
    style.textContent =
      'a[' + UNASSIGNED_LINK_ATTR + '="true"]{outline:2px solid #3b82f6 !important;outline-offset:2px;border-radius:4px;box-shadow:0 0 0 1px rgba(59,130,246,.22);}';
    document.head.appendChild(style)
  }
  function currentPreviewPageId() {
    var pid = window.__RUNLABS42_DESIGN_PAGE_ID__
    return typeof pid === 'string' && pid.trim() ? pid.trim() : ''
  }
  function refreshUnassignedLinkMarkers() {
    if (!isDesignPreview()) return
    ensureUnassignedLinkStyle()
    var pageId = currentPreviewPageId()
    var pageConnected = pageId && connectedSkIdsByPage && connectedSkIdsByPage[pageId]
      ? connectedSkIdsByPage[pageId]
      : []
    var connectedLookup = {}
    for (var j = 0; j < pageConnected.length; j++) connectedLookup[pageConnected[j]] = true
    var anchors = document.querySelectorAll('a')
    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i]
      var skId = skIdFor(anchor)
      var hasDestination = !!(skId && connectedLookup[skId])
      if (!hasDestination) anchor.setAttribute(UNASSIGNED_LINK_ATTR, 'true')
      else anchor.removeAttribute(UNASSIGNED_LINK_ATTR)
    }
  }
  function ensureOverlay() {
    if (overlay) return
    overlay = document.createElement('div')
    overlay.id = 'sk-selection-overlay'
    overlay.style.cssText =
      'position:fixed;pointer-events:none;z-index:99998;border:2px solid #3b82f6;border-radius:4px;box-shadow:0 0 0 1px rgba(59,130,246,0.35);transition:top 80ms,left 80ms,width 80ms,height 80ms;display:none;'
    label = document.createElement('div')
    label.style.cssText =
      'position:absolute;top:-22px;left:0;background:#3b82f6;color:#fff;font:600 10px/1 system-ui;padding:3px 8px;border-radius:4px 4px 0 0;white-space:nowrap;'
    overlay.appendChild(label)
    document.body.appendChild(overlay)
  }
  var INTERACTIVE = { input: 1, button: 1, textarea: 1, select: 1, a: 1, label: 1 }
  var SELECTABLE_MEDIA = { img: 1, video: 1, picture: 1, svg: 1 }
  var SELECTABLE_TEXT = {
    h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1,
    p: 1, span: 1, li: 1, td: 1, th: 1, figcaption: 1, blockquote: 1, small: 1,
  }
  var SELECTABLE_CONTAINER = {
    div: 1, section: 1, article: 1, main: 1, header: 1, footer: 1, nav: 1, aside: 1,
    figure: 1, ul: 1, ol: 1, form: 1, fieldset: 1,
  }
  function isSelectableTag(tag) {
    return !!(INTERACTIVE[tag] || SELECTABLE_MEDIA[tag] || SELECTABLE_TEXT[tag] || SELECTABLE_CONTAINER[tag])
  }
  function isVisibleEnough(el) {
    var r = el.getBoundingClientRect()
    return r.width >= 16 && r.height >= 12
  }
  function canSelectElement(el) {
    if (!el || el.nodeType !== 1) return false
    var tag = el.tagName ? el.tagName.toLowerCase() : ''
    if (!isSelectableTag(tag)) return false
    if (skIdFor(el)) return true
    if (INTERACTIVE[tag] || SELECTABLE_MEDIA[tag] || SELECTABLE_TEXT[tag]) return true
    return SELECTABLE_CONTAINER[tag] && isVisibleEnough(el)
  }
  function isPanInteractiveTarget(el) {
    if (!el || el.nodeType !== 1) return false
    var tag = el.tagName ? el.tagName.toLowerCase() : ''
    if (INTERACTIVE[tag]) return true
    if (el.isContentEditable) return true
    var role = el.getAttribute('role')
    if (role === 'button' || role === 'link' || role === 'textbox' || role === 'checkbox' || role === 'radio') return true
    return false
  }
  function findPanInteractiveTarget(el) {
    var node = el
    while (node && node !== document.body && node !== document.documentElement) {
      if (node.nodeType === 1 && isPanInteractiveTarget(node)) return node
      node = node.parentElement
    }
    return null
  }
  function skIdFor(el) {
    return el.getAttribute('data-sk-id') || el.getAttribute('data-source-location') || ''
  }
  function ensureSkId(el) {
    var existing = skIdFor(el)
    if (existing) return existing
    if (!canSelectElement(el)) return ''
    var id = 'sk-' + Date.now().toString(36)
    el.setAttribute('data-sk-id', id)
    return id
  }
  function isDecorativeDot(el) {
    if (!el || el.nodeType !== 1) return false
    var cls = typeof el.className === 'string' ? el.className : ''
    if (/pill-dot|sk-dot|resize-dot|grip-dot/i.test(cls)) return true
    if (el.getAttribute('data-sk-no-select') === 'true') return true
    var r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && Math.max(r.width, r.height) <= 10) return true
    return false
  }
  function findSkTarget(el) {
    if (!el) return null
    if (el.nodeType === 3) el = el.parentElement
    if (!el || el.nodeType !== 1) return null
    var node = el
    while (node && node !== document.body) {
      if (node.nodeType === 1) {
        if (isDecorativeDot(node)) {
          node = node.parentElement
          continue
        }
        if (canSelectElement(node)) {
          ensureSkId(node)
          return node
        }
      }
      node = node.parentElement
    }
    return null
  }
  function readStyles(el) {
    var cs = window.getComputedStyle(el)
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      textDecoration: cs.textDecoration,
      padding: cs.padding,
      margin: cs.margin,
      textAlign: cs.textAlign,
      borderRadius: cs.borderRadius,
      borderWidth: cs.borderTopWidth,
      borderColor: cs.borderTopColor,
      opacity: cs.opacity,
    }
  }
  function ensureBorderVisible(el) {
    var cs = window.getComputedStyle(el)
    if (cs.borderStyle === 'none' || !cs.borderStyle) el.style.borderStyle = 'solid'
  }
  function findBySkId(skId) {
    return (
      document.querySelector('[data-sk-id="' + skId + '"]') ||
      document.querySelector('[data-source-location="' + skId + '"]')
    )
  }
  function readText(el) {
    var tag = el.tagName ? el.tagName.toLowerCase() : ''
    if (tag === 'input' || tag === 'textarea') {
      var v = (el.value || el.getAttribute('placeholder') || '').trim()
      return v || undefined
    }
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
      var t = (el.textContent || '').trim()
      return t || undefined
    }
    var t = (el.textContent || '').trim()
    return t.length > 0 && t.length < 200 ? t : undefined
  }
  function describe(el) {
    ensureSkId(el)
    var skId = skIdFor(el)
    var rect = el.getBoundingClientRect()
    var sourceFile = el.getAttribute('data-sk-file')
    var sourceLine = el.getAttribute('data-sk-line')
    return {
      skId: skId,
      tagName: el.tagName.toLowerCase(),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      text: readText(el),
      styles: readStyles(el),
      source: sourceFile
        ? { file: sourceFile, line: parseInt(sourceLine || '0', 10) || 0 }
        : undefined,
    }
  }
  function positionOverlay(el) {
    ensureOverlay()
    var r = el.getBoundingClientRect()
    overlay.style.display = 'block'
    overlay.style.top = r.top + 'px'
    overlay.style.left = r.left + 'px'
    overlay.style.width = r.width + 'px'
    overlay.style.height = r.height + 'px'
    var sk = el.getAttribute('data-sk-id') || el.getAttribute('data-source-location')
    label.textContent = el.tagName.toLowerCase() + (sk ? ' · ' + sk : '')
  }
  function hideOverlay() {
    if (overlay) overlay.style.display = 'none'
  }
  function applyPatchToDom(patch) {
    var el = findBySkId(patch.skId)
    if (!el) return
    var map = {
      text: function (v) {
        var tag = el.tagName ? el.tagName.toLowerCase() : ''
        if (tag === 'input' || tag === 'textarea') el.value = v
        else el.textContent = v
      },
      color: function (v) { el.style.color = v },
      backgroundColor: function (v) { el.style.backgroundColor = v },
      fontSize: function (v) { el.style.fontSize = v },
      fontWeight: function (v) { el.style.fontWeight = v },
      fontStyle: function (v) { el.style.fontStyle = v },
      textDecoration: function (v) { el.style.textDecoration = v },
      padding: function (v) { el.style.padding = v },
      margin: function (v) { el.style.margin = v },
      textAlign: function (v) { el.style.textAlign = v },
      borderRadius: function (v) { el.style.borderRadius = v },
      borderWidth: function (v) {
        el.style.borderWidth = v
        if (v && v !== '0' && v !== '0px') ensureBorderVisible(el)
      },
      borderColor: function (v) {
        el.style.borderColor = v
        if (v && v !== 'transparent') ensureBorderVisible(el)
      },
      opacity: function (v) { el.style.opacity = v },
      className: function (v) { el.className = v },
      href: function (v) {
        if (el.tagName === 'A') {
          el.setAttribute('href', v)
        }
        else {
          el.style.cursor = 'pointer'
          el.style.textDecoration = 'underline'
          el.setAttribute('data-sk-href', v)
          el.onclick = function (ev) {
            ev.preventDefault()
            window.open(v, '_blank', 'noopener,noreferrer')
          }
        }
      },
      display: function (v) {
        el.style.display = v
        if (v === 'none' && selectedId === patch.skId) {
          selectedId = null
          hideOverlay()
          post('element-select', null)
        }
      },
      src: function (v) {
        if (el.tagName === 'IMG') el.setAttribute('src', v)
      },
    }
    var fn = map[patch.property]
    if (fn) fn(patch.value)
    if (selectedId === patch.skId && patch.property !== 'display') positionOverlay(el)
    post('element-select', describe(el))
  }
  function findPlacementParent(el) {
    var node = el
    var tags = { main: 1, section: 1, article: 1, div: 1, header: 1, footer: 1 }
    while (node && node !== document.body) {
      if (node.nodeType === 1) {
        var tag = node.tagName ? node.tagName.toLowerCase() : ''
        if (tags[tag] || skIdFor(node)) {
          ensureSkId(node)
          return node
        }
      }
      node = node.parentElement
    }
    return document.body
  }
  function clearPlacementSession() {
    if (placementSession && placementSession.ghost && placementSession.ghost.parentNode) {
      placementSession.ghost.parentNode.removeChild(placementSession.ghost)
    }
    placementSession = null
  }
  function placementGhostForKind(kind) {
    var g = document.createElement('div')
    g.id = 'sk-placement-ghost'
    g.setAttribute('data-sk-no-select', 'true')
    g.style.cssText =
      'position:fixed;pointer-events:none;z-index:99999;padding:8px 12px;border-radius:8px;border:2px dashed #3b82f6;background:rgba(59,130,246,0.12);color:#1d4ed8;font:600 12px/1.2 system-ui;transform:translate(-50%,-100%);white-space:nowrap;'
    var labels = { heading: 'Título', image: 'Imagen', button: 'Botón', section: 'Sección', text: 'Texto' }
    g.textContent = labels[kind] || 'Elemento'
    return g
  }
  function movePlacementGhost(clientX, clientY) {
    if (!placementSession || !placementSession.ghost) return
    placementSession.ghost.style.left = clientX + 'px'
    placementSession.ghost.style.top = clientY + 'px'
  }
  function findInsertBefore(parent, clientX, clientY) {
    var children = []
    for (var i = 0; i < parent.children.length; i++) {
      var c = parent.children[i]
      if (c.nodeType !== 1 || c.id === 'sk-placement-ghost') continue
      children.push(c)
    }
    for (var j = 0; j < children.length; j++) {
      var r = children[j].getBoundingClientRect()
      if (clientY < r.top + r.height * 0.5) return children[j]
    }
    return null
  }
  function relativeDropInParent(parent, clientX, clientY) {
    var r = parent.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return { x: 50, y: 50 }
    return {
      x: Math.max(0, Math.min(100, Math.round(((clientX - r.left) / r.width) * 100))),
      y: Math.max(0, Math.min(100, Math.round(((clientY - r.top) / r.height) * 100))),
    }
  }
  function createPlacementNode(kind, parent, beforeEl) {
    var skId = 'sk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    var el
    if (kind === 'heading') {
      el = document.createElement('h2')
      el.textContent = 'Nuevo título'
    } else if (kind === 'image') {
      el = document.createElement('img')
      el.setAttribute('src', 'https://placehold.co/400x240')
      el.setAttribute('alt', '')
    } else if (kind === 'button') {
      el = document.createElement('button')
      el.setAttribute('type', 'button')
      el.textContent = 'Botón'
    } else if (kind === 'section') {
      el = document.createElement('div')
      el.style.minHeight = '48px'
      el.style.padding = '12px'
    } else {
      el = document.createElement('p')
      el.textContent = 'Nuevo texto'
    }
    el.setAttribute('data-sk-id', skId)
    if (beforeEl) parent.insertBefore(el, beforeEl)
    else parent.appendChild(el)
    return el
  }
  function finishPlacement(clientX, clientY) {
    var kind = placementKind || (placementSession && placementSession.kind)
    if (!kind) return
    var target = document.elementFromPoint(clientX, clientY)
    var parent = findPlacementParent(target)
    ensureSkId(parent)
    var before = findInsertBefore(parent, clientX, clientY)
    var rel = relativeDropInParent(parent, clientX, clientY)
    var created = createPlacementNode(kind, parent, before)
    var parentSk = skIdFor(parent) || 'sk-root'
    var placement = {
      kind: kind,
      skId: skIdFor(created),
      parentSkId: parentSk,
      parentTag: parent.tagName ? parent.tagName.toLowerCase() : 'div',
      insertBeforeSkId: before ? skIdFor(before) : null,
      siblingIndex: before
        ? Array.prototype.indexOf.call(parent.children, before)
        : parent.children.length,
      dropXPercent: rel.x,
      dropYPercent: rel.y,
    }
    placementKind = null
    clearPlacementSession()
    document.body.style.cursor = ''
    selectedId = skIdFor(created)
    positionOverlay(created)
    post('node-inserted', { element: describe(created), placement: placement })
    post('element-select', describe(created))
  }
  document.addEventListener('contextmenu', function (e) {
    if (placementSession || panPointerId !== null) return
    e.preventDefault()
    e.stopPropagation()
    if (mode === 'select') {
      var t = findSkTarget(e.target)
      if (t) {
        selectedId = ensureSkId(t) || skIdFor(t)
        positionOverlay(t)
        post('element-select', describe(t))
      } else {
        selectedId = null
        hideOverlay()
        post('element-select', null)
      }
    }
    post('preview-context-menu', { clientX: e.clientX, clientY: e.clientY })
  }, true)
  document.addEventListener('pointerdown', function (e) {
    if (placementSession) return
    if (e.button === 0) post('preview-pointer-down', undefined)
    if (placementKind && e.button === 0) {
      e.preventDefault()
      e.stopPropagation()
      clearPlacementSession()
      var ghost = placementGhostForKind(placementKind)
      document.body.appendChild(ghost)
      placementSession = {
        kind: placementKind,
        ghost: ghost,
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      }
      movePlacementGhost(e.clientX, e.clientY)
      document.body.style.cursor = 'crosshair'
      try {
        document.body.setPointerCapture(e.pointerId)
      } catch (err) { /* ignore */ }
      return
    }
    if (mode !== 'pan' || e.button !== 0) return
    if (blockDesignPreviewNavigation(e)) return
    if (findPanInteractiveTarget(e.target)) return
    panPointerId = e.pointerId
    panScrollEl = getPanScrollEl()
    panStart.x = e.clientX
    panStart.y = e.clientY
    panStart.scrollLeft = panScrollEl.scrollLeft
    panStart.scrollTop = panScrollEl.scrollTop
    document.body.style.cursor = 'grabbing'
    try { e.target.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
    e.preventDefault()
    e.stopPropagation()
  }, true)
  document.addEventListener('pointermove', function (e) {
    if (placementSession && e.pointerId === placementSession.pointerId) {
      movePlacementGhost(e.clientX, e.clientY)
      var dropParent = findPlacementParent(document.elementFromPoint(e.clientX, e.clientY))
      if (dropParent) positionOverlay(dropParent)
      e.preventDefault()
      return
    }
    if (panPointerId !== null && e.pointerId === panPointerId && panScrollEl) {
      panScrollEl.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x)
      panScrollEl.scrollTop = panStart.scrollTop - (e.clientY - panStart.y)
      e.preventDefault()
      return
    }
    if (mode === 'pan') return
    if (mode !== 'select' && !placementKind) return
    var t = findSkTarget(e.target)
    if (!t) {
      post('element-hover', null)
      if (!selectedId) hideOverlay()
      return
    }
    if (skIdFor(t) !== selectedId) positionOverlay(t)
    post('element-hover', describe(t))
  })
  document.addEventListener('pointerup', function (e) {
    if (placementSession && e.pointerId === placementSession.pointerId) {
      try {
        if (document.body.hasPointerCapture(e.pointerId)) {
          document.body.releasePointerCapture(e.pointerId)
        }
      } catch (err) { /* ignore */ }
      finishPlacement(e.clientX, e.clientY)
      e.preventDefault()
      return
    }
    if (panPointerId !== null && e.pointerId === panPointerId) endPan()
  })
  document.addEventListener('pointercancel', function (e) {
    if (panPointerId !== null && e.pointerId === panPointerId) endPan()
  })
  document.addEventListener('click', function (e) {
    if (placementSession) return
    if (panPointerId !== null) return
    if (mode === 'pan') {
      blockDesignPreviewNavigation(e)
      return
    }
    var blockedNav = blockDesignPreviewNavigation(e)
    if (blockedNav && mode !== 'select') return
    if (mode !== 'select') return
    if (!blockedNav) {
      e.preventDefault()
      e.stopPropagation()
    }
    var t = findSkTarget(e.target)
    if (!t) {
      selectedId = null
      hideOverlay()
      post('element-select', null)
      return
    }
    selectedId = ensureSkId(t) || skIdFor(t)
    positionOverlay(t)
    post('element-select', describe(t))
  }, true)
  document.addEventListener('auxclick', function (e) {
    if (placementSession) return
    if (panPointerId !== null) return
    if (mode === 'pan') {
      blockDesignPreviewNavigation(e)
      return
    }
    blockDesignPreviewNavigation(e)
  }, true)
  document.addEventListener('submit', function (e) {
    if (!isDesignPreview()) return
    e.preventDefault()
    e.stopPropagation()
  }, true)
  function applyMode(next) {
    mode = next
    if (mode !== 'pan') endPan()
    if (mode === 'off') {
      placementKind = null
      clearPlacementSession()
      selectedId = null
      hideOverlay()
      post('element-hover', null)
      post('element-select', null)
      document.body.style.cursor = ''
    } else if (mode === 'pan') {
      placementKind = null
      clearPlacementSession()
      selectedId = null
      hideOverlay()
      post('element-hover', null)
      post('element-select', null)
      document.body.style.cursor = ''
    } else {
      document.body.style.cursor = ''
    }
  }
  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent) return
    var d = ev.data
    if (!d || d.channel !== CHANNEL) return
    if (d.type === 'ping') {
      post('bridge-ready', undefined)
      return
    }
    if (d.type === 'init' || d.type === 'set-mode') applyMode(d.payload.mode)
    if (d.type === 'begin-placement') {
      placementKind = d.payload.kind
      mode = 'select'
      endPan()
      clearPlacementSession()
      document.body.style.cursor = 'crosshair'
      return
    }
    if (d.type === 'cancel-placement') {
      placementKind = null
      clearPlacementSession()
      document.body.style.cursor = ''
      return
    }
    if (d.type === 'highlight') {
      if (!d.payload || !d.payload.skId) {
        if (!selectedId) hideOverlay()
        return
      }
      var el = findBySkId(d.payload.skId)
      if (el) positionOverlay(el)
    }
    if (d.type === 'pick-at-point') {
      var px = d.payload.clientX
      var py = d.payload.clientY
      var hit = document.elementFromPoint(px, py)
      var picked = hit ? findSkTarget(hit) : null
      post('pin-picked', {
        clientX: px,
        clientY: py,
        element: picked ? describe(picked) : null,
      })
      return
    }
    if (d.type === 'move-sibling') {
      var moved = findBySkId(d.payload.skId)
      if (moved && moved.parentNode) {
        var par = moved.parentNode
        var sibs = []
        for (var si = 0; si < par.children.length; si++) {
          var ch = par.children[si]
          if (ch.nodeType === 1) sibs.push(ch)
        }
        var mi = sibs.indexOf(moved)
        if (d.payload.direction === 'up' && mi > 0) {
          par.insertBefore(moved, sibs[mi - 1])
        } else if (d.payload.direction === 'down' && mi >= 0 && mi < sibs.length - 1) {
          par.insertBefore(sibs[mi + 1], moved)
        }
        selectedId = moved.getAttribute('data-sk-id')
        positionOverlay(moved)
        post('element-select', describe(moved))
        post('html-updated', { html: document.documentElement.outerHTML })
      }
      return
    }
    if (d.type === 'apply-patch') applyPatchToDom(d.payload)
    if (d.type === 'set-link-assignments') {
      connectedSkIdsByPage = d.payload || {}
      refreshUnassignedLinkMarkers()
      return
    }
    if (d.type === 'reload-styles' && d.payload) {
      Object.keys(d.payload).forEach(function (skId) {
        var styles = d.payload[skId]
        Object.keys(styles).forEach(function (prop) {
          applyPatchToDom({ skId: skId, property: prop, value: styles[prop] })
        })
      })
    }
  })
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      refreshUnassignedLinkMarkers()
      post('bridge-ready', undefined)
    })
  } else {
    refreshUnassignedLinkMarkers()
    post('bridge-ready', undefined)
  }
})();`
