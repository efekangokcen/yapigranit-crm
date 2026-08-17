'use client'

import { ServiceState } from '@/hooks/use-cost-calculation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'

interface ServicesSectionProps {
  services: ServiceState[]
  onServiceChange: (index: number, field: string, value: number) => void
}

const DISPLAY_ORDER = [3, 0, 4, 1, 2]
const DISPLAY_LABELS: Record<number, string> = {
  3: 'Eleman Montaj',
  0: 'Eleman Atölye',
  4: 'Nakliye',
  1: 'Atölye İşletme Maliyeti',
  2: 'Sarf Malzeme Gideri',
}

export function ServicesSection({ services, onServiceChange }: ServicesSectionProps) {
  const orderedServices = DISPLAY_ORDER
    .map((originalIndex) => ({ service: services[originalIndex], originalIndex }))
    .filter((item) => item.service)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">İşçilik ve Giderler</h3>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[230px]">Gider Kalemi</TableHead>
              <TableHead>Adet / Oran</TableHead>
              <TableHead>Birim</TableHead>
              <TableHead>Süre / Mesafe</TableHead>
              <TableHead>Süre Birimi</TableHead>
              <TableHead>Alış Fiyatı</TableHead>
              <TableHead>Gerçek Maliyet</TableHead>
              <TableHead>KDV&apos;li Fiyat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedServices.map(({ service, originalIndex }) => (
              <ServiceRow
                key={service.serviceType}
                service={service}
                index={originalIndex}
                label={DISPLAY_LABELS[originalIndex]}
                onChange={onServiceChange}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

interface ServiceRowProps {
  service: ServiceState
  index: number
  label: string
  onChange: (index: number, field: string, value: number) => void
}

function ServiceRow({ service, index, label, onChange }: ServiceRowProps) {
  const isAtolyeEleman = index === 0
  const isAtolyeIsletme = index === 1
  const isSarfMalzeme = index === 2
  const isSantiyeMontaj = index === 3
  const isNakliye = index === 4

  const renderWorkerSelect = () => {
    if (!isAtolyeEleman && !isSantiyeMontaj) return null
    return (
      <Select
        value={String(service.workers)}
        onValueChange={(v: unknown) => onChange(index, 'workers', parseInt(String(v)))}
      >
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{label}</TableCell>
      <TableCell>
        {(isAtolyeEleman || isSantiyeMontaj) && renderWorkerSelect()}
        {isAtolyeIsletme && (
          <Input
            type="number"
            min={1}
            step={1}
            value={service.workers || ''}
            onChange={(e) => onChange(index, 'workers', parseFloat(e.target.value) || 1)}
            className="w-20"
            placeholder="Grup"
          />
        )}
        {isSarfMalzeme && (
          <Input
            type="number"
            min={0}
            step={0.5}
            value={service.rate || ''}
            onChange={(e) => onChange(index, 'rate', parseFloat(e.target.value) || 0)}
            className="w-20"
            placeholder="%"
          />
        )}
        {isNakliye && (
          <Input
            type="number"
            min={1}
            value={service.trips || ''}
            onChange={(e) => onChange(index, 'trips', parseFloat(e.target.value) || 0)}
            className="w-20"
            placeholder="Kez"
          />
        )}
      </TableCell>
      <TableCell>
        {(isAtolyeEleman || isSantiyeMontaj) && <span>Kişi</span>}
        {isAtolyeIsletme && <span>Grup</span>}
        {isSarfMalzeme && <span>Grup</span>}
        {isNakliye && <span>Kez</span>}
      </TableCell>
      <TableCell>
        {isSarfMalzeme ? (
          <Input
            type="number"
            min={1}
            step={1}
            value={service.days || ''}
            onChange={(e) => onChange(index, 'days', parseFloat(e.target.value) || 1)}
            className="w-24"
            placeholder="Grup"
          />
        ) : isNakliye ? (
          <Input
            type="number"
            min={0}
            step={0.5}
            value={service.distanceKm || ''}
            onChange={(e) => onChange(index, 'distanceKm', parseFloat(e.target.value) || 0)}
            className="w-24"
            placeholder="KM"
          />
        ) : isAtolyeIsletme ? (
          <Input
            type="number"
            min={0.5}
            step={0.5}
            value={service.days || ''}
            onChange={(e) => onChange(index, 'days', parseFloat(e.target.value) || 0)}
            className="w-24"
          />
        ) : (
          <Input
            type="number"
            min={0.5}
            step={0.5}
            value={service.days || ''}
            onChange={(e) => onChange(index, 'days', parseFloat(e.target.value) || 0)}
            className="w-24"
          />
        )}
      </TableCell>
      <TableCell>
        {isNakliye ? 'KM' : isSarfMalzeme ? 'Grup' : 'Gün'}
      </TableCell>
      <TableCell>
        {isSarfMalzeme ? (
          <span className="text-sm text-muted-foreground">Otomatik</span>
        ) : (
          <span>{formatCurrency(service.rate)}</span>
        )}
      </TableCell>
      <TableCell className="font-medium">
        {formatCurrency(service.gercekMaliyet)}
      </TableCell>
      <TableCell className="font-medium">
        {formatCurrency(service.kdvliFiyat)}
      </TableCell>
    </TableRow>
  )
}
