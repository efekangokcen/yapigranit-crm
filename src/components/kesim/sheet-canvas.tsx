'use client'

import { PlacedPiece } from '@/lib/kesim-optimizer'

export const PIECE_COLORS = [
  '#bfdbfe', '#bbf7d0', '#fecaca', '#fef08a', '#ddd6fe',
  '#a5f3fc', '#fed7aa', '#fbcfe8', '#d9f99d', '#e0e7ff',
  '#ccfbf1', '#fde68a', '#c7d2fe', '#fae8ff', '#dcfce7',
  '#ffedd5', '#e0f2fe', '#fce7f3', '#ecfccb', '#f0fdf4',
]

interface Props {
  sheetW: number
  sheetH: number
  pieces: PlacedPiece[]
  showLabels: boolean
  canvasW?: number
  canvasH?: number
  groupCount?: number
}

export function SheetCanvas({ sheetW, sheetH, pieces, showLabels, canvasW = 640, canvasH = 480, groupCount = 1 }: Props) {
  const padding = 40
  const availW = canvasW - padding * 2
  const availH = canvasH - padding * 2
  const scale = Math.min(availW / sheetW, availH / sheetH)
  const svgW = sheetW * scale
  const svgH = sheetH * scale
  const offsetX = padding + (availW - svgW) / 2
  const offsetY = padding + (availH - svgH) / 2

  return (
    <svg
      width={canvasW}
      height={canvasH}
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className="block"
    >
      {/* Sheet background */}
      <rect x={offsetX} y={offsetY} width={svgW} height={svgH} fill="#f9fafb" stroke="#374151" strokeWidth={1.5} />

      {/* Top dimension */}
      <line x1={offsetX} y1={offsetY - 10} x2={offsetX + svgW} y2={offsetY - 10} stroke="#9ca3af" strokeWidth={0.8} />
      <text x={offsetX + svgW / 2} y={offsetY - 14} textAnchor="middle" fontSize={10} fill="#6b7280">{sheetW}</text>

      {/* Left dimension */}
      <line x1={offsetX - 10} y1={offsetY} x2={offsetX - 10} y2={offsetY + svgH} stroke="#9ca3af" strokeWidth={0.8} />
      <text
        x={offsetX - 22}
        y={offsetY + svgH / 2}
        textAnchor="middle"
        fontSize={10}
        fill="#6b7280"
        transform={`rotate(-90, ${offsetX - 22}, ${offsetY + svgH / 2})`}
      >
        {sheetH}
      </text>

      {/* Right dimension (red) */}
      <text
        x={offsetX + svgW + 12}
        y={offsetY + svgH / 2}
        textAnchor="middle"
        fontSize={10}
        fill="#dc2626"
        fontWeight="600"
        transform={`rotate(90, ${offsetX + svgW + 12}, ${offsetY + svgH / 2})`}
      >
        {sheetH}
      </text>

      {/* Pieces */}
      {pieces.map((piece, i) => {
        const px = offsetX + piece.x * scale
        const py = offsetY + piece.y * scale
        const pw = piece.w * scale
        const ph = piece.h * scale
        const color = PIECE_COLORS[piece.colorIndex % PIECE_COLORS.length]
        const fontSize = Math.min(10, pw / 6, ph / 3)
        const showDim = pw > 35 && ph > 18

        return (
          <g key={`${piece.pieceId}-${piece.instanceIndex}-${i}`}>
            <rect x={px} y={py} width={pw} height={ph} fill={color} fillOpacity={0.85} stroke="#fff" strokeWidth={1.2} />
            {showLabels && showDim && fontSize > 5 && (
              <text x={px + pw / 2} y={py + ph / 2 - (showDim ? 4 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fill="#1f2937" fontWeight="600">
                {piece.label}
              </text>
            )}
            {showDim && (
              <text x={px + pw / 2} y={py + ph / 2 + (showLabels && showDim ? fontSize + 1 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(8, pw / 7, ph / 4)} fill="#374151">
                {piece.w}×{piece.h}
              </text>
            )}
            {piece.rotated && pw > 12 && ph > 12 && (
              <text x={px + pw - 4} y={py + 8} textAnchor="end" fontSize={7} fill="#6b7280">↺</text>
            )}
          </g>
        )
      })}

      {/* Group count badge */}
      {groupCount > 1 && (
        <text
          x={offsetX + svgW + 8}
          y={offsetY + svgH + 20}
          textAnchor="start"
          fontSize={22}
          fontWeight="bold"
          fill="#1f2937"
        >
          x{groupCount}
        </text>
      )}
    </svg>
  )
}
