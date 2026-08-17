'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, KeyRound, Plus, ShieldQuestion, UserPlus } from 'lucide-react'
import { MODULES, ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, canAccess, roleLabel, type AssignableRole } from '@/lib/permissions'
import { createUser, updateUserRole, resetUserPassword } from './actions'

interface UserRow {
  id: number
  username: string
  displayName: string
  role: string
  createdAt: string
}

type SortKey = 'displayName' | 'username' | 'role'

function SortIndicator({
  column,
  sortKey,
  sortDir,
}: {
  column: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
}) {
  if (sortKey !== column) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
  return sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  yonetici: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800',
  pazarlamaci: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  atolyeci: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200',
  olcucu: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200',
  montajci: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  yazilimci: 'bg-slate-800 text-white',
  admin: 'bg-slate-800 text-white',
}

export function KullanicilarClient({ users }: { users: UserRow[] }) {
  const router = useRouter()
  const { data: session } = useSession()
  const myId = session?.user?.id ? Number(session.user.id) : null

  const [newOpen, setNewOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AssignableRole>('pazarlamaci')
  const [saving, setSaving] = useState(false)

  const [resetId, setResetId] = useState<number | null>(null)
  const [resetPassword, setResetPasswordValue] = useState('')
  const [resetting, setResetting] = useState(false)

  const [roleUpdatingId, setRoleUpdatingId] = useState<number | null>(null)

  const [sortKey, setSortKey] = useState<SortKey>('displayName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      const av = sortKey === 'role' ? roleLabel(a.role) : a[sortKey]
      const bv = sortKey === 'role' ? roleLabel(b.role) : b[sortKey]
      return av.localeCompare(bv, 'tr', { sensitivity: 'base' })
    })
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [users, sortKey, sortDir])

  const handleCreate = async () => {
    setSaving(true)
    try {
      await createUser({ username, displayName, password, role })
      toast.success(`${displayName} kullanıcısı oluşturuldu (${roleLabel(role)}).`)
      setNewOpen(false)
      setUsername('')
      setDisplayName('')
      setPassword('')
      setRole('pazarlamaci')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kullanıcı oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (id: number, newRole: string) => {
    setRoleUpdatingId(id)
    try {
      await updateUserRole(id, newRole)
      toast.success('Rol güncellendi.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rol güncellenemedi.')
    } finally {
      setRoleUpdatingId(null)
    }
  }

  const handleResetPassword = async () => {
    if (!resetId) return
    setResetting(true)
    try {
      await resetUserPassword(resetId, resetPassword)
      toast.success('Şifre sıfırlandı.')
      setResetId(null)
      setResetPasswordValue('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Şifre sıfırlanamadı.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <Card key={r} className="cursor-default border-border/80">
            <CardContent className="p-4">
              <Badge className={ROLE_BADGE_CLASS[r]}>{ROLE_LABELS[r]}</Badge>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
              <div className="mt-3 space-y-1 border-t pt-3">
                {MODULES.filter((module) => canAccess(r, module.href)).map((module) => (
                  <p key={module.href} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                    {module.label}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kullanıcılar ({users.length})</CardTitle>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Yeni Kullanıcı
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" onClick={() => handleSort('displayName')} className="flex items-center gap-1.5 hover:text-foreground">
                    Ad Soyad <SortIndicator column="displayName" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleSort('username')} className="flex items-center gap-1.5 hover:text-foreground">
                    Kullanıcı Adı <SortIndicator column="username" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => handleSort('role')} className="flex items-center gap-1.5 hover:text-foreground">
                    Rol <SortIndicator column="role" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="w-[140px]">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.displayName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">@{u.username}</TableCell>
                  <TableCell>
                    {u.id === myId ? (
                      <Badge className={ROLE_BADGE_CLASS[u.role] || ''}>{roleLabel(u.role)}</Badge>
                    ) : (
                      <Select
                        value={ROLES.includes(u.role as AssignableRole) ? u.role : undefined}
                        onValueChange={(v) => v && handleRoleChange(u.id, v)}
                      >
                        <SelectTrigger className="h-8 w-[160px]" disabled={roleUpdatingId === u.id}>
                          <SelectValue placeholder={roleLabel(u.role)}>{(v: string) => roleLabel(v)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setResetId(u.id); setResetPasswordValue('') }}
                      title="Şifre sıfırla"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Yeni Kullanıcı */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Yeni Kullanıcı
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Ad Soyad</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Örn. Ayşe Yıldız" />
            </div>
            <div className="space-y-1.5">
              <Label>Kullanıcı Adı</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ayse" />
            </div>
            <div className="space-y-1.5">
              <Label>Şifre</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 4 karakter" />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v as AssignableRole)}>
                <SelectTrigger><SelectValue>{(v: string) => roleLabel(v)}</SelectValue></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="flex items-start gap-1 text-xs text-muted-foreground">
                <ShieldQuestion className="mt-0.5 h-3 w-3 shrink-0" />
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kullanıcı Oluştur'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Şifre Sıfırla */}
      <Dialog open={resetId !== null} onOpenChange={(open) => { if (!open) setResetId(null) }}>
        <DialogContent className="sm:max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Şifreyi Sıfırla
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Yeni Şifre</Label>
            <Input type="password" value={resetPassword} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="En az 4 karakter" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetId(null)} disabled={resetting}>Vazgeç</Button>
            <Button onClick={handleResetPassword} disabled={resetting}>{resetting ? 'Kaydediliyor...' : 'Şifreyi Sıfırla'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
