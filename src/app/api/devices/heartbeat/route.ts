import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { timingSafeEqual } from 'crypto'

/**
 * GÜVENLİK NOTU: bu uç nokta imalathanedeki fiziksel Windows terminallerinden
 * çağrılıyor (kod tabanında hiçbir tarayıcı bileşeni bunu import etmiyor) — yani
 * normal kullanıcı oturumu (cookie) YOK. Bu yüzden `auth()` session kontrolü
 * EKLENMEDİ (eklenseydi gerçek cihaz entegrasyonunu kırardı — bu proje kapsamında
 * cihaz tarafındaki script görülemedi). Bunun yerine paylaşılan bir anahtar
 * (`DEVICE_API_KEY`) zorunludur — tanımlı değilse veya `x-device-key` header'ı
 * eşleşmezse istek reddedilir. Terminal tarafındaki script'in bu anahtarı aynı
 * header ile göndermesi gerekir.
 */
function checkDeviceKey(request: Request): boolean {
  const expected = process.env.DEVICE_API_KEY
  if (!expected) {
    console.error('[devices/heartbeat] DEVICE_API_KEY tanımlı değil — istek reddedildi.')
    return false
  }
  const supplied = request.headers.get('x-device-key')
  if (!supplied) return false
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)
}

export async function POST(request: Request) {
  try {
    if (!checkDeviceKey(request)) {
      return NextResponse.json({ error: 'Geçersiz cihaz anahtarı' }, { status: 401 })
    }

    const body = await request.json()
    const { macAddress, ipAddress, status, currentOperator, currentJob, isOnline } = body

    if (typeof macAddress !== 'string' || !/^[0-9A-Fa-f:-]{12,20}$/.test(macAddress)) {
      return NextResponse.json({ error: 'macAddress is required' }, { status: 400 })
    }
    if (status !== undefined && !['offline', 'idle', 'running', 'maintenance'].includes(status)) return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 })
    if (currentOperator !== undefined && currentOperator !== null && (typeof currentOperator !== 'string' || currentOperator.length > 100)) return NextResponse.json({ error: 'Geçersiz operatör' }, { status: 400 })
    if (currentJob !== undefined && currentJob !== null && (typeof currentJob !== 'string' || currentJob.length > 250)) return NextResponse.json({ error: 'Geçersiz iş' }, { status: 400 })

    // macAddress artık benzersiz (@unique) — upsert eşzamanlı isteklerde mükerrer
    // cihaz kaydı oluşmasını DB seviyesinde engeller.
    const updatedDevice = await prisma.productionDevice.upsert({
      where: { macAddress },
      update: {
        ipAddress: ipAddress || undefined,
        isOnline: isOnline !== undefined ? isOnline : true,
        status: status || undefined,
        currentOperator: currentOperator !== undefined ? currentOperator : undefined,
        currentJob: currentJob !== undefined ? currentJob : undefined,
        lastHeartbeat: new Date(),
      },
      create: {
        name: body.name || 'Yeni Windows Terminal',
        macAddress,
        ipAddress: ipAddress || null,
        isOnline: true,
        status: status || 'idle',
        currentOperator: currentOperator || null,
        currentJob: currentJob || null,
        lastHeartbeat: new Date(),
      },
    })

    revalidatePath('/imalathane')

    return NextResponse.json({ success: true, device: updatedDevice })
  } catch (err) {
    console.error('[devices/heartbeat]', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
