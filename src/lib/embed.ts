// The 3D village opens some pages (Pepparkaksarkitekten) in an iframe of its own – then they
// drop the site chrome and tell the village when to close them.

export const EMBEDDED = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true // a cross-origin parent – still embedded
  }
})()

/** Ask the village around this page to close it. */
// '*': the message carries nothing, and the village checks it comes from its own iframe
export const closeEmbed = () => window.parent.postMessage({ type: 'jul:stang' }, '*')
