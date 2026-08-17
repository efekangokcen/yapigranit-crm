import { test, expect } from '@playwright/test'

test.describe('Kimlik doğrulama', () => {
  test('korumalı sayfaya kimliksiz erişim login\'e yönlendirir', async ({ page }) => {
    await page.goto('/verimlilik')
    await expect(page).toHaveURL(/\/login/)
  })

  test('yanlış şifreyle giriş başarısız olur', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Kullanıcı Adı').fill('yonetici')
    await page.getByLabel('Şifre').fill('yanlis-sifre-123')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('var olmayan kullanıcı adıyla giriş başarısız olur', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Kullanıcı Adı').fill('boyle-bir-kullanici-yok')
    await page.getByLabel('Şifre').fill('herhangi123')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('doğru bilgilerle giriş başarılı olur ve dashboard açılır', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Kullanıcı Adı').fill('yonetici')
    await page.getByLabel('Şifre').fill('Yonetici123')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'Ana Sayfa' })).toBeVisible()
  })

  test('çıkış yaptıktan sonra korumalı sayfa tekrar login\'e yönlendirir', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Kullanıcı Adı').fill('yonetici')
    await page.getByLabel('Şifre').fill('Yonetici123')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await expect(page).toHaveURL('/')

    await page.getByTitle('Çıkış yap').click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/verimlilik')
    await expect(page).toHaveURL(/\/login/)
  })
})
