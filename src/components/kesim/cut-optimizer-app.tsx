'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { optimize, InputPiece, InputSheet, OptimizationResult, buildSvgString } from '@/lib/kesim-optimizer'
import { SheetCanvas, PIECE_COLORS } from './sheet-canvas'
import { Play, Plus, Trash2, ChevronLeft, ChevronRight, RotateCcw, Lock, Unlock, ZoomIn, ZoomOut, FileDown, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

type PieceRow = { id: string; etiket: string; uzunluk: string; genislik: string; adet: string; canRotate: boolean }
type SheetRow = { id: string; uzunluk: string; genislik: string; adet: string }

const DEFAULT_PIECES: PieceRow[] = [
  { id: 'p1', etiket: '', uzunluk: '120', genislik: '60', adet: '4', canRotate: true },
  { id: 'p2', etiket: '', uzunluk: '80', genislik: '40', adet: '6', canRotate: true },
  { id: 'p3', etiket: '', uzunluk: '60', genislik: '30', adet: '8', canRotate: true },
]

const DEFAULT_SHEETS: SheetRow[] = [
  { id: 's1', uzunluk: '320', genislik: '160', adet: '0' },
]

let _uid = 0
function uid() { return `u${++_uid}_${Date.now()}` }

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums text-right">
        {value}
        {sub && <span className="text-muted-foreground ml-1">{sub}</span>}
      </span>
    </div>
  )
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-t-md flex items-center justify-between">
      <span>{title}</span>
      {children}
    </div>
  )
}

