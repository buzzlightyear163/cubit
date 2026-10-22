import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import '@fontsource-variable/geist/index.css'
import '@fontsource-variable/geist-mono/index.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/components.css'
import './styles/mine.css'
import './styles/pages.css'
import { Shell } from './layouts/Shell'
import Mine from './pages/Mine'
import Rewards from './pages/Rewards'
import Vault from './pages/Vault'
import Ledger from './pages/Ledger'
import Miners from './pages/Miners'
import Protocol from './pages/Protocol'
import NotFound from './pages/NotFound'
import { startNetwork } from './sim/network'
import './wallet/wallet'

startNetwork()

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Mine /> },
      { path: 'rewards', element: <Rewards /> },
      { path: 'vault', element: <Vault /> },
      { path: 'ledger', element: <Ledger /> },
      { path: 'miners', element: <Miners /> },
      { path: 'protocol', element: <Protocol /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
