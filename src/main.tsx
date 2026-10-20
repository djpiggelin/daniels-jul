// The app is loaded once this year's content has been fetched (see src/lib/content.ts).
import('./app').catch((err) => {
  console.error(err)
  document.getElementById('root')!.innerHTML =
    '<p style="padding:4rem 1rem;text-align:center;font-family:sans-serif;color:#f5ecd7">Tomten tappade bort innehållet 🎅 – ladda om sidan om en stund.</p>'
})
