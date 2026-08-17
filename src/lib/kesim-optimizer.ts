export interface InputPiece {
  id: string
  label: string
  etiket?: string
  w: number
  h: number
  count: number
  canRotate: boolean
}

export interface InputSheet {
  id: string
  w: number
  h: number
  count: number
}

export interface PlacedPiece {
  pieceId: string
  label: string
  instanceIndex: number
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
  sheetIndex: number
  colorIndex: number
}

export interface SheetStat {
  sheetIndex: number
  sheetW: number
  sheetH: number
  usedArea: number
  wasteArea: number
  usedPercent: number
  wastePercent: number
  placedCount: number
  cutCount: number
  cutLength: number
}

export interface SheetGroup {
  layoutHash: string
  sheetIndices: number[]
  count: number
  representativeIndex: number
}

export interface OptimizationResult {
  placedPieces: PlacedPiece[]
  unplacedPieces: Array<{ pieceId: string; label: string }>
  sheetsUsed: number
  totalSheetArea: number
  totalUsedArea: number
  totalWasteArea: number
  usedPercent: number
  wastePercent: number
  totalCuts: number
  totalCutLength: number
  bladeThickness: number
  sheetStats: SheetStat[]
  sheetDimensions: Array<{ w: number; h: number }>
  sheetGroups: SheetGroup[]
}

interface FreeRect {
  x: number
  y: number
  w: number
  h: number
}

function splitGuillotine(fr: FreeRect, pw: number, ph: number, blade: number): FreeRect[] {
  const result: FreeRect[] = []
  const rightW = fr.w - pw - blade
  const bottomH = fr.h - ph - blade

  if (fr.w - pw < fr.h - ph) {
    if (rightW > 0 && ph > 0) result.push({ x: fr.x + pw + blade, y: fr.y, w: rightW, h: ph })
    if (bottomH > 0 && fr.w > 0) result.push({ x: fr.x, y: fr.y + ph + blade, w: fr.w, h: bottomH })
  } else {
    if (rightW > 0 && fr.h > 0) result.push({ x: fr.x + pw + blade, y: fr.y, w: rightW, h: fr.h })
    if (bottomH > 0 && pw > 0) result.push({ x: fr.x, y: fr.y + ph + blade, w: pw, h: bottomH })
  }

  return result.filter(r => r.w > 0 && r.h > 0)
}

function hashSheetLayout(pieces: PlacedPiece[], dim: { w: number; h: number }): string {
  const sorted = pieces
    .map(p => `${p.x},${p.y},${p.w},${p.h}`)
    .sort()
    .join('|')
  return `${dim.w}x${dim.h}:${sorted}`
}

