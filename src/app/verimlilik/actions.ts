'use server'

import { auth } from '@/auth'
import { requireRole } from '@/lib/permissions'
import { logActivity } from '@/lib/activity-log'
import { getEmployeeMetrics, type VerimlilikFilters } from './service'

/**
 * CSV dışa aktarma — sadece yonetici/yazilimci. Backend'de requireRole() ile
 * zorlanır; sadece arayüzde butonu gizlemekle yetinilmez.
 */
export async function exportVerimlilikCsv(filters: VerimlilikFilters): Promise<string> {
  const session = await auth()
  requireRole(session?.user?.role, ['yonetici', 'yazilimci'])

  const metrics = await getEmployeeMetrics(filters)

  const headers = [
    'Çalışan', 'Kullanıcı Adı', 'Rol', 'Toplam İşlem', 'Oluşturma', 'Güncelleme',
    'Onaylama', 'Olumsuz İşlem', 'Aktif Gün', 'Son İşlem', 'Son Giriş',
    'Atölyeye Gönderilen', 'Montaja Gönderilen', 'Operasyon Skoru',
  ]
  const rows = metrics.map((m) => [
    m.displayName, m.username, m.roleLabel, m.totalActions, m.created, m.updated,
    m.approved, m.rejectedOrCancelled + m.deleted, m.activeDays,
    m.lastActionAt ? new Date(m.lastActionAt).toLocaleString('tr-TR') : '',
    m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString('tr-TR') : '',
    m.sentToAtolye, m.sentToMontaj, m.score ?? 'Veri yok',
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')

  const userId = session?.user?.id ? Number(session.user.id) : null
  if (userId) {
    await logActivity({
      userId,
      action: 'CREATE',
      entity: 'Report',
      details: { islem: 'Çalışan verimlilik raporu dışa aktarıldı (CSV)', kayitSayisi: metrics.length },
    })
  }

  return '﻿' + csv
}
