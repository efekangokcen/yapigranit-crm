'use client'

import { ExternalServiceState } from '@/hooks/use-cost-calculation'
import { EXTERNAL_SERVICES_CATALOG } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

const EXTERNAL_UNIT_LABELS: Record<string, string> = {
  adet: 'Adet',
  m2: 'm²',
  mtül: 'Mtül',
  gün: 'Gün',
}

interface ExternalServicesSectionProps {
  externalServices: ExternalServiceState[]
  onAdd: (serviceKey: string) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number) => void
}

export function ExternalServicesSection({
  externalServices,
  onAdd,
  onRemove,
  onUpdate,
}: ExternalServicesSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Dış Hizmetler</h3>
        <Select onValueChange={(key: unknown) => onAdd(String(key))}>
          <SelectTrigger className="w-[280px]">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Dış Hizmet Ekle</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {EXTERNAL_SERVICES_CATALOG.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                {item.name} ({item.unit} / {item.price}₺)
              </SelectItem>
            ))}
            <SelectItem value="diger">Diğer (Manuel Giriş)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {externalServices.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hizmet</TableHead>
                <TableHead>Birim</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Birim Fiyat</TableHead>
                <TableHead>Gerçek Maliyet</TableHead>
                <TableHead>KDV&apos;li Fiyat</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {externalServices.map((es) => (
                <TableRow key={es.id}>
                  <TableCell>
                    {es.serviceKey === 'diger' ? (
                      <Input
                        value={es.jobType}
                        onChange={(e) => onUpdate(es.id, 'jobType', e.target.value)}
                        placeholder="İş türü"
                        className="w-48"
                      />
                    ) : (
                      <span className="font-medium">{es.jobType}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {es.serviceKey === 'diger' ? (
                      <Select
                        value={es.unit}
                        onValueChange={(v: unknown) => onUpdate(es.id, 'unit', String(v))}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue>{(v: string) => EXTERNAL_UNIT_LABELS[v] ?? v}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="adet">Adet</SelectItem>
                          <SelectItem value="m2">m²</SelectItem>
                          <SelectItem value="mtül">Mtül</SelectItem>
                          <SelectItem value="gün">Gün</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span>{es.unit}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={es.quantity || ''}
                      onChange={(e) => onUpdate(es.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    {es.serviceKey === 'diger' ? (
                      <Input
                        type="number"
                        min={0}
                        value={es.unitPrice || ''}
                        onChange={(e) => onUpdate(es.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-28"
                      />
                    ) : (
                      <span>{formatCurrency(es.unitPrice)}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(es.gercekMaliyet)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(es.kdvliFiyat)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(es.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {externalServices.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Henüz dış hizmet eklenmedi.
        </p>
      )}
    </div>
  )
}
