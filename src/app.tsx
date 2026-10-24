import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import { EmbeddedLayout } from './components/EmbeddedLayout'
import { EMBEDDED } from './lib/embed'
import { JULBORD } from './lib/village'
import Home from './pages/Home'
import EventPage from './pages/EventPage'
import Knytis from './pages/Knytis'
import Games from './pages/Games'
import GamePage from './pages/GamePage'
import NotFound from './pages/NotFound'
import Pepparkaksarkitekten from './pages/Pepparkaksarkitekten'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={EMBEDDED ? <EmbeddedLayout /> : <Layout />}>
          {/* in production / is the 3D village (jul3d/) – this only matters in npm run dev */}
          <Route index element={<Navigate to="/handelser" replace />} />
          <Route path="handelser" element={<Home />} />
          <Route path="event/:id" element={<EventPage />} />
          {/* (only for those invited to the julbord – everyone else gets the 404) */}
          {JULBORD && <Route path="knytis" element={<Knytis />} />}
          {JULBORD && <Route path="potluck" element={<Navigate to="/knytis" replace />} />}
          <Route path="spel" element={<Games />} />
          <Route path="spel/:game" element={<GamePage />} />
          <Route path="pepparkaksarkitekten" element={<Pepparkaksarkitekten />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
