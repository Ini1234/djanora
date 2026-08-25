import axios from 'axios'

export async function signOutToHome() {
  try {
    await axios.post('/api/auth/sign-out')
  } finally {
    window.location.assign(new URL('/', window.location.origin).href)
  }
}