export function optimize(
  inputPieces: InputPiece[],
  inputSheets: InputSheet[],
  bladeThickness: number
): OptimizationResult {
  const colorMap: Record<string, number> = {}
  let nextColor = 0
  inputPieces.forEach(p => {
    if (!(p.id in colorMap)) colorMap[p.id] = nextColor++
  })

  type PieceItem = {
    pieceId: string
    label: string
    w: number
    h: number
    canRotate: boolean
    colorIndex: number
    instanceIndex: number
  }

  const allPieces: PieceItem[] = []
  inputPieces.forEach(p => {
    for (let i = 0; i < p.count; i++) {
      allPieces.push({
        pieceId: p.id,
        label: p.etiket ? `${p.etiket}${i + 1}` : p.label,
        w: p.w,
        h: p.h,
        canRotate: p.canRotate,
        colorIndex: colorMap[p.id] ?? 0,
        instanceIndex: i,
      })
    }
  })

  allPieces.sort((a, b) => b.w * b.h - a.w * a.h)

  const sheetPool: Array<{ w: number; h: number }> = []
  inputSheets.forEach(s => {
    const cnt = s.count > 0 ? s.count : 200
    for (let i = 0; i < cnt; i++) sheetPool.push({ w: s.w, h: s.h })
  })
  if (sheetPool.length === 0) {
    for (let i = 0; i < 200; i++) sheetPool.push({ w: 320, h: 160 })
  }

  const placedPieces: PlacedPiece[] = []
  const unplacedPieces: Array<{ pieceId: string; label: string }> = []
  const sheetFreeRects: FreeRect[][] = []
  const sheetDimensions: Array<{ w: number; h: number }> = []
  let sheetsUsed = 0

  function ensureSheet(idx: number): boolean {
    if (idx >= sheetPool.length) return false
    while (sheetsUsed <= idx) {
      const s = sheetPool[sheetsUsed]
      sheetFreeRects.push([{ x: 0, y: 0, w: s.w, h: s.h }])
      sheetDimensions.push({ w: s.w, h: s.h })
      sheetsUsed++
    }
    return true
  }

  ensureSheet(0)

  function findBestFit(w: number, h: number): { si: number; ri: number; score: number } | null {
    let best: { si: number; ri: number; score: number } | null = null
    for (let si = 0; si < sheetsUsed; si++) {
      for (let ri = 0; ri < sheetFreeRects[si].length; ri++) {
        const fr = sheetFreeRects[si][ri]
        if (w <= fr.w && h <= fr.h) {
          const score = Math.min(fr.w - w, fr.h - h)
          if (!best || score < best.score) best = { si, ri, score }
        }
      }
    }
    return best
  }

  for (const piece of allPieces) {
    const normalFit = findBestFit(piece.w, piece.h)
    const rotatedFit = piece.canRotate ? findBestFit(piece.h, piece.w) : null

    let placement: { si: number; ri: number; rotated: boolean } | null = null

    if (normalFit && rotatedFit) {
      placement = rotatedFit.score < normalFit.score
        ? { ...rotatedFit, rotated: true }
        : { ...normalFit, rotated: false }
    } else if (normalFit) {
      placement = { ...normalFit, rotated: false }
    } else if (rotatedFit) {
      placement = { ...rotatedFit, rotated: true }
    }

    if (!placement) {
      const newIdx = sheetsUsed
      if (ensureSheet(newIdx)) {
        const nf = findBestFit(piece.w, piece.h)
        const rf = piece.canRotate ? findBestFit(piece.h, piece.w) : null
        if (nf && rf) {
          placement = rf.score < nf.score ? { ...rf, rotated: true } : { ...nf, rotated: false }
        } else if (nf) {
          placement = { ...nf, rotated: false }
        } else if (rf) {
          placement = { ...rf, rotated: true }
        }
      }
    }

    if (!placement) {
      unplacedPieces.push({ pieceId: piece.pieceId, label: piece.label })
      continue
    }

    const pw = placement.rotated ? piece.h : piece.w
    const ph = placement.rotated ? piece.w : piece.h
    const fr = sheetFreeRects[placement.si][placement.ri]

    placedPieces.push({
      pieceId: piece.pieceId,
      label: piece.label,
      instanceIndex: piece.instanceIndex,
      x: fr.x,
      y: fr.y,
      w: pw,
      h: ph,
      rotated: placement.rotated,
      sheetIndex: placement.si,
      colorIndex: piece.colorIndex,
    })

    const newRects = splitGuillotine(fr, pw, ph, bladeThickness)
    sheetFreeRects[placement.si].splice(placement.ri, 1, ...newRects)
  }

  const totalSheetArea = sheetDimensions.reduce((s, d) => s + d.w * d.h, 0)
  const totalUsedArea = placedPieces.reduce((s, p) => s + p.w * p.h, 0)
  const totalWasteArea = totalSheetArea - totalUsedArea

  const sheetStats: SheetStat[] = sheetDimensions.map((dim, si) => {
    const sp = placedPieces.filter(p => p.sheetIndex === si)
    const usedArea = sp.reduce((s, p) => s + p.w * p.h, 0)
    const totalArea = dim.w * dim.h
    const cutCount = sp.length > 0 ? sp.length * 2 : 0
    const cutLength = sp.reduce((s, p) => s + p.w + p.h, 0)
    return {
      sheetIndex: si,
      sheetW: dim.w,
      sheetH: dim.h,
      usedArea,
      wasteArea: totalArea - usedArea,
      usedPercent: totalArea > 0 ? Math.round((usedArea / totalArea) * 100) : 0,
      wastePercent: totalArea > 0 ? Math.round(((totalArea - usedArea) / totalArea) * 100) : 0,
      placedCount: sp.length,
      cutCount,
      cutLength,
    }
  })

  // Group sheets by identical layout
  const hashMap = new Map<string, number[]>()
  for (let si = 0; si < sheetsUsed; si++) {
    const sp = placedPieces.filter(p => p.sheetIndex === si)
    const hash = hashSheetLayout(sp, sheetDimensions[si])
    const arr = hashMap.get(hash) || []
    arr.push(si)
    hashMap.set(hash, arr)
  }

  const sheetGroups: SheetGroup[] = Array.from(hashMap.entries()).map(([layoutHash, sheetIndices]) => ({
    layoutHash,
    sheetIndices,
    count: sheetIndices.length,
    representativeIndex: sheetIndices[0],
  }))

  return {
    placedPieces,
    unplacedPieces,
    sheetsUsed,
    totalSheetArea,
    totalUsedArea,
    totalWasteArea,
    usedPercent: totalSheetArea > 0 ? Math.round((totalUsedArea / totalSheetArea) * 100) : 0,
    wastePercent: totalSheetArea > 0 ? Math.round((totalWasteArea / totalSheetArea) * 100) : 0,
    totalCuts: sheetStats.reduce((s, st) => s + st.cutCount, 0),
    totalCutLength: sheetStats.reduce((s, st) => s + st.cutLength, 0),
    bladeThickness,
    sheetStats,
    sheetDimensions,
    sheetGroups,
  }
}

