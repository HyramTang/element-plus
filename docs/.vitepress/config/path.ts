export const baseURL = process.env.NODE_ENV === 'production' ? '/bsui/' : ''

export const joinPath = (...args) => {
  let joined = [baseURL, ...args].join('/').trim()
  joined = joined.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
  return joined ? `/${joined}` : '/'
}
