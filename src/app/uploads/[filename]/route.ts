import { NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import { getUploadDir } from '@/lib/upload-storage'

// /uploads/* eskiden public/uploads altından statik servis ediliyordu; artık
// dosyalar kalıcı Volume'da (bkz. getUploadDir) olduğu için burada elle
// okunup dönüyor — veritabanındaki eski /uploads/... URL'leri değişmeden çalışır.
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
  '.dwg': 'application/acad',
  '.dxf': 'application/dxf',
  '.skp': 'application/octet-stream',
}

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params

  // Next.js [filename] segmenti tek bir path parçası olsa da, savunmada
  // ikinci katman olarak "/" veya ".." içeren istekleri kesin reddediyoruz.
  if (!filename || filename.includes('/') || filename.includes('..')) {
    return NextResponse.json({ error: 'Geçersiz dosya adı' }, { status: 400 })
  }

  const ext = path.extname(filename).toLowerCase()
  const contentType = CONTENT_TYPES[ext]
  if (!contentType) {
    return NextResponse.json({ error: 'Desteklenmeyen dosya türü' }, { status: 400 })
  }

  const filePath = path.join(getUploadDir(), filename)
  try {
    const info = await stat(filePath)
    if (!info.isFile()) throw new Error('not a file')
    const buffer = await readFile(filePath)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ...(!contentType.startsWith('image/') ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {}),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 404 })
  }
}
