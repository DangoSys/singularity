import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

document.documentElement.dataset.theme = 'light'
document.documentElement.dataset.paper = 'grid'

const root = document.getElementById('root')
if (root === null) throw new Error('map: #root missing')
createRoot(root).render(<App />)
