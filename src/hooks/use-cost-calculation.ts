'use client'

import { useReducer, useCallback } from 'react'
import {
  calcAtolyeEleman,
  calcAtolyeIsletme,
  calcSarfMalzeme,
  calcSantiyeMontaj,
  calcNakliye,
  calcExternalService,
  calcProduct,
  calcTotals,
} from '@/lib/calculations/cost-engine'
import { SERVICE_RATES, EXTERNAL_SERVICES_CATALOG } from '@/lib/constants'
import { getBoyut } from '@/lib/data/stone-list'
import { calculateStoneRequirement } from '@/lib/stone-requirement'

export interface ServiceState {
  serviceType: number
  workers: number
  days: number
  rate: number
  trips: number
  distanceKm: number
  vatMultiplier: number
  gercekMaliyet: number
  kdvliFiyat: number
}

export interface ExternalServiceState {
  id: string
  serviceKey: string
  jobType: string
  quantity: number
  unit: string
  unitPrice: number
  gercekMaliyet: number
  kdvliFiyat: number
}

export interface ProductState {
  id: string
  kategori: string
  marka: string
  renk: string
  boyut: number        // m²/plaka — katalogdan gelir ama düzenlenebilir
  toplamOlcu: number
  birim: string
  plakaAdet: number
  tasUcreti: number
  kalinlikMm: number
  fiyatFarki: number
  gercekMaliyet: number
  kdvliFiyat: number
}

export interface CostCalcState {
  customerId: number
  title: string
  invoiceRequested: boolean
  profitMultiplier: number
  services: ServiceState[]
  externalServices: ExternalServiceState[]
  products: ProductState[]
  genelToplam: number
  kdvYedirilmisToplam: number
  kdvliToplam: number
  karliToplam: number
  kdvYedirilmisKarliToplam: number
  kdvliKarliToplam: number
}

type Action =
  | { type: 'SET_FIELD'; field: 'title' | 'customerId'; value: string | number }
  | { type: 'SET_INVOICE'; value: boolean }
  | { type: 'SET_PROFIT_MULTIPLIER'; value: number }
  | { type: 'SET_SERVICE_FIELD'; serviceIndex: number; field: string; value: number }
  | { type: 'ADD_EXTERNAL_SERVICE'; serviceKey: string }
  | { type: 'REMOVE_EXTERNAL_SERVICE'; id: string }
  | { type: 'UPDATE_EXTERNAL_SERVICE'; id: string; field: string; value: string | number }
  | { type: 'ADD_PRODUCT' }
  | { type: 'REMOVE_PRODUCT'; id: string }
  | { type: 'UPDATE_PRODUCT'; id: string; field: string; value: string | number }
  | { type: 'LOAD_DATA'; data: CostCalcState }

function createInitialServices(): ServiceState[] {
  return [
    { serviceType: 1, workers: 1, days: 1, rate: SERVICE_RATES.atolyeEleman, trips: 0, distanceKm: 0, vatMultiplier: 1, gercekMaliyet: 3800, kdvliFiyat: 3800 },
    { serviceType: 2, workers: 1, days: 1, rate: SERVICE_RATES.atolyeIsletme, trips: 0, distanceKm: 0, vatMultiplier: 1, gercekMaliyet: 6350, kdvliFiyat: 6350 },
    { serviceType: 3, workers: 5, days: 1, rate: SERVICE_RATES.sarfMalzemePercent * 100, trips: 0, distanceKm: 0, vatMultiplier: 1.2, gercekMaliyet: 0, kdvliFiyat: 0 },
    { serviceType: 4, workers: 1, days: 1, rate: SERVICE_RATES.santiyeMontaj, trips: 0, distanceKm: 0, vatMultiplier: 1, gercekMaliyet: 3800, kdvliFiyat: 3800 },
    { serviceType: 5, workers: 0, days: 0, rate: SERVICE_RATES.nakliye, trips: 2, distanceKm: 40, vatMultiplier: 1.2, gercekMaliyet: 0, kdvliFiyat: 0 },
  ]
}

