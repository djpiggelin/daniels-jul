import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import EventPage from './pages/EventPage'
import Knytis from './pages/Knytis'
import Games from './pages/Games'
import GamePage from './pages/GamePage'
import NotFound from './pages/NotFound'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="event/:id" element={<EventPage />} />
          <Route path="knytis" element={<Knytis />} />
          <Route path="potluck" element={<Navigate to="/knytis" replace />} />
          <Route path="spel" element={<Games />} />
          <Route path="spel/:game" element={<GamePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
