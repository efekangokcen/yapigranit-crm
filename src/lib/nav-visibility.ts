import { canAccess } from './permissions'
import type { NavItem } from './nav-config'

/**
 * Menü öğelerini role göre süzer — sidebar ve mobile-sidebar aynı kuralı kullansın diye
 * tek yerde.
 *
 * Kurallar:
 *  - Erişilemeyen alt öğeler düşer.
 *  - Kendi sayfası olmayan (yalnızca açıcı) bir öğe, hiç alt öğesi kalmazsa gizlenir.
 *  - Açıcının tek bir alt öğesi kaldıysa o alt öğe DOĞRUDAN gösterilir; kullanıcıyı
 *    tek satırlık bir grubu açmaya zorlamak anlamsız (ör. atölyeci sadece "Atölye"
 *    görür, "Üretim Akışı" grubunu değil).
 */
export function visibleNavItems(items: NavItem[], role: string | undefined | null): NavItem[] {
  const out: NavItem[] = []

  for (const item of items) {
    const children = (item.children ?? []).filter((c) => canAccess(role, c.href))
    const selfOk = !!item.href && canAccess(role, item.href)

    if (item.href) {
      if (selfOk) out.push({ ...item, children: children.length ? children : undefined })
      continue
    }

    if (children.length === 0) continue
    if (children.length === 1) {
      out.push({ href: children[0].href, label: children[0].label, icon: item.icon })
      continue
    }
    out.push({ ...item, children })
  }

  return out
}