export function CutOptimizerApp() {
  const [pieces, setPieces] = useState<PieceRow[]>(DEFAULT_PIECES)
  const [sheets, setSheets] = useState<SheetRow[]>(DEFAULT_SHEETS)
  const [bladeThickness, setBladeThickness] = useState(0)
  const [showLabels, setShowLabels] = useState(true)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [activeGroup, setActiveGroup] = useState(0)
  const [isCalculating, setIsCalculating] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus new row
  useEffect(() => {
    if (!autoFocusId) return
    const el = document.querySelector(`[data-piece-id="${autoFocusId}"] input`) as HTMLInputElement | null
    if (el) { el.focus(); el.select() }
  }, [autoFocusId])

  // --- Piece helpers ---
  const addPiece = () => setPieces(prev => [...prev, { id: uid(), etiket: '', uzunluk: '', genislik: '', adet: '1', canRotate: true }])
  const addPieceAndFocus = () => {
    const newId = uid()
    setPieces(prev => [...prev, { id: newId, etiket: '', uzunluk: '', genislik: '', adet: '1', canRotate: true }])
    setAutoFocusId(newId)
  }
  const removePiece = (id: string) => setPieces(prev => prev.filter(p => p.id !== id))
  const updatePiece = (id: string, field: keyof PieceRow, value: string | boolean) =>
    setPieces(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))

  // --- Sheet helpers ---
  const addSheet = () => setSheets(prev => [...prev, { id: uid(), uzunluk: '', genislik: '', adet: '0' }])
  const removeSheet = (id: string) => setSheets(prev => prev.filter(s => s.id !== id))
  const updateSheet = (id: string, field: keyof SheetRow, value: string) =>
    setSheets(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))

  // --- Paste handler (Excel TSV) ---
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed: PieceRow[] = []
    for (const line of lines) {
      const cols = line.split(/\t|,|;/).map(c => c.trim())
      if (cols.length >= 2) {
        const uzunluk = cols[0]
        const genislik = cols[1]
        const adet = cols[2] || '1'
        const etiket = cols[3] || ''
        if (Number(uzunluk) > 0 && Number(genislik) > 0) {
          parsed.push({ id: uid(), etiket, uzunluk, genislik, adet: String(parseInt(adet) || 1), canRotate: true })
        }
      }
    }
    if (parsed.length > 0) {
      e.preventDefault()
      setPieces(prev => [...prev, ...parsed])
    }
  }, [])

  // --- CSV file upload ---
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (!text) return
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const parsed: PieceRow[] = []
      for (const line of lines) {
        const cols = line.split(/\t|,|;/).map(c => c.trim())
        if (cols.length >= 2) {
          const uzunluk = cols[0]
          const genislik = cols[1]
          const adet = cols[2] || '1'
          const etiket = cols[3] || ''
          if (Number(uzunluk) > 0 && Number(genislik) > 0) {
            parsed.push({ id: uid(), etiket, uzunluk, genislik, adet: String(parseInt(adet) || 1), canRotate: true })
          }
        }
      }
      if (parsed.length > 0) setPieces(prev => [...prev, ...parsed])
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  // --- Calculate ---
  const handleCalculate = useCallback(() => {
    setIsCalculating(true)
    setTimeout(() => {
      try {
        const inputPieces: InputPiece[] = pieces
          .filter(p => p.uzunluk && p.genislik && p.adet && Number(p.uzunluk) > 0 && Number(p.genislik) > 0 && Number(p.adet) > 0)
          .map(p => ({
            id: p.id,
            label: `${p.uzunluk}×${p.genislik}`,
            etiket: p.etiket || undefined,
            w: parseFloat(p.uzunluk),
            h: parseFloat(p.genislik),
            count: parseInt(p.adet),
            canRotate: p.canRotate,
          }))

        const inputSheets: InputSheet[] = sheets
          .filter(s => s.uzunluk && s.genislik && Number(s.uzunluk) > 0 && Number(s.genislik) > 0)
          .map(s => ({
            id: s.id,
            w: parseFloat(s.uzunluk),
            h: parseFloat(s.genislik),
            count: parseInt(s.adet) || 0,
          }))

        if (inputPieces.length === 0 || inputSheets.length === 0) {
          setIsCalculating(false)
          return
        }

        const res = optimize(inputPieces, inputSheets, bladeThickness)
        setResult(res)
        setActiveGroup(0)
        setZoom(1)
      } finally {
        setIsCalculating(false)
      }
    }, 50)
  }, [pieces, sheets, bladeThickness])

  // --- Reset ---
  const handleReset = () => {
    setPieces(DEFAULT_PIECES)
    setSheets(DEFAULT_SHEETS)
    setBladeThickness(0)
    setShowLabels(true)
    setResult(null)
    setActiveGroup(0)
    setZoom(1)
  }

  // --- PDF export ---
  const handlePdfExport = useCallback(() => {
    if (!result) return
    const w = window.open('', '_blank')
    if (!w) return

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kesim Planı</title>
    <style>
      body{font-family:system-ui,sans-serif;margin:20px;color:#1f2937}
      .page{page-break-after:always;margin-bottom:40px}
      .page:last-child{page-break-after:auto}
      .header{font-size:18px;font-weight:bold;margin-bottom:8px}
      .stats{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;font-size:12px;margin:8px 0 16px}
      .stats span:nth-child(odd){color:#6b7280}
      .stats span:nth-child(even){font-weight:500;text-align:right}
      .summary{border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:30px}
      .summary h2{font-size:16px;margin:0 0 10px}
      svg{max-width:100%;height:auto}
      @media print{.no-print{display:none}body{margin:10px}}
    </style></head><body>`

    html += `<div class="no-print" style="margin-bottom:20px"><button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;background:#16a34a;color:#fff;border:none;border-radius:6px">Yazdır / PDF Kaydet</button></div>`

    html += `<div class="summary"><h2>Kesim Planı Özeti</h2><div class="stats">`
    html += `<span>Toplam levha:</span><span>${result.sheetsUsed}</span>`
    html += `<span>Farklı düzen:</span><span>${result.sheetGroups.length}</span>`
    html += `<span>Kullanılan alan:</span><span>${result.totalUsedArea.toLocaleString('tr-TR')} (%${result.usedPercent})</span>`
    html += `<span>Boş alan:</span><span>${result.totalWasteArea.toLocaleString('tr-TR')} (%${result.wastePercent})</span>`
    html += `<span>Toplam kesim:</span><span>${result.totalCuts}</span>`
    html += `<span>Bıçak ağzı:</span><span>${result.bladeThickness} mm</span>`
    if (result.unplacedPieces.length > 0) {
      html += `<span style="color:#dc2626">Yerleştirilemeyen:</span><span style="color:#dc2626">${result.unplacedPieces.length}</span>`
    }
    html += `</div></div>`

    result.sheetGroups.forEach((group, gi) => {
      const dim = result.sheetDimensions[group.representativeIndex]
      const sp = result.placedPieces.filter(p => p.sheetIndex === group.representativeIndex)
      const stat = result.sheetStats[group.representativeIndex]

      html += `<div class="page">`
      html += `<div class="header">Düzen ${gi + 1}/${result.sheetGroups.length} — ${dim.w}×${dim.h} — x${group.count} levha</div>`
      html += `<div class="stats">`
      html += `<span>Kullanım:</span><span>%${stat.usedPercent}</span>`
      html += `<span>Parça:</span><span>${stat.placedCount}</span>`
      html += `<span>Kesim:</span><span>${stat.cutCount}</span>`
      html += `</div>`
      html += buildSvgString(dim.w, dim.h, sp, showLabels, group.count)
      html += `</div>`
    })

    html += `</body></html>`
    w.document.write(html)
    w.document.close()
  }, [result, showLabels])

  // --- Zoom ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setZoom(z => Math.max(0.5, Math.min(3, z + (e.deltaY > 0 ? -0.15 : 0.15))))
    }
  }, [])

  // --- Current group data ---
  const currentGroup = result?.sheetGroups[activeGroup]
  const repIndex = currentGroup?.representativeIndex ?? 0
  const currentSheetStat = result?.sheetStats[repIndex]
  const currentSheetDim = result?.sheetDimensions[repIndex]
  const currentPieces = result?.placedPieces.filter(p => p.sheetIndex === repIndex) ?? []
  const totalGroups = result?.sheetGroups.length ?? 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Kesim Programı</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Minimum fire ile plaka yerleşim planı hesapla</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Sıfırla
          </Button>
          {result && (
            <Button variant="outline" size="sm" onClick={handlePdfExport} className="gap-1.5">
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </Button>
          )}
          <Button
            size="sm"
            variant="success"
            onClick={handleCalculate}
            disabled={isCalculating}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            {isCalculating ? 'Hesaplanıyor...' : 'Hesapla'}
          </Button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0 xl:overflow-hidden overflow-y-auto">

        {/* LEFT PANEL */}
        <div className="xl:w-72 w-full shrink-0 flex flex-col gap-3 xl:overflow-y-auto" onPaste={handlePaste}>

          {/* Parçalar */}
          <div className="border rounded-md overflow-hidden">
            <SectionHeader title="Parçalar">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hover:opacity-70 flex items-center gap-1 text-[10px] font-normal"
                title="CSV/TXT dosya yükle"
              >
                <Upload className="h-3 w-3" /> İçe Aktar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </SectionHeader>
            <div className="p-2">
              <div className="grid grid-cols-[52px_1fr_1fr_38px_22px_22px] gap-1 mb-1">
                <span className="text-[10px] text-muted-foreground px-1">Etiket</span>
                <span className="text-[10px] text-muted-foreground px-1">Uzunluk</span>
                <span className="text-[10px] text-muted-foreground px-1">Genişlik</span>
                <span className="text-[10px] text-muted-foreground px-1">Adet</span>
                <span className="text-[10px] text-muted-foreground text-center">🔒</span>
                <span />
              </div>
              <div className="overflow-y-auto max-h-[160px]">
              {pieces.map((p, i) => (
                <div key={p.id} data-piece-id={p.id} className="grid grid-cols-[52px_1fr_1fr_38px_22px_22px] gap-1 mb-1 items-center">
                  <Input
                    value={p.etiket}
                    onChange={e => updatePiece(p.id, 'etiket', e.target.value)}
                    className="h-7 text-xs px-1.5"
                  />
                  <div className="relative">
                    {result && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-sm ml-0.5"
                        style={{ backgroundColor: PIECE_COLORS[i % PIECE_COLORS.length] }}
                      />
                    )}
                    <Input
                      value={p.uzunluk}
                      onChange={e => updatePiece(p.id, 'uzunluk', e.target.value)}
                      className={cn('h-7 text-xs px-1.5 no-spinner', result && 'pl-4')}
                      type="number"
                      min="0"
                    />
                  </div>
                  <Input
                    value={p.genislik}
                    onChange={e => updatePiece(p.id, 'genislik', e.target.value)}
                    className="h-7 text-xs px-1.5 no-spinner"
                    type="number"
                    min="0"
                  />
                  <Input
                    value={p.adet}
                    onChange={e => updatePiece(p.id, 'adet', e.target.value)}
                    className="h-7 text-xs px-1 no-spinner text-center"
                    type="number"
                    min="1"
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && !e.shiftKey && i === pieces.length - 1) {
                        e.preventDefault()
                        addPieceAndFocus()
                      }
                    }}
                  />
                  <button
                    onClick={() => updatePiece(p.id, 'canRotate', !p.canRotate)}
                    className={cn(
                      'h-7 w-full flex items-center justify-center rounded border text-xs transition-colors',
                      p.canRotate
                        ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
                        : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
                    )}
                    title={p.canRotate ? 'Döndürmeye izin var' : 'Yön kilitli'}
                  >
                    {p.canRotate ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => removePiece(p.id)}
                    className="h-7 w-full flex items-center justify-center rounded hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              </div>
              <Button variant="ghost" size="sm" onClick={addPiece} className="w-full mt-1 h-7 text-xs gap-1 text-muted-foreground border-dashed border">
                <Plus className="h-3 w-3" /> Parça Ekle
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1.5 px-1">Excel&apos;den kopyala-yapıştır: uzunluk, genişlik, adet, etiket</p>
            </div>
          </div>

          {/* Malzeme Levhaları */}
          <div className="border rounded-md overflow-hidden">
            <SectionHeader title="Malzeme Levhaları" />
            <div className="p-2">
              <div className="grid grid-cols-[1fr_1fr_52px_28px] gap-1 mb-1">
                <span className="text-[10px] text-muted-foreground px-1">Uzunluk</span>
                <span className="text-[10px] text-muted-foreground px-1">Genişlik</span>
                <span className="text-[10px] text-muted-foreground px-1">Adet</span>
                <span />
              </div>
              <div className="overflow-y-auto max-h-[96px]">
              {sheets.map(s => (
                <div key={s.id} className="grid grid-cols-[1fr_1fr_52px_28px] gap-1 mb-1 items-center">
                  <Input
                    value={s.uzunluk}
                    onChange={e => updateSheet(s.id, 'uzunluk', e.target.value)}
                    className="h-7 text-xs px-1.5 no-spinner"
                    type="number"
                    min="0"
                  />
                  <Input
                    value={s.genislik}
                    onChange={e => updateSheet(s.id, 'genislik', e.target.value)}
                    className="h-7 text-xs px-1.5 no-spinner"
                    type="number"
                    min="0"
                  />
                  <Input
                    value={s.adet}
                    onChange={e => updateSheet(s.id, 'adet', e.target.value)}
                    className="h-7 text-xs px-1 no-spinner text-center"
                    type="number"
                    min="0"
                    title="0 = sınırsız"
                  />
                  <button
                    onClick={() => removeSheet(s.id)}
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              </div>
              <Button variant="ghost" size="sm" onClick={addSheet} className="w-full mt-1 h-7 text-xs gap-1 text-muted-foreground border-dashed border">
                <Plus className="h-3 w-3" /> Levha Ekle
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1.5 px-1">Adet 0 = sınırsız levha kullan</p>
            </div>
          </div>

          {/* Seçenekler */}
          <div className="border rounded-md overflow-hidden">
            <SectionHeader title="Seçenekler" />
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Bıçak Ağzı (mm)</span>
                <Input
                  type="number"
                  min="0"
                  value={bladeThickness}
                  onChange={e => setBladeThickness(parseFloat(e.target.value) || 0)}
                  className="h-7 w-20 text-xs text-right"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Parça etiketleri</span>
                <button
                  onClick={() => setShowLabels(v => !v)}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    showLabels ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-card shadow transition-transform', showLabels ? 'translate-x-4' : 'translate-x-1')} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER: Canvas */}
        <div className="flex-1 min-w-0 flex flex-col border rounded-md bg-card overflow-hidden min-h-[400px] xl:min-h-0">
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <Play className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Hesapla&apos;ya tıkla</p>
                <p className="text-xs text-muted-foreground mt-1">Parçaları ve levhaları gir, sonra Hesapla&apos;ya bas</p>
              </div>
            </div>
          ) : (
            <>
              {/* Group navigation header */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0 flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">
                  Düzen {activeGroup + 1}/{totalGroups}
                  {currentSheetDim && ` — ${currentSheetDim.w}×${currentSheetDim.h}`}
                  {currentGroup && currentGroup.count > 1 && ` — x${currentGroup.count} levha`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveGroup(v => Math.max(0, v - 1))}
                    disabled={activeGroup === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-medium w-12 text-center">{activeGroup + 1} / {totalGroups}</span>
                  <button
                    onClick={() => setActiveGroup(v => Math.min(totalGroups - 1, v + 1))}
                    disabled={activeGroup === totalGroups - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 rounded hover:bg-muted" title="Uzaklaştır">
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] font-medium w-10 text-center tabular-nums">%{Math.round(zoom * 100)}</span>
                  <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1 rounded hover:bg-muted" title="Yakınlaştır">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  {zoom !== 1 && (
                    <button onClick={() => setZoom(1)} className="p-1 rounded hover:bg-muted text-[10px] text-muted-foreground" title="Sıfırla">
                      ↺
                    </button>
                  )}
                </div>
              </div>

              {/* Canvas area with zoom */}
              <div
                className="flex-1 overflow-auto min-h-0"
                onWheel={handleWheel}
              >
                <div style={{ width: 640 * zoom, height: 480 * zoom }}>
                  <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 640, height: 480 }}>
                    {currentSheetDim && (
                      <SheetCanvas
                        sheetW={currentSheetDim.w}
                        sheetH={currentSheetDim.h}
                        pieces={currentPieces}
                        showLabels={showLabels}
                        canvasW={640}
                        canvasH={480}
                        groupCount={currentGroup?.count ?? 1}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Unplaced warning */}
              {result.unplacedPieces.length > 0 && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700 shrink-0">
                  {result.unplacedPieces.length} parça yerleştirilemedi (levha boyutu çok küçük)
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT PANEL: Statistics */}
        <div className="xl:w-64 w-full shrink-0 flex flex-col gap-3 xl:overflow-y-auto">

          {/* Genel İstatistikler */}
          <div className="border rounded-md overflow-hidden">
            <SectionHeader title="Genel İstatistikler" />
            <div className="p-3">
              {!result ? (
                <p className="text-xs text-muted-foreground text-center py-2">Henüz hesaplanmadı</p>
              ) : (
                <>
                  <StatRow label="Toplam levha" value={result.sheetsUsed} />
                  <StatRow label="Farklı düzen" value={result.sheetGroups.length} />
                  <StatRow
                    label="Kullanılan alan"
                    value={result.totalUsedArea.toLocaleString('tr-TR')}
                    sub={`%${result.usedPercent}`}
                  />
                  <StatRow
                    label="Boş alan"
                    value={result.totalWasteArea.toLocaleString('tr-TR')}
                    sub={`%${result.wastePercent}`}
                  />
                  <StatRow label="Toplam kesim" value={result.totalCuts} />
                  <StatRow label="Kesim uzunluğu" value={result.totalCutLength.toLocaleString('tr-TR')} />
                  <StatRow label="Bıçak ağzı" value={`${result.bladeThickness} mm`} />
                  {result.unplacedPieces.length > 0 && (
                    <StatRow label="Yerleştirilemeyen" value={result.unplacedPieces.length} />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Düzen İstatistikleri */}
          <div className="border rounded-md overflow-hidden">
            <div className="bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-t-md flex items-center justify-between">
              <span>Düzen İstatistikleri</span>
              {result && totalGroups > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setActiveGroup(v => Math.max(0, v - 1))} disabled={activeGroup === 0} className="hover:opacity-70 disabled:opacity-30">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px]">{activeGroup + 1}/{totalGroups}</span>
                  <button onClick={() => setActiveGroup(v => Math.min(totalGroups - 1, v + 1))} disabled={activeGroup === totalGroups - 1} className="hover:opacity-70 disabled:opacity-30">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="p-3">
              {!result || !currentSheetStat ? (
                <p className="text-xs text-muted-foreground text-center py-2">Henüz hesaplanmadı</p>
              ) : (
                <>
                  <StatRow label="Levha boyutu" value={`${currentSheetStat.sheetW}×${currentSheetStat.sheetH}`} />
                  <StatRow label="Levha adedi" value={`x${currentGroup?.count ?? 1}`} />
                  <StatRow label="Kullanılan alan" value={currentSheetStat.usedArea.toLocaleString('tr-TR')} sub={`%${currentSheetStat.usedPercent}`} />
                  <StatRow label="Boş alan" value={currentSheetStat.wasteArea.toLocaleString('tr-TR')} sub={`%${currentSheetStat.wastePercent}`} />
                  <StatRow label="Parça sayısı" value={currentSheetStat.placedCount} />
                  <StatRow label="Kesim sayısı" value={currentSheetStat.cutCount} />
                  <StatRow label="Kesim uzunluğu" value={currentSheetStat.cutLength.toLocaleString('tr-TR')} />
                </>
              )}
            </div>
          </div>

          {/* Parça Listesi */}
          {result && (
            <div className="border rounded-md overflow-hidden">
              <SectionHeader title={`Kesimler — Düzen ${activeGroup + 1}`} />
              <div className="divide-y max-h-64 overflow-y-auto">
                {currentPieces.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Bu düzende parça yok</p>
                ) : (
                  currentPieces.map((p, i) => (
                    <div key={`${p.pieceId}-${p.instanceIndex}-${i}`} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                      <div
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: PIECE_COLORS[p.colorIndex % PIECE_COLORS.length] }}
                      />
                      <span className="flex-1 font-medium truncate">{p.label}</span>
                      <span className="text-muted-foreground tabular-nums text-[10px]">{p.w}×{p.h}</span>
                      {p.rotated && <span className="text-[10px] text-muted-foreground">↺</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
