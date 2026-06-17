/**
 * Runlabs42 visual-edit bridge (sandbox iframe).
 * Selección por data-sk-id / data-source-location — mismo patrón que Base44.
 */
(function () {
  const CHANNEL = 'runlabs42-visual-edit'

  var mode = 'off'
  var selectedId = null
  var overlay = null
  var label = null

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

  function skIdFor(el) {
    return el.getAttribute('data-sk-id') || el.getAttribute('data-source-location') || ''
  }

  function findSkTarget(el) {
    var node = el
    while (node && node !== document.body) {
      if (node.nodeType === 1) {
        var sk = node.getAttribute('data-sk-id') || node.getAttribute('data-source-location')
        if (sk) return node
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
    }
  }

  function findBySkId(skId) {
    return (
      document.querySelector('[data-sk-id="' + skId + '"]') ||
      document.querySelector('[data-source-location="' + skId + '"]')
    )
  }

  function describe(el) {
    var skId = skIdFor(el)
    var rect = el.getBoundingClientRect()
    var sourceFile = el.getAttribute('data-sk-file')
    var sourceLine = el.getAttribute('data-sk-line')
    return {
      skId: skId,
      tagName: el.tagName.toLowerCase(),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      text: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent : undefined,
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
        el.textContent = v
      },
      color: function (v) {
        el.style.color = v
      },
      backgroundColor: function (v) {
        el.style.backgroundColor = v
      },
      fontSize: function (v) {
        el.style.fontSize = v
      },
      fontWeight: function (v) {
        el.style.fontWeight = v
      },
      fontStyle: function (v) {
        el.style.fontStyle = v
      },
      textDecoration: function (v) {
        el.style.textDecoration = v
      },
      padding: function (v) {
        el.style.padding = v
      },
      margin: function (v) {
        el.style.margin = v
      },
      textAlign: function (v) {
        el.style.textAlign = v
      },
      borderRadius: function (v) {
        el.style.borderRadius = v
      },
      className: function (v) {
        el.className = v
      },
      href: function (v) {
        if (el.tagName === 'A') {
          el.setAttribute('href', v)
        } else {
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
    }
    var fn = map[patch.property]
    if (fn) fn(patch.value)
    if (selectedId === patch.skId && patch.property !== 'display') positionOverlay(el)
    post('element-select', describe(el))
  }

  document.addEventListener('mousemove', function (e) {
    if (mode !== 'select') return
    var t = findSkTarget(e.target)
    if (!t) {
      post('element-hover', null)
      if (!selectedId) hideOverlay()
      return
    }
    if (skIdFor(t) !== selectedId) positionOverlay(t)
    post('element-hover', describe(t))
  })

  document.addEventListener('click', function (e) {
    if (mode !== 'select') return
    var t = findSkTarget(e.target)
    e.preventDefault()
    e.stopPropagation()
    if (!t) {
      selectedId = null
      hideOverlay()
      post('element-select', null)
      return
    }
    selectedId = skIdFor(t)
    positionOverlay(t)
    post('element-select', describe(t))
  }, true)

  function applyMode(next) {
    mode = next
    if (mode === 'off') {
      selectedId = null
      hideOverlay()
      post('element-select', null)
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
    if (d.type === 'init' || d.type === 'set-mode') {
      applyMode(d.payload.mode)
    }
    if (d.type === 'highlight') {
      if (!d.payload || !d.payload.skId) {
        if (!selectedId) hideOverlay()
        return
      }
      var el = findBySkId(d.payload.skId)
      if (el) positionOverlay(el)
    }
    if (d.type === 'apply-patch') applyPatchToDom(d.payload)
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
      post('bridge-ready', undefined)
    })
  } else {
    post('bridge-ready', undefined)
  }
})()
