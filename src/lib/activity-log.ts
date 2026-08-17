import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'APPROVE' | 'REJECT' | 'ARCHIVE' | 'CANCEL'
export type LogEntity =
  | 'Customer'
  | 'CostCalculation'
  | 'Quote'
  | 'Contract'
  | 'Payment'
  | 'TasTakip'
  | 'StoneStockSlab'
  | 'MeasurementTask'
  | 'MeasurementResult'
  | 'RevisionRequest'
  | 'NotificationLog'
  | 'ContractItem'
  | 'Cari'
  | 'CariHareket'
  | 'ContractItem'
  | 'Cari'
  | 'CariHareket'
  | 'StonePrice'
  | 'PriceAdjustment'
  | 'User'
  | 'Report'

export async function logActivity(params: {
  userId: number
  action: LogAction
  entity: LogEntity
  entityId?: number
  details?: Record<string, unknown>
}) {
  try {
    let ipAddress: string | null = null
    let userAgent: string | null = null
    try {
      const requestHeaders = await headers()
      const forwardedFor = requestHeaders.get('x-forwarded-for')
      ipAddress = forwardedFor?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || null
      userAgent = requestHeaders.get('user-agent') || null
    } catch {
      // İstek dışı çalışan görevlerde de aktivite kaydı tutulmaya devam eder.
    }
    const details = {
      ...(params.details || {}),
      _meta: {
        ipAddress,
        userAgent,
        recordedAt: new Date().toISOString(),
      },
    }
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: JSON.stringify(details),
      },
    })
  } catch {
    // Log hataları ana işlemi durdurmamalı
    console.error('Activity log yazılamadı')
  }
}
