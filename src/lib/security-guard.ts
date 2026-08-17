import { auth } from '@/auth'
import { canAccess } from '@/lib/permissions'

export interface UserSessionInfo {
  id: number
  username: string
  role: string
}

/**
 * Mevcut oturum açmış kullanıcıyı döndürür.
 */
export async function getAuthenticatedUser(): Promise<UserSessionInfo | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  return {
    id: Number(session.user.id),
    username: session.user.username || '',
    role: session.user.role || 'yazilimci',
  }
}

/**
 * Nesne / Kayıt seviyesinde erişim kontrolü (SuiteCRM Record ACL esintili).
 */
export async function checkRecordPermission(params: {
  entity: 'Customer' | 'Contract' | 'Quote' | 'Payment' | 'TasTakip' | 'MeasurementTask' | 'ContractItem'
  recordOwnerId?: number
  assignedTeam?: string
  pathname?: string
}): Promise<boolean> {
  const user = await getAuthenticatedUser()
  if (!user) return false

  // Admin & Yazılımcı & Yönetici tam yetkili
  if (['admin', 'yazilimci', 'yonetici'].includes(user.role)) {
    return true
  }

  // Modül sayfa yetkisi kontrolü
  if (params.pathname && !canAccess(user.role, params.pathname)) {
    return false
  }

  // Kısıtlı roller kendi atandığı ekibe veya kayda erişebilir
  if (params.assignedTeam) {
    if (user.role === 'olcucu' && params.assignedTeam.includes('Ölçü')) return true
    if (user.role === 'atolyeci' && params.assignedTeam.includes('Atölye')) return true
    if (user.role === 'montajci' && params.assignedTeam.includes('Montaj')) return true
  }

  // Pazarlamacı kendi oluşturduğu veya atandığı müşteriye/teklife erişebilir
  if (user.role === 'pazarlamaci') {
    return !params.recordOwnerId || params.recordOwnerId === user.id
  }

  // Yukarıdaki kurallardan hiçbiri izin vermediyse eriş(e)mez — deny-by-default.
  return false
}

/**
 * Server Action'larda kayıt seviyesinde yetki yoksa hata fırlatır.
 */
export async function requireRecordPermission(params: {
  entity: 'Customer' | 'Contract' | 'Quote' | 'Payment' | 'TasTakip' | 'MeasurementTask' | 'ContractItem'
  recordOwnerId?: number
  assignedTeam?: string
  pathname?: string
}): Promise<UserSessionInfo> {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new Error('Oturum süreniz dolmuş. Lütfen yeniden giriş yapın.')
  }

  const allowed = await checkRecordPermission(params)
  if (!allowed) {
    throw new Error('Bu kaydı değiştirme veya görüntüleme yetkiniz yok.')
  }

  return user
}
