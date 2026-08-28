/* ====================================================================
 * util.js — 政务平台公共工具：时钟、格式化、转义、公文印章、假二维码、
 * 轻量公文 markdown 渲染（回执窗口用）
 * ==================================================================== */
(function (global) {
  'use strict'

  const GOV = {}

  /* ---------- 时钟 ---------- */
  const WEEK = ['日', '一', '二', '三', '四', '五', '六']
  GOV.startClock = function (el) {
    const tick = () => {
      const d = new Date()
      const pad = n => String(n).padStart(2, '0')
      const text = `今天是 ${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 星期${WEEK[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      if (el) el.textContent = text
    }
    tick()
    setInterval(tick, 1000)
    return tick
  }

  /* ---------- 日期/时长格式化 ---------- */
  GOV.fmtDateTime = function (ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  GOV.fmtTime = function (ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    const pad = n => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  GOV.fmtDuration = function (ms) {
    if (ms === null || ms === undefined) return '—'
    if (ms < 1000) return `${Math.round(ms)}ms`
    const s = ms / 1000
    if (s < 60) return `${s.toFixed(1)}s`
    const m = Math.floor(s / 60)
    const rest = s - m * 60
    return `${m}m${rest.toFixed(0)}s`
  }
  GOV.fmtTokens = function (n) {
    if (n === null || n === undefined) return '—'
    if (n < 1000) return String(Math.round(n))
    if (n < 1000000) return `${(n / 1000).toFixed(1)}K`
    return `${(n / 1000000).toFixed(2)}M`
  }
  GOV.fmtPct = function (num, den) {
    if (!den) return '—'
    return `${((num / den) * 100).toFixed(0)}%`
  }

  /* ---------- 工单编号（前缀含 YYYYMMDD 占位符） ---------- */
  GOV.makeTicketNo = function (prefix, seq) {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    let base = String(prefix ?? 'TASK-YYYYMMDD-')
    base = base.replace(/YYYYMMDD/g, ymd)
    base = base.replace(/YYYY/g, d.getFullYear()).replace(/MM/g, pad(d.getMonth() + 1)).replace(/DD/g, pad(d.getDate()))
    return `${base}${String(seq).padStart(3, '0')}`
  }

  /* ---------- HTML 转义 ---------- */
  GOV.escape = function (s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  /* ---------- 轻量公文 markdown → HTML（回执窗口渲染） ---------- */
  GOV.renderMarkdown = function (src) {
    if (!src) return ''
    let text = String(src)
    // 提取代码块
    const fences = []
    text = text.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
      fences.push(`<pre><code>${GOV.escape(code.replace(/\n$/, ''))}</code></pre>`)
      return `\u0000FENCE${fences.length - 1}\u0000`
    })
    const lines = text.split('\n')
    const out = []
    let inList = null
    let para = []
    const flushPara = () => {
      if (para.length) { out.push(`<p>${para.join('<br>')}</p>`); para = [] }
    }
    const closeList = () => {
      if (inList) { out.push(`</${inList}>`); inList = null }
    }
    const inline = (s) => {
      let t = GOV.escape(s)
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
      t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      t = t.replace(/\*([^*\n]+)\*/g, '<i>$1</i>')
      t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      return t
    }
    const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
    const isSepRow = (cells) => cells.length >= 1 && cells.every(c => /^:?-{2,}:?$/.test(c))
    // 逐行扫描；表格 = 表头行 + 分隔行 + 数据行
    let table = null // {head: [], rows: [], html: ''}
    const flushTable = () => {
      if (!table) return
      const headHtml = table.head.map(c => `<th>${inline(c)}</th>`).join('')
      const rowsHtml = table.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
      out.push(`<table class="gov-table" style="margin:8px 0"><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`)
      table = null
    }
    for (const raw of lines) {
      const line = raw
      if (line.startsWith('\u0000FENCE')) { flushPara(); closeList(); flushTable(); out.push(fences[Number(line.match(/\d+/)[0])]); continue }
      const cells = line.includes('|') ? splitRow(line) : null
      if (cells && cells.length >= 2) {
        if (isSepRow(cells)) continue // 表头分隔行（:--- 等）
        flushPara(); closeList()
        if (!table) {
          table = { head: cells, rows: [] }
        } else {
          table.rows.push(cells)
        }
        continue
      }
      if (table) flushTable()
      if (/^#{1,6}\s/.test(line)) {
        flushPara(); closeList()
        const lvl = line.match(/^#+/)[0].length
        out.push(`<h${lvl} style="font-family:var(--gov-font-title);color:var(--gov-blue-deep);margin:10px 0 6px;font-size:${Math.max(15, 21 - lvl * 1.5)}px">${inline(line.replace(/^#+\s/, ''))}</h${lvl}>`)
        continue
      }
      if (/^\s*[-*+]\s+/.test(line)) {
        flushPara()
        if (inList !== 'ul') { closeList(); out.push('<ul style="margin:4px 0 4px 22px">'); inList = 'ul' }
        out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`)
        continue
      }
      if (/^\s*\d+[.、]\s*/.test(line)) {
        flushPara()
        if (inList !== 'ol') { closeList(); out.push('<ol style="margin:4px 0 4px 22px">'); inList = 'ol' }
        out.push(`<li>${inline(line.replace(/^\s*\d+[.、]\s*/, ''))}</li>`)
        continue
      }
      if (/^---+$/.test(line.trim())) { flushPara(); closeList(); out.push('<hr style="border:0;border-top:1px dashed #ccc;margin:10px 0">'); continue }
      if (line.trim() === '') { flushPara(); closeList(); continue }
      para.push(inline(line))
    }
    flushTable()
    flushPara(); closeList()
    return out.join('')
  }

  /* ---------- 红头回函标记 → 对话框内公文版式 ---------- */
  GOV.renderReply = function (src, streaming = false) {
    const source = String(src ?? '').trim()
    const match = streaming
      ? source.match(/<redhead-reply>\s*([\s\S]*)/i)
      : source.match(/<redhead-reply>\s*([\s\S]*?)\s*<\/redhead-reply>/i)
    if (!match) return streaming
      ? '<div class="redhead-stream-wait">正在拟制红头回函…</div>'
      : GOV.renderMarkdown(source)
    const payload = match[1]
    const field = (name, fallback = '') => {
      const found = payload.match(new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*<\\/${name}>`, 'i'))
      if (found) return found[1].trim()
      if (!streaming) return fallback
      const partial = payload.match(new RegExp(`<${name}>\\s*([\\s\\S]*)`, 'i'))
      return partial ? partial[1].replace(/<[^>]*$/, '').trim() || fallback : fallback
    }
    const year = new Date().getFullYear()
    const issuer = field('issuer', 'DeepSeek Harness 综合智能办事平台')
    const number = field('number', `DSH发〔${year}〕1号`)
    const title = field('title', '办理情况答复')
    const recipient = field('recipient', '申请人：')
    const signature = field('signature', issuer)
    const date = field('date', `${year}年${new Date().getMonth() + 1}月${new Date().getDate()}日`)
    const body = field('body', streaming ? '' : '已收悉。')
    const paragraphs = body.split(/\n\s*\n|\n/).map(line => line.trim()).filter(Boolean)
      .map(line => `<p>${GOV.escape(line)}</p>`).join('') || (streaming ? '<p class="redhead-streaming-text">正文拟制中…</p>' : '')
    const actions = streaming ? '' : `<div class="redhead-actions" aria-label="红头文件操作">
      <button type="button" class="redhead-action" data-redhead-action="fullscreen">全屏展示</button>
      <button type="button" class="redhead-action primary" data-redhead-action="export">导出 Word</button>
    </div>`
    return `<article class="redhead-reply${streaming ? ' streaming' : ''}">
      <div class="redhead-issuer">${GOV.escape(issuer)}</div>
      <div class="redhead-number">${GOV.escape(number)}</div>
      <div class="redhead-rule"><i></i><b></b></div>
      <h2>${GOV.escape(title)}</h2>
      <div class="redhead-recipient">${GOV.escape(recipient)}</div>
      <div class="redhead-body">${paragraphs}</div>
      <div class="redhead-signature"><img class="redhead-seal" src="/assets/seal-dsh.png" alt="DSH 内部文件章"><span>${GOV.escape(signature)}<br>${GOV.escape(date)}</span></div>
      ${actions}
    </article>`
  }

  GOV.renderStreamingReply = function (src) {
    return GOV.renderReply(src, true)
  }

  GOV.toggleRedheadFullscreen = async function (card) {
    if (!card) return
    document.getElementById('redheadPreviewOverlay')?.remove()
    const overlay = document.createElement('section')
    overlay.id = 'redheadPreviewOverlay'
    overlay.className = 'redhead-preview-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', '红头文件沉浸预览')
    const copy = card.cloneNode(true)
    copy.classList.remove('streaming')
    copy.classList.add('redhead-preview-page')
    copy.querySelector('.redhead-actions')?.remove()
    const toolbar = document.createElement('div')
    toolbar.className = 'redhead-preview-toolbar'
    toolbar.innerHTML = '<span>红头文件预览 · A4 版式（不进入浏览器全屏，录屏不受影响）</span><div><button type="button" data-preview-export>导出 Word</button><button type="button" class="close" data-preview-close>返回对话</button></div>'
    const stage = document.createElement('div')
    stage.className = 'redhead-preview-stage'
    stage.appendChild(copy)
    overlay.append(toolbar, stage)
    document.body.appendChild(overlay)
    let onKeydown
    const close = () => {
      overlay.remove()
      document.removeEventListener('keydown', onKeydown)
    }
    toolbar.querySelector('[data-preview-close]').addEventListener('click', close)
    toolbar.querySelector('[data-preview-export]').addEventListener('click', () => void GOV.exportRedheadReply(card))
    overlay.addEventListener('click', event => { if (event.target === overlay) close() })
    onKeydown = event => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeydown)
    toolbar.querySelector('[data-preview-close]').focus()
  }

  GOV.exportRedheadReply = async function (card) {
    if (!card) return
    const copy = card.cloneNode(true)
    copy.querySelector('.redhead-actions')?.remove()
    const seal = copy.querySelector('.redhead-seal')
    if (seal) {
      try {
        const response = await fetch(seal.getAttribute('src'))
        const blob = await response.blob()
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        seal.src = dataUrl
      } catch (_) {
        // 保留原 URL；在线打开导出的文档时仍可加载印章。
      }
    }
    const title = (copy.querySelector('h2')?.textContent || '红头文件').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60)
    const css = `body{margin:0;padding:28px;background:#f4f4f4;color:#111;font-family:"仿宋_GB2312",FangSong,SimSun,serif}.redhead-reply{box-sizing:border-box;max-width:720px;min-height:960px;margin:0 auto;padding:48px 64px;background:#fff;border:1px solid #ddd}.redhead-issuer{color:#c00;font-family:"方正粗宋简体",STSong,SimSun,serif;font-size:32px;font-weight:bold;letter-spacing:3px;text-align:center}.redhead-number{text-align:center;font-size:18px;margin:20px 0 12px}.redhead-rule{position:relative;height:10px;margin:0 0 40px}.redhead-rule i,.redhead-rule b{position:absolute;left:0;width:100%;display:block;background:#c00}.redhead-rule i{top:0;height:3px}.redhead-rule b{top:7px;height:1px}.redhead-reply h2{margin:0 0 28px;font-family:"方正小标宋简体",STSong,SimSun,serif;font-size:28px;line-height:1.5;text-align:center}.redhead-recipient{font-size:18px;margin-bottom:12px}.redhead-body{font-size:18px;line-height:1.9}.redhead-body p{margin:0 0 10px;text-indent:2em}.redhead-signature{position:relative;min-height:105px;margin-top:30px;text-align:right;font-size:18px;line-height:1.9}.redhead-signature span{position:relative;z-index:1}.redhead-seal{position:absolute;right:72px;top:-18px;z-index:0;width:120px;height:120px;object-fit:contain;opacity:.78}`
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${GOV.escape(title)}</title><style>${css}</style></head><body>${copy.outerHTML}</body></html>`
    const file = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title || 'DSH发_红头文件'}.doc`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  /* ---------- 公文印章 SVG（预设样式） ---------- */
  GOV.renderSeal = function (style, size, text) {
    const colors = {
      red: { ring: '#d40215', text: '#d40215' },
      blue: { ring: '#015293', text: '#015293' },
      green: { ring: '#1a7a4a', text: '#1a7a4a' },
      gold: { ring: '#c8a44a', text: '#c8a44a' },
    }
    const c = colors[style] || colors.red
    const name = text || 'DeepSeek\nHarness'
    const lines = name.split('\n')
    const star = `<path d="M32 14 l4.6 9.3 10.4 1.5 -7.5 7.3 1.8 10.3 -9.3 -4.9 -9.3 4.9 1.8 -10.3 -7.5 -7.3 10.4 -1.5 z" fill="${c.ring}"/>`
    const textEls = lines.map((ln, i) => {
      const y = 52 + i * 11
      const fs = lines.length > 1 ? 9 : 11
      return `<text x="32" y="${y}" font-size="${fs}" text-anchor="middle" fill="${c.text}" font-family="SimHei, sans-serif" font-weight="bold">${GOV.escape(ln)}</text>`
    }).join('')
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="32" cy="32" r="30" fill="none" stroke="${c.ring}" stroke-width="3"/>
      <circle cx="32" cy="32" r="26.5" fill="none" stroke="${c.ring}" stroke-width="1"/>
      ${star}${textEls}
    </svg>`
  }

  /* ---------- 假二维码矩阵 canvas ---------- */
  GOV.drawFakeQr = function (canvas, seedText) {
    const size = 96
    const n = 25
    const cell = size / n
    const ctx = canvas.getContext('2d')
    canvas.width = size
    canvas.height = size
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#111'
    let seed = 7
    for (const ch of String(seedText ?? 'dsh-gov-portal')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
    const rand = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
      return (seed >>> 0) / 4294967296
    }
    // 定位角
    const drawFinder = (x, y) => {
      ctx.fillStyle = '#111'
      ctx.fillRect(x, y, 7 * cell, 7 * cell)
      ctx.fillStyle = '#fff'
      ctx.fillRect(x + cell, y + cell, 5 * cell, 5 * cell)
      ctx.fillStyle = '#111'
      ctx.fillRect(x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell)
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const inFinder = (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)
        if (inFinder) continue
        if (rand() < 0.46) ctx.fillRect(x * cell, y * cell, cell - 0.5, cell - 0.5)
      }
    }
    drawFinder(0, 0)
    drawFinder((n - 7) * cell, 0)
    drawFinder(0, (n - 7) * cell)
  }

  /* ---------- 图片验证码（canvas 随机字符 + 干扰线） ---------- */
  GOV.makeCaptcha = function (canvas, len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆字符
    const n = len || 4
    let code = ''
    for (let i = 0; i < n; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const W = 120
    const H = 40
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#eef2f7'
    ctx.fillRect(0, 0, W, H)
    // 干扰线
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(${20 + Math.random() * 120},${20 + Math.random() * 120},${120 + Math.random() * 120},0.5)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(Math.random() * W, Math.random() * H)
      ctx.lineTo(Math.random() * W, Math.random() * H)
      ctx.stroke()
    }
    // 干扰点
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.3})`
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5)
    }
    // 字符
    for (let i = 0; i < n; i++) {
      ctx.save()
      ctx.translate(14 + i * 26 + Math.random() * 4, 20 + Math.random() * 8)
      ctx.rotate((Math.random() - 0.5) * 0.6)
      ctx.font = `bold ${22 + Math.random() * 6}px Consolas, monospace`
      ctx.fillStyle = `rgb(${Math.random() * 120},${Math.random() * 120},${Math.random() * 120})`
      ctx.fillText(code[i], -7, 7)
      ctx.restore()
    }
    return code
  }

  /* ---------- 浏览器主页/收藏（传统政务站写法） ---------- */
  GOV.setHome = function (url) {
    try {
      document.body.style.behavior = 'url(#default#homepage)'
      document.body.setHomePage(url)
      return true
    } catch (e) {
      try { document.body.setHomePage(url); return true } catch (e2) { return false }
    }
  }
  GOV.addFavorite = function (url, title) {
    const u = url || window.location.href
    const t = title || document.title
    try {
      window.external?.addFavorite?.(u, t)
      return true
    } catch (e) {
      try { window.sidebar?.addPanel?.(t, u, ''); return true } catch (e2) { return false }
    }
  }

  /* ---------- 文件下载 ---------- */
  GOV.downloadText = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 800)
  }

  global.GOV = GOV
})(window)