function normalizeServices(services: Partial<ServiceState>[] | undefined): ServiceState[] {
  const defaults = createInitialServices()
  const byType = new Map<number, Partial<ServiceState>>()

  ;(services ?? []).forEach((service, index) => {
    const serviceType = service.serviceType || index + 1
    byType.set(serviceType, service)
  })

  return defaults.map((defaultService) => {
    const incoming = byType.get(defaultService.serviceType)
    return {
      ...defaultService,
      ...incoming,
      serviceType: defaultService.serviceType,
      workers: incoming?.workers ?? defaultService.workers,
      days: incoming?.days ?? defaultService.days,
      rate: incoming?.rate ?? defaultService.rate,
      trips: incoming?.trips ?? defaultService.trips,
      distanceKm: incoming?.distanceKm ?? defaultService.distanceKm,
      vatMultiplier: incoming?.vatMultiplier ?? defaultService.vatMultiplier,
      gercekMaliyet: incoming?.gercekMaliyet ?? defaultService.gercekMaliyet,
      kdvliFiyat: incoming?.kdvliFiyat ?? defaultService.kdvliFiyat,
    }
  })
}

function createInitialProduct(): ProductState {
  return {
    id: crypto.randomUUID(),
    kategori: '',
    marka: '',
    renk: '',
    boyut: 0,
    toplamOlcu: 0,
    birim: 'm2',
    plakaAdet: 1,
    tasUcreti: 0,
    kalinlikMm: 2,
    fiyatFarki: 0,
    gercekMaliyet: 0,
    kdvliFiyat: 0,
  }
}

function recalculateAll(state: CostCalcState): CostCalcState {
  const services = normalizeServices(state.services)

  // Recalculate service 1: Atölye Eleman
  const s1 = calcAtolyeEleman(services[0].workers, services[0].days)
  services[0] = { ...services[0], gercekMaliyet: s1.gercekMaliyet, kdvliFiyat: s1.kdvliFiyat }

  // Service 2: Atölye İşletme (days SET_SERVICE_FIELD'da service 1 ile senkron tutulur)
  const s2 = calcAtolyeIsletme(services[1].workers, services[1].days, services[1].rate)
  services[1] = { ...services[1], gercekMaliyet: s2.gercekMaliyet, kdvliFiyat: s2.kdvliFiyat }

  // Service 4: Şantiye Montaj
  const s4 = calcSantiyeMontaj(services[3].workers, services[3].days)
  services[3] = { ...services[3], gercekMaliyet: s4.gercekMaliyet, kdvliFiyat: s4.kdvliFiyat }

  // Service 5: Nakliye
  const s5 = calcNakliye(services[4].trips, services[4].distanceKm)
  services[4] = { ...services[4], gercekMaliyet: s5.gercekMaliyet, kdvliFiyat: s5.kdvliFiyat }

  // Recalculate products first (needed for Sarf Malzeme)
  const products = state.products.map(p => {
    const result = calcProduct(p.tasUcreti, p.toplamOlcu, p.plakaAdet, p.fiyatFarki || 0)
    return { ...p, gercekMaliyet: result.gercekMaliyet, kdvliFiyat: result.kdvliFiyat }
  })

  // Service 3: Sarf Malzeme (depends on 1, 2, 4, 5 + product)
  const productCost = products.reduce((sum, p) => sum + p.gercekMaliyet, 0)
  const sarfPercent = services[2].rate || SERVICE_RATES.sarfMalzemePercent * 100
  const s3 = calcSarfMalzeme(
    services[0].gercekMaliyet,
    services[1].gercekMaliyet,
    services[3].gercekMaliyet,
    services[4].gercekMaliyet,
    productCost,
    sarfPercent,
    services[2].days || 1
  )
  services[2] = { ...services[2], workers: sarfPercent, rate: sarfPercent, gercekMaliyet: s3.gercekMaliyet, kdvliFiyat: s3.kdvliFiyat }

  // Recalculate external services
  const externalServices = state.externalServices.map(es => {
    const result = calcExternalService(es.quantity, es.unitPrice)
    return { ...es, gercekMaliyet: result.gercekMaliyet, kdvliFiyat: result.kdvliFiyat }
  })

  // Calculate totals
  const allItems = [
    ...services.map(s => ({ gercekMaliyet: s.gercekMaliyet, kdvliFiyat: s.kdvliFiyat })),
    ...externalServices.map(es => ({ gercekMaliyet: es.gercekMaliyet, kdvliFiyat: es.kdvliFiyat })),
    ...products.map(p => ({ gercekMaliyet: p.gercekMaliyet, kdvliFiyat: p.kdvliFiyat })),
  ]

  const totals = calcTotals(allItems, state.profitMultiplier)

  return {
    ...state,
    services,
    externalServices,
    products,
    ...totals,
  }
}

