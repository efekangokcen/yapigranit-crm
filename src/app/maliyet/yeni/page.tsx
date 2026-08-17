'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Calculator, UserPlus } from 'lucide-react'

import { CostForm } from '@/components/cost/cost-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PageHero } from '@/components/ui/page-hero'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createCostCalculation } from '../actions'

interface Customer {
  id: number
  name: string
  company: string | null
}

function YeniMaliyetContent() {
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(
    preselectedCustomerId ? parseInt(preselectedCustomerId) : 0
  )

  useEffect(() => {
    fetch('/api/customers')
      .then((response) => response.json())
      .then((data) => setCustomers(data))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-foreground">1. Müşteriyi seç</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Müşteri</Label>
            <Select
              value={selectedCustomerId > 0 ? String(selectedCustomerId) : null}
              onValueChange={(value: unknown) => setSelectedCustomerId(parseInt(String(value)))}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Müşteri seçin...">
                  {selectedCustomerId > 0 && customers.length > 0
                    ? (() => {
                        const customer = customers.find((item) => item.id === selectedCustomerId)
                        return customer ? `${customer.name}${customer.company ? ` (${customer.company})` : ''}` : 'Müşteri seçin...'
                      })()
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={String(customer.id)}>
                    {customer.name} {customer.company ? `(${customer.company})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {customers.length === 0 && (
            <div className="rounded-[var(--radius)] border border-dashed border-border bg-card/70 p-4 text-sm text-muted-foreground">
              Önce bir müşteri eklemelisiniz.
              <Button asChild variant="link" className="ml-1 h-auto p-0 text-blue-700 dark:text-blue-300">
                <Link href="/musteriler/yeni">Müşteri ekle</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCustomerId > 0 && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-foreground">2. Maliyet kalemlerini gir</CardTitle>
          </CardHeader>
          <CardContent>
            <CostForm customerId={selectedCustomerId} onSubmit={createCostCalculation} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function YeniMaliyetPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/maliyet">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">Maliyet listesine dön</span>
      </div>

      <PageHero
        eyebrow="Yeni Maliyet"
        title="Yeni Maliyet"
        description="Maliyet oluşturma"
        icon={<Calculator className="h-5 w-5" />}
        actions={
          <Button variant="outline" asChild>
            <Link href="/musteriler/yeni">
              <UserPlus className="mr-2 h-4 w-4" />
              Yeni Müşteri
            </Link>
          </Button>
        }
        stats={[
          { label: 'Adım', value: '2' },
          { label: 'Önce', value: 'Müşteri', tone: 'text-blue-700 dark:text-blue-300' },
          { label: 'Sonra', value: 'Kalemler', tone: 'text-foreground' },
        ]}
      />

      <Suspense fallback={<div className="text-muted-foreground">Yükleniyor...</div>}>
        <YeniMaliyetContent />
      </Suspense>
    </div>
  )
}
