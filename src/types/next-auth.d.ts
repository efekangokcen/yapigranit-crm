import 'next-auth'

declare module 'next-auth' {
  interface User {
    username?: string
    role?: string
  }
  interface Session {
    user: {
      id: string
      name?: string | null
      username: string
      role: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    role: string
  }
}