function reducer(state: CostCalcState, action: Action): CostCalcState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }

    case 'SET_INVOICE':
      return { ...state, invoiceRequested: action.value }

    case 'SET_PROFIT_MULTIPLIER':
      return recalculateAll({ ...state, profitMultiplier: action.value })

    case 'SET_SERVICE_FIELD': {
      const services = normalizeServices(state.services)
      services[action.serviceIndex] = {
        ...services[action.serviceIndex],
        [action.field]: action.value,
      }
      // Eleman Atölye (0) ve Atölye İşletme Maliyeti (1) aynı süre/mesafeyi paylaşır
      if (action.field === 'days' && (action.serviceIndex === 0 || action.serviceIndex === 1)) {
        const pairedIndex = action.serviceIndex === 0 ? 1 : 0
        services[pairedIndex] = { ...services[pairedIndex], days: action.value }
      }
      return recalculateAll({ ...state, services })
    }

    case 'ADD_EXTERNAL_SERVICE': {
      const catalogItem = EXTERNAL_SERVICES_CATALOG.find(c => c.key === action.serviceKey)
      const newService: ExternalServiceState = {
        id: crypto.randomUUID(),
        serviceKey: action.serviceKey,
        jobType: catalogItem?.name ?? '',
        quantity: 1,
        unit: catalogItem?.unit ?? 'adet',
        unitPrice: catalogItem?.price ?? 0,
        gercekMaliyet: catalogItem?.price ?? 0,
        kdvliFiyat: catalogItem?.price ?? 0,
      }
      return recalculateAll({
        ...state,
        externalServices: [...state.externalServices, newService],
      })
    }

    case 'REMOVE_EXTERNAL_SERVICE':
      return recalculateAll({
        ...state,
        externalServices: state.externalServices.filter(es => es.id !== action.id),
      })

    case 'UPDATE_EXTERNAL_SERVICE': {
      const externalServices = state.externalServices.map(es =>
        es.id === action.id ? { ...es, [action.field]: action.value } : es
      )
      return recalculateAll({ ...state, externalServices })
    }

    case 'ADD_PRODUCT':
      return recalculateAll({
        ...state,
        products: [...state.products, createInitialProduct()],
      })

    case 'REMOVE_PRODUCT':
      // Always keep at least one product
      if (state.products.length <= 1) return state
      return recalculateAll({
        ...state,
        products: state.products.filter(p => p.id !== action.id),
      })

    case 'UPDATE_PRODUCT': {
      const products = state.products.map(p => {
        if (p.id !== action.id) return p
        let updated = { ...p, [action.field]: action.value }

        // Cascading resets
        if (action.field === 'kategori') {
          updated = { ...updated, marka: '', renk: '', boyut: 0, toplamOlcu: 0 }
        } else if (action.field === 'marka') {
          updated = { ...updated, renk: '', boyut: 0, toplamOlcu: 0 }
        }

        // Renk seçilince katalogdan boyutu otomatik doldur, toplamOlcu hesapla
        if (action.field === 'renk') {
          const katalogBoyut = getBoyut(updated.kategori, updated.marka, updated.renk)
          updated.boyut = katalogBoyut
          updated.toplamOlcu = katalogBoyut * updated.plakaAdet
        }

        // Boyut manuel değiştirilince toplamOlcu'yu güncelle
        if (action.field === 'boyut') {
          updated.toplamOlcu = (action.value as number) * updated.plakaAdet
        }

        // Plaka adedi artık toplam ihtiyaçtan otomatik türetilir.
        if (action.field === 'plakaAdet') {
          updated.toplamOlcu = updated.boyut * updated.plakaAdet
        }

        if (action.field === 'toplamOlcu') {
          updated.plakaAdet = calculateStoneRequirement(
            Number(action.value),
            updated.boyut
          ).fullSlabCount
        }

        return updated
      })
      return recalculateAll({ ...state, products })
    }

    case 'LOAD_DATA': {
      // Ensure all products have IDs (loaded from DB may not have them)
      const data = {
        ...action.data,
        services: normalizeServices(action.data.services).map((service) => (
          service.serviceType === 3 && service.rate === 0
            ? { ...service, workers: SERVICE_RATES.sarfMalzemePercent * 100, rate: SERVICE_RATES.sarfMalzemePercent * 100, days: service.days || 1 }
            : service
        )),
        products: (action.data.products ?? []).map(p => {
          const ps = p as ProductState
          // Eski kayıtlarda boyut yoksa katalogdan türet
          const boyut = ps.boyut ?? getBoyut(ps.kategori, ps.marka, ps.renk)
          return {
            ...ps,
            id: ps.id || crypto.randomUUID(),
            boyut,
            kalinlikMm: ps.kalinlikMm ?? 2,
            fiyatFarki: ps.fiyatFarki ?? 0,
          }
        }),
      }
      // Ensure at least one product
      if (data.products.length === 0) {
        data.products = [createInitialProduct()]
      }
      return recalculateAll(data)
    }

    default:
      return state
  }
}

