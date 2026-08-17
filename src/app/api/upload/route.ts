import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'
import { getUploadDir } from '@/lib/upload-storage'

// Gerçek çağıranlar: olcu-ekibi (saha fotoğrafı), planlama/uretim (kesim çizimi),
// montaj-ekibi (teslim fotoğrafı), tas-takibi (ürün fotoğrafı). Sadece bunlardan
// erişimi olan roller yükleyebilir.
const UPLOAD_ALLOWED_PATHS = ['/olcu-ekibi', '/planlama/uretim', '/montaj-ekibi', '/tas-takibi']

// public/uploads klasörü web'e doğrudan servis edildiği için (statik dosya sunucusu)
// yüklenen dosyanın tarayıcıda çalıştırılabilir olmaması KRİTİK — aksi halde
// stored XSS riski oluşur (ör. .html/.svg/.js). Sadece bu uygulamanın gerçekten
// kullandığı fotoğraf ve çizim formatlarına izin verilir.
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf', '.dwg', '.dxf', '.skp'])
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

function hasValidSignature(ext: string, buffer: Buffer) {
  if (ext === '.jpg' || ext === '.jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (ext === '.png') return buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
  if (ext === '.webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  if (ext === '.pdf') return buffer.subarray(0, 5).toString() === '%PDF-'
  if (ext === '.heic') return buffer.subarray(4, 12).toString().includes('ftyp')
  return true // CAD dosyaları tarayıcıda attachment/octet-stream olarak servis edilir.
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    const role = session?.user?.role
    if (!role || !UPLOAD_ALLOWED_PATHS.some((p) => canAccess(role, p))) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Dosya çok büyük (maksimum 25 MB).' }, { status: 413 })
    }

    const fileExtension = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(fileExtension)) {
      return NextResponse.json(
        { error: `Desteklenmeyen dosya türü. İzin verilenler: ${[...ALLOWED_EXTENSIONS].join(', ')}` },
        { status: 415 },
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    if (!hasValidSignature(fileExtension, buffer)) {
      return NextResponse.json({ error: 'Dosya içeriği uzantıyla uyuşmuyor.' }, { status: 415 })
    }

    // Kalıcı yükleme dizinini oluştur (yoksa) — bkz. getUploadDir yorumu.
    const uploadDir = getUploadDir()
    await mkdir(uploadDir, { recursive: true })

    // Eşsiz bir dosya adı üret — orijinal dosya adı asla dosya sistemine yazılmaz
    // (path traversal'a karşı yalnızca doğrulanmış uzantı korunur).
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${fileExtension}`
    const filePath = path.join(uploadDir, fileName)

    // Dosyayı diske kaydet
    await writeFile(filePath, buffer)

    // Erişilebilir yerel URL'yi dön
    return NextResponse.json({ url: `/uploads/${fileName}` })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Yükleme hatası' }, { status: 500 })
  }
}
