/**
 * Rol bazlı erişim kontrolü — Edge Runtime uyumlu (middleware'de kullanılır, Prisma/Node API yok).
 *
 * 4 atanabilir rol:
 * - yonetici: tüm ekranları ve kullanıcı yönetimini görür
 * - pazarlamaci: sistem yönetimi hariç tüm iş ekranlarını görür
 * - atolyeci: sadece kendi ekranı (atölye/kesim)
 * - olcucu: sadece kendi ekranı (ölçü ekibi)
 *
 * Eski admin/yazilimci kayıtları geriye dönük olarak yönetici yetkisinde kalır.
 */

import { navGroups } from './nav-config'

export type AssignableRole = 'yonetici' | 'pazarlamaci' | 'atolyeci' | 'olcucu'
export type Role = AssignableRole | 'montajci' | 'yazilimci'

export const ROLES: AssignableRole[] = ['yonetici', 'pazarlamaci', 'olcucu', 'atolyeci']

export const ROLE_LABELS: Record<Role, string> = {
  yonetici: 'Yönetici',
  pazarlamaci: 'Pazarlamacı',
  atolyeci: 'Atölyeci',
  olcucu: 'Ölçücü',
  montajci: 'Montajcı (eski rol)',
  yazilimci: 'Yönetici',
}

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  yonetici: 'Tüm ekranları görür; kullanıcı ekleyebilir, şifre ve rol yönetebilir.',
  pazarlamaci: 'Kullanıcı ve sistem yönetimi hariç CRM, stok, ölçü, planlama ve atölye ekranlarını görür.',
  atolyeci: 'Sadece atölye alanını ve bu alanın alt ekranlarını görür.',
  olcucu: 'Sadece ölçü ekibi ekranını görür.',
}

// Eski değerler de yöneticiyle aynı yetkide tutulur.
const SUPERUSER_ROLES = new Set(['yonetici', 'yazilimci', 'admin'])

// Kısıtlı roller: SADECE burada listelenen sayfa önekleri görünür.
// '/verimlilik' herkese açık — o sayfa içeride kendi performans verisiyle sınırlanır (bkz. verimlilik/service.ts).
const RESTRICTED_ALLOW: Partial<Record<string, string[]>> = {
  atolyeci: ['/atolye'],
  olcucu: ['/olcu-ekibi'],
}

// Geniş roller: her şeyi görür, sadece burada listelenen önekler hariç.
const BLOCKED_FOR: Partial<Record<string, string[]>> = {
  pazarlamaci: [
    '/kullanicilar',
  ],
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

/** Verilen rolün bu sayfayı görüp göremeyeceğini söyler. */
export function canAccess(role: string | undefined | null, pathname: string): boolean {
  // Rolü olmayan oturum (ör. bu sistemden önceki eski çerez) hiçbir sayfayı göremez —
  // güvenli varsayılan budur; middleware bu durumda kullanıcıyı yeniden girişe yönlendirir.
  if (!role) return false
  const r = role
  if (SUPERUSER_ROLES.has(r)) return true

  const allow = RESTRICTED_ALLOW[r]
  if (allow) {
    return allow.some((p) => matchesPrefix(pathname, p))
  }

  const blocked = BLOCKED_FOR[r] || []
  if (blocked.some((p) => matchesPrefix(pathname, p))) return false

  // Ana sayfa (dashboard) sadece geniş rollerde ve yönetim özetinde anlamlı;
  // kısıtlı roller zaten yukarıda allow-list'e takılıp yakalanır.
  return true
}

/** Giriş sonrası veya yetkisiz erişimde yönlendirilecek varsayılan ekran. */
export function getRoleLanding(role: string | undefined | null): string {
  const r = role || 'yazilimci'
  if (r === 'atolyeci') return '/atolye'
  if (r === 'olcucu') return '/olcu-ekibi'
  return '/'
}

export function roleLabel(role: string | undefined | null): string {
  if (!role) return 'Yönetici'
  if (role === 'admin' || role === 'yazilimci') return 'Yönetici'
  if (role === 'montajci') return 'Montajcı (eski rol)'
  return ROLE_LABELS[role as Role] || role
}

/**
 * Sistemdeki gerçek navigasyon modülleri — sidebar'daki gruplarla birebir aynı.
 * nav-config.ts'ten türetilir; ayrı, güncelliğini kaybedecek statik bir tablo TUTULMAZ.
 */
export const MODULES: { href: string; label: string; group: string }[] = navGroups.flatMap((group) =>
  group.items.flatMap((item) => [
    // href'i olmayan öğeler yalnızca menü açıcısıdır, bir modül değildir.
    ...(item.href ? [{ href: item.href, label: item.label, group: group.label }] : []),
    ...(item.children ?? []).map((child) => ({ href: child.href, label: child.label, group: group.label })),
  ]),
)

/**
 * Server action'lar içinde kullanılacak minimal backend yetki kontrolü.
 * Middleware yalnızca SAYFA (route) erişimini korur — server action'ların kendi
 * içinde ayrı bir rol kontrolü YOKTUR (bu depoda doğrulanmış, gerçek bir mimari
 * boşluktur — bkz. docs/RISK_VE_COKME_ANALIZI.md). Yeni yazılan action'lar bu
 * fonksiyonla korunur; mevcut action'lara geriye dönük uygulanması ayrı bir iştir.
 */
export function requireRole(role: string | undefined | null, allowed: Role[]): void {
  if (!role || !allowed.includes(role as Role)) {
    throw new Error('Bu işlem için yetkiniz yok.')
  }
}

/**
 * Server action'ların İÇİNDE çağrılacak minimal backend kapı — sayfa erişimiyle
 * (canAccess) AYNI kaynağı kullanır, tek doğruluk kaynağı korunur. Bir kullanıcı
 * middleware'i (sayfa yönlendirmesini) atlayıp action'ı doğrudan çağırsa bile
 * (ör. action referansı başka bir izinli sayfadan sızmışsa) bu kontrol devreye girer.
 */
export function requireModuleAccess(role: string | undefined | null, pathname: string): void {
  if (!canAccess(role, pathname)) {
    throw new Error('Bu işlem için yetkiniz yok.')
  }
}