function createInitialState(customerId = 0): CostCalcState {
  const state: CostCalcState = {
    customerId,
    title: '',
    invoiceRequested: false,
    profitMultiplier: SERVICE_RATES.defaultProfitMultiplier,
    services: createInitialServices(),
    externalServices: [],
    products: [createInitialProduct()],
    genelToplam: 0,
    kdvYedirilmisToplam: 0,
    kdvliToplam: 0,
    karliToplam: 0,
    kdvYedirilmisKarliToplam: 0,
    kdvliKarliToplam: 0,
  }
  return recalculateAll(state)
}

export function useCostCalculation(customerId = 0) {
  const [state, dispatch] = useReducer(reducer, customerId, createInitialState)

  const setField = useCallback((field: 'title' | 'customerId', value: string | number) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }, [])

  const setInvoice = useCallback((value: boolean) => {
    dispatch({ type: 'SET_INVOICE', value })
  }, [])

  const setProfitMultiplier = useCallback((value: number) => {
    dispatch({ type: 'SET_PROFIT_MULTIPLIER', value })
  }, [])

  const setServiceField = useCallback((serviceIndex: number, field: string, value: number) => {
    dispatch({ type: 'SET_SERVICE_FIELD', serviceIndex, field, value })
  }, [])

  const addExternalService = useCallback((serviceKey: string) => {
    dispatch({ type: 'ADD_EXTERNAL_SERVICE', serviceKey })
  }, [])

  const removeExternalService = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_EXTERNAL_SERVICE', id })
  }, [])

  const updateExternalService = useCallback((id: string, field: string, value: string | number) => {
    dispatch({ type: 'UPDATE_EXTERNAL_SERVICE', id, field, value })
  }, [])

  const addProduct = useCallback(() => {
    dispatch({ type: 'ADD_PRODUCT' })
  }, [])

  const removeProduct = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_PRODUCT', id })
  }, [])

  const updateProduct = useCallback((id: string, field: string, value: string | number) => {
    dispatch({ type: 'UPDATE_PRODUCT', id, field, value })
  }, [])

  const loadData = useCallback((data: CostCalcState) => {
    dispatch({ type: 'LOAD_DATA', data })
  }, [])

  return {
    state,
    setField,
    setInvoice,
    setProfitMultiplier,
    setServiceField,
    addExternalService,
    removeExternalService,
    updateExternalService,
    addProduct,
    removeProduct,
    updateProduct,
    loadData,
  }
}
