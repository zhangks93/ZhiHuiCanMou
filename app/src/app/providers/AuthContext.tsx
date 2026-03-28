import { createContext } from 'react'

export type AuthUser = { name: string; avatarUrl?: string }

export type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
