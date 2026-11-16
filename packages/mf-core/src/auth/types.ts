export interface AuthUser {
  id: string
  name: string
  permissions: string[]
  [k: string]: unknown
}
