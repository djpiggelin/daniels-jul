// The village is loaded once this year's content has been fetched (see src/data.ts in the repo root).
import('./main').catch((err) => {
  console.error(err)
  const go = document.getElementById('go')
  if (go) go.textContent = 'Tomten tappade bort byn 🎅 – ladda om sidan'
})
