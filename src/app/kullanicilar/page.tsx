import { UserCog } from 'lucide-react'
import { PageHero } from '@/components/ui/page-hero'
import { getUsers } from './actions'
import { KullanicilarClient } from './kullanicilar-client'

export const dynamic = 'force-dynamic'

export default async function KullanicilarPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Sistem Yönetimi"
        title="Kullanıcı Yönetimi"
        description="Kullanıcı ekle, rol ata, şifre sıfırla"
        icon={<UserCog className="h-5 w-5" />}
        stats={[
          { label: 'Toplam Kullanıcı', value: users.length },
        ]}
      />
      <KullanicilarClient
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      />
    </div>
  )
}
