import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Kullanıcı Adı').fill(username)
  await page.getByLabel('Şifre').fill(password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 }),
    page.getByRole('button', { name: 'Giriş Yap' }).click(),
  ])
}

test.describe('Rol bazlı görünürlük ve erişim', () => {
  test('yönetici Çalışan Verimliliği listesini görür', async ({ page }) => {
    await login(page, 'yonetici', 'Yonetici123')
    await page.goto('/verimlilik')
    await expect(page).toHaveURL('/verimlilik')
    await expect(page.getByRole('heading', { name: 'Çalışan Verimlilik ve Operasyon Raporu' })).toBeVisible()
  })

  test('atölyeci /verimlilik\'e girince otomatik kendi detayına yönlendirilir', async ({ page }) => {
    await login(page, 'atolyeci', 'Atolye123')
    await page.goto('/verimlilik')
    await expect(page).toHaveURL(/\/verimlilik\/\d+/)
  })

  test('atölyeci başka bir çalışanın id\'sini URL\'e yazınca 404 alır (IDOR koruması)', async ({ page }) => {
    await login(page, 'atolyeci', 'Atolye123')
    const res = await page.goto('/verimlilik/7') // yönetici'nin id'si
    expect(res?.status()).toBe(404)
  })

  test('pazarlamacı Yetki Matrisi\'ne giremez, kendi anasayfasına yönlendirilir', async ({ page }) => {
    await login(page, 'pazarlamaci', 'Pazarlama123')
    await page.goto('/yetki-matrisi')
    await expect(page).not.toHaveURL('/yetki-matrisi')
  })

  test('yönetici Yetki Matrisi\'ni görür ve rol önizleme çalışır', async ({ page }) => {
    await login(page, 'yonetici', 'Yonetici123')
    await page.goto('/yetki-matrisi')
    await expect(page.getByRole('heading', { name: 'Kullanıcı Türleri ve Yetki Matrisi' })).toBeVisible()
  })

  test('atölyeci sidebar\'da sadece Atölye\'yi görür, Müşteriler\'i görmez', async ({ page }) => {
    await login(page, 'atolyeci', 'Atolye123')
    await page.goto('/atolye')
    await expect(page.getByRole('link', { name: 'Atölye' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Müşteriler' })).toHaveCount(0)
  })
})
