import { registerMessages } from '@nineh2303/mf-core'
import type { RemoteSetup } from '@nineh2303/mf-core'

const messages = {
  vi: {
    title: 'Đăng nhập',
    username: 'Tên đăng nhập',
    password: 'Mật khẩu',
    submit: 'Đăng nhập',
    error: 'Sai tên đăng nhập hoặc mật khẩu',
  },
  en: {
    title: 'Sign in',
    username: 'Username',
    password: 'Password',
    submit: 'Sign in',
    error: 'Invalid username or password',
  },
}

const setup: RemoteSetup = (ctx) => {
  registerMessages(ctx.i18n, 'auth', messages)
}

export default setup
