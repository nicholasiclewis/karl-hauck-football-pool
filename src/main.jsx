import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applySeasonalTheme } from './lib/seasonalTheme.js'

applySeasonalTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
