;(() => {
  const baseURL = '/bsui/'
  const joinPath = (...args) => {
    let joined = [baseURL, ...args].join('/').trim()
    joined = joined.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
    return joined ? `/${joined}` : '/'
  }
  const supportedLangs = window.supportedLangs
  const cacheKey = 'preferred_lang'
  const defaultLang = 'en-US'
  // docs supported languages
  const langAlias = {
    en: 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
  }
  let userPreferredLang = localStorage.getItem(cacheKey) || navigator.language
  const language =
    langAlias[userPreferredLang] ||
    (supportedLangs.includes(userPreferredLang)
      ? userPreferredLang
      : defaultLang)
  localStorage.setItem(cacheKey, language)
  userPreferredLang = language
  console.log('location.pathname-1', location.pathname)
  if (!location.pathname.startsWith(joinPath(`/${userPreferredLang}`))) {
    const toPath = [`/${userPreferredLang}`]
      .concat(location.pathname.split('/').slice(2))
      .join('/')
    console.log('location.pathname-2', toPath)
    const _path =
      toPath.endsWith('.html') || toPath.endsWith('/')
        ? toPath
        : toPath.concat('/')
    console.log('location.pathname-3', _path)
    location.pathname = joinPath(_path)
  }
  // if (navigator && navigator.serviceWorker.controller) {
  //   navigator.serviceWorker.controller.postMessage({
  //     type: 'LANG',
  //     lang: userPreferredLang,
  //   })
  // }
})()
