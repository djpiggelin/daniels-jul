import { Reindeer } from '../components/Reindeer'
import { Stars } from '../components/Scenery'

export default function NotFound() {
  return (
    <div className="sky relative flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Stars count={60} />
      <Reindeer size={200} rudolf mode="gallop" />
      <h1 className="mt-6 text-5xl font-semibold">Hoppsan! 🎄</h1>
      <p className="mt-3 max-w-md text-lg text-snow/80">Rudolf letade överallt men hittade inte den här sidan. Den kanske ligger i tomtens säck?</p>
      <a href="/" className="btn btn-red mt-8">
        Tillbaka till byn
      </a>
    </div>
  )
}
