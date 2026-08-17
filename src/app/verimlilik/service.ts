import { prisma } from '@/lib/prisma'
import { ROLE_LABELS, type Role } from '@/lib/permissions'

/**
 * VERİ KAYNAĞI NOTU (dürüstlük ilkesi — bkz. docs/CALISAN_VERIMLILIK_MODULU.md)
 *
 * Bu CRM'de Django tarzı jenerik bir "Task/Görev" tablosu YOKTUR. Kullanıcı bazında
 * gerçekten var olan tek işlem kaydı `ActivityLog`'dur — bu oturumda 8 modülün
 * (musteriler, maliyet, teklifler, sozlesmeler, odemeler, tas-takibi, planlama,
 * kullanicilar) server action'larına eklenen `logActivity()` çağrılarıyla dolduruluyor.
 * Bu yüzden "görev" burada ActivityLog kayıtları üzerinden türetiliyor:
 *   - CREATE / APPROVE  → olumlu/tamamlayıcı işlem
 *   - UPDATE            → devam eden/işlenen işlem
 *   - REJECT / CANCEL / DELETE → olumsuz/geri alma işlemi
 *   - LOGIN              → oturum açma (aktiflik göstergesi, iş yükü sayılmaz)
 *
 * Sistemde OLMAYAN ve bu yüzden UYDURULMAYAN veriler:
 *   - Görev son teslim tarihi / "gecikme" kavramı (hiçbir modelde per-çalışan
 *     due-date alanı yok — Payment.vadeTarihi müşteri ödeme vadesidir, çalışan
 *     görev tarihi değildir)
 *   - Görev zorluk/ağırlık puanı (hiçbir modelde yok — bu yüzden operasyon
 *     skorunda "kolay çok iş" / "zor az iş" ağırlıklandırması UYGULANMAMIŞTIR,
 *     bu açıkça belirtilir)
 *   - User.isActive alanı yok — "aktif kullanıcı" bu modülde "seçili aralıkta en
 *     az 1 ActivityLog kaydı olan kullanıcı" olarak TÜRETİLMİŞ bir yaklaşıktır
 *   - Departman tablosu yok — "departman" rolün kendisiyle temsil edilir
 *   - Customer.ilgilenenPersonel serbest metin bir alandır (User'a FK değildir);
 *     bu yüzden "sorumlu olduğu müşteri sayısı" isim eşleştirmesiyle YAKLAŞIK
 *     hesaplanır ve ekranda açıkça "yaklaşık" olarak işaretlenir
 *
 * Gerçek ilişkisel (FK) veri: ContractItem.sentToAtolyeById / sentToMontajById
 * alanları gerçek User.id değerleridir (üretim devri onaylarını kim yaptı) — bu
 * ikisi ActivityLog'a ihtiyaç duymadan doğrudan sorgulanır.
 */

export interface EmployeeMetrics {
  userId: number
  displayName: string
  username: string
  role: string
  roleLabel: string
  // ActivityLog tabanlı, tarih aralığı içinde
  totalActions: number
  created: number
  updated: number
  approved: number
  rejectedOrCancelled: number
  deleted: number
  logins: number
  activeDays: number
  lastActionAt: string | null
  lastLoginAt: string | null
  entityBreakdown: Record<string, number>
  // Gerçek FK tabanlı üretim devri sayıları
  sentToAtolye: number
  sentToMontaj: number
  // Yaklaşık (isim eşleşmesi) — customer.ilgilenenPersonel
  approxCustomerCount: number
  // Skor
  score: number | null
  scoreBreakdown: ScoreBreakdown | null
}

export interface ScoreBreakdown {
  activeDayRatio: number
  volumeScore: number
  completionRatio: number
  negativeRatio: number
  raw: number
  final: number
  rangeDays: number
  volumeReferenceP90: number
}

const NEGATIVE_ACTIONS = new Set(['REJECT', 'CANCEL', 'DELETE'])

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