// SVG builder for PDF export
const PIECE_COLORS_RAW = [
  '#bfdbfe', '#bbf7d0', '#fecaca', '#fef08a', '#ddd6fe',
  '#a5f3fc', '#fed7aa', '#fbcfe8', '#d9f99d', '#e0e7ff',
  '#ccfbf1', '#fde68a', '#c7d2fe', '#fae8ff', '#dcfce7',
  '#ffedd5', '#e0f2fe', '#fce7f3', '#ecfccb', '#f0fdf4',
]

export function buildSvgString(
  sheetW: number,
  sheetH: number,
  pieces: PlacedPiece[],
  showLabels: boolean,
  groupCount: number
): string {
  const cW = 600
  const cH = 480
  const padding = 40
  const availW = cW - padding * 2
  const availH = cH - padding * 2
  const scale = Math.min(availW / sheetW, availH / sheetH)
  const svgW = sheetW * scale
  const svgH = sheetH * scale
  const oX = padding + (availW - svgW) / 2
  const oY = padding + (availH - svgH) / 2

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cW}" height="${cH}" viewBox="0 0 ${cW} ${cH}" style="background:#fff">`
  svg += `<rect x="${oX}" y="${oY}" width="${svgW}" height="${svgH}" fill="#f9fafb" stroke="#374151" stroke-width="1.5"/>`
  svg += `<text x="${oX + svgW / 2}" y="${oY - 14}" text-anchor="middle" font-size="10" fill="#6b7280">${sheetW}</text>`
  svg += `<text x="${oX - 22}" y="${oY + svgH / 2}" text-anchor="middle" font-size="10" fill="#6b7280" transform="rotate(-90,${oX - 22},${oY + svgH / 2})">${sheetH}</text>`

  for (const piece of pieces) {
    const px = oX + piece.x * scale
    const py = oY + piece.y * scale
    const pw = piece.w * scale
    const ph = piece.h * scale
    const color = PIECE_COLORS_RAW[piece.colorIndex % PIECE_COLORS_RAW.length]
    const fs = Math.min(10, pw / 6, ph / 3)
    const showDim = pw > 35 && ph > 18

    svg += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${color}" fill-opacity="0.85" stroke="#fff" stroke-width="1.2"/>`
    if (showLabels && showDim && fs > 5) {
      svg += `<text x="${px + pw / 2}" y="${py + ph / 2 - 4}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" fill="#1f2937" font-weight="600">${piece.label}</text>`
    }
    if (showDim) {
      const dimFs = Math.min(8, pw / 7, ph / 4)
      svg += `<text x="${px + pw / 2}" y="${py + ph / 2 + (showLabels && showDim ? fs + 1 : 0)}" text-anchor="middle" dominant-baseline="middle" font-size="${dimFs}" fill="#374151">${piece.w}\u00d7${piece.h}</text>`
    }
  }

  if (groupCount > 1) {
    svg += `<text x="${oX + svgW + 8}" y="${oY + svgH}" text-anchor="start" font-size="22" font-weight="bold" fill="#dc2626">x${groupCount}</text>`
  }

  svg += '</svg>'
  return svg
}