/**
 * OPERASYON SKORU FORMÜLÜ (0–100 arası, servis katmanında hesaplanır)
 *
 * final = clamp(0, 100, round( 100 * raw / 0.85 ))
 * raw   = 0.30 * aktiflikOranı + 0.30 * hacimSkoru + 0.25 * tamamlamaOranı − 0.15 * olumsuzOranı
 *
 *   aktiflikOranı   = aralıktaki işlem yapılan gün sayısı / aralığın toplam gün sayısı   (0–1)
 *   hacimSkoru      = min(1, toplamİşlem / o aralıktaki tüm kullanıcıların 90. persentili) (0–1)
 *   tamamlamaOranı  = (CREATE + APPROVE) / toplamİşlem                                    (0–1)
 *   olumsuzOranı    = (REJECT + CANCEL + DELETE) / toplamİşlem                            (0–1)
 *
 * 0.85 ile bölme, üç pozitif ağırlığın toplamı (0.30+0.30+0.25) olduğu için —
 * olumsuz işlemi hiç olmayan, tam aktif, hacim lideri bir kullanıcı tam 100 alır.
 *
 * Kurallar:
 *   - Seçili aralıkta HİÇ işlemi olmayan çalışan için skor `null` döner ve ekranda
 *     "Bu aralıkta veri yok" gösterilir — 0 puan verip yanlış biçimde
 *     başarısız/cezalı gösterilmez.
 *   - Bölme işlemleri sıfıra bölmeye karşı korumalıdır (aşağıdaki || 0 / Math.max kontrolleri).
 *   - Görev zorluk/ağırlık verisi sistemde bulunmadığı için bu formülde YOKTUR —
 *     bu kısıtlama README/rapor ve ekranın kendisinde açıkça belirtilir.
 *   - Bu skor DOĞRUDAN disiplin veya ücret kararı için kullanılmamalıdır.
 */
function computeScore(
  totalActions: number,
  activeDays: number,
  rangeDays: number,
  created: number,
  approved: number,
  negative: number,
  volumeReferenceP90: number,
): { score: number; breakdown: ScoreBreakdown } | null {
  if (totalActions === 0) return null

  const activeDayRatio = Math.min(1, activeDays / rangeDays)
  const volumeScore = volumeReferenceP90 > 0 ? Math.min(1, totalActions / volumeReferenceP90) : 0
  const completionRatio = (created + approved) / totalActions
  const negativeRatio = negative / totalActions

  const raw = 0.3 * activeDayRatio + 0.3 * volumeScore + 0.25 * completionRatio - 0.15 * negativeRatio
  const final = Math.max(0, Math.min(100, Math.round((100 * raw) / 0.85)))

  return {
    score: final,
    breakdown: {
      activeDayRatio,
      volumeScore,
      completionRatio,
      negativeRatio,
      raw,
      final,
      rangeDays,
      volumeReferenceP90,
    },
  }
}

export interface VerimlilikFilters {
  startDate: Date
  endDate: Date
  userIds?: number[]
  roles?: string[]
}

export async function getEmployeeMetrics(filters: VerimlilikFilters): Promise<EmployeeMetrics[]> {
  const { startDate, endDate } = filters
  const rangeDays = daysBetween(startDate, endDate)

  const users = await prisma.user.findMany({
    where: {
      ...(filters.userIds?.length ? { id: { in: filters.userIds } } : {}),
      ...(filters.roles?.length ? { role: { in: filters.roles } } : {}),
    },
    orderBy: { displayName: 'asc' },
  })

  if (users.length === 0) return []
  const userIds = users.map((u) => u.id)

  const [logs, gatesSent, gatesMontaj, customers] = await Promise.all([
    prisma.activityLog.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: startDate, lte: endDate } },
      select: { userId: true, action: true, entity: true, createdAt: true },
    }),
    prisma.contractItem.groupBy({
      by: ['sentToAtolyeById'],
      where: { sentToAtolyeById: { in: userIds }, sentToAtolyeAt: { gte: startDate, lte: endDate } },
      _count: { _all: true },
    }),
    prisma.contractItem.groupBy({
      by: ['sentToMontajById'],
      where: { sentToMontajById: { in: userIds }, sentToMontajAt: { gte: startDate, lte: endDate } },
      _count: { _all: true },
    }),
    prisma.customer.findMany({ where: { deletedAt: null }, select: { ilgilenenPersonel: true } }),
  ])

  const atolyeMap = new Map(gatesSent.map((g) => [g.sentToAtolyeById, g._count._all]))
  const montajMap = new Map(gatesMontaj.map((g) => [g.sentToMontajById, g._count._all]))

  // İsim eşleşmesiyle yaklaşık müşteri sayısı (bkz. dosya üstü not)
  const customerCountByName = new Map<string, number>()
  for (const c of customers) {
    if (!c.ilgilenenPersonel) continue
    const key = c.ilgilenenPersonel.trim().toLocaleLowerCase('tr-TR')
    customerCountByName.set(key, (customerCountByName.get(key) ?? 0) + 1)
  }

  const perUser = new Map<number, {
    total: number; created: number; updated: number; approved: number
    negative: number; deleted: number; logins: number
    days: Set<string>; lastActionAt: Date | null; lastLoginAt: Date | null
    entityBreakdown: Record<string, number>
  }>()
  for (const u of users) {
    perUser.set(u.id, {
      total: 0, created: 0, updated: 0, approved: 0, negative: 0, deleted: 0, logins: 0,
      days: new Set(), lastActionAt: null, lastLoginAt: null, entityBreakdown: {},
    })
  }

  for (const log of logs) {
    const bucket = perUser.get(log.userId)
    if (!bucket) continue
    bucket.total += 1
    bucket.entityBreakdown[log.entity] = (bucket.entityBreakdown[log.entity] ?? 0) + 1
    bucket.days.add(log.createdAt.toISOString().slice(0, 10))
    if (!bucket.lastActionAt || log.createdAt > bucket.lastActionAt) bucket.lastActionAt = log.createdAt

    if (log.action === 'LOGIN') {
      bucket.logins += 1
      if (!bucket.lastLoginAt || log.createdAt > bucket.lastLoginAt) bucket.lastLoginAt = log.createdAt
      continue
    }
    if (log.action === 'CREATE') bucket.created += 1
    else if (log.action === 'UPDATE') bucket.updated += 1
    else if (log.action === 'APPROVE') bucket.approved += 1
    else if (log.action === 'DELETE') { bucket.deleted += 1; bucket.negative += 1 }
    else if (NEGATIVE_ACTIONS.has(log.action)) bucket.negative += 1
  }

  // 90. persentil hacim referansı — skor formülünde sıfıra bölme koruması dahil
  const totals = [...perUser.values()].map((b) => b.total).filter((t) => t > 0).sort((a, b) => a - b)
  const volumeReferenceP90 = percentile(totals, 90)

  return users.map((u): EmployeeMetrics => {
    const b = perUser.get(u.id)!
    const nameKey = u.displayName.trim().toLocaleLowerCase('tr-TR')
    const scoreResult = computeScore(
      b.total, b.days.size, rangeDays, b.created, b.approved, b.negative, volumeReferenceP90,
    )

    return {
      userId: u.id,
      displayName: u.displayName,
      username: u.username,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role as Role] ?? u.role,
      totalActions: b.total,
      created: b.created,
      updated: b.updated,
      approved: b.approved,
      rejectedOrCancelled: b.negative - b.deleted,
      deleted: b.deleted,
      logins: b.logins,
      activeDays: b.days.size,
      lastActionAt: b.lastActionAt ? b.lastActionAt.toISOString() : null,
      lastLoginAt: b.lastLoginAt ? b.lastLoginAt.toISOString() : null,
      entityBreakdown: b.entityBreakdown,
      sentToAtolye: atolyeMap.get(u.id) ?? 0,
      sentToMontaj: montajMap.get(u.id) ?? 0,
      approxCustomerCount: customerCountByName.get(nameKey) ?? 0,
      score: scoreResult?.score ?? null,
      scoreBreakdown: scoreResult?.breakdown ?? null,
    }
  })
}

export interface EmployeeDetail extends EmployeeMetrics {
  recentActions: { id: number; action: string; entity: string; entityId: number | null; details: string | null; createdAt: string }[]
  dailyActivity: { date: string; count: number }[]
}

export async function getEmployeeDetail(userId: number, filters: VerimlilikFilters): Promise<EmployeeDetail | null> {
  const metrics = await getEmployeeMetrics({ ...filters, userIds: [userId] })
  const base = metrics[0]
  if (!base) return null

  const logs = await prisma.activityLog.findMany({
    where: { userId, createdAt: { gte: filters.startDate, lte: filters.endDate } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const dailyMap = new Map<string, number>()
  for (const log of logs) {
    const key = log.createdAt.toISOString().slice(0, 10)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
  }

  return {
    ...base,
    recentActions: logs.map((l) => ({
      id: l.id, action: l.action, entity: l.entity, entityId: l.entityId,
      details: l.details, createdAt: l.createdAt.toISOString(),
    })),
    dailyActivity: [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count })),
  }
}
