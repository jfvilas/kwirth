import ReactDOM from 'react-dom/client'
import App from './App'
import { SnackbarProvider } from 'notistack'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

console.log(`Environment: ${process.env.NODE_ENV}`)
var rootPath = (window.__PUBLIC_PATH__ || '/').trim().toLowerCase()
if (rootPath.endsWith('/')) rootPath=rootPath.substring(0,rootPath.length-1)
if (rootPath.endsWith('/front')) rootPath=rootPath.substring(0,rootPath.length-6)
console.log(`Root path to use: ${rootPath}`)

var backend='http://localhost:3883'
console.log(`process.env.NODE_ENV: ${process.env.NODE_ENV}`)
if ( process.env.NODE_ENV==='production') backend=window.location.protocol+'//'+window.location.host
backend=backend+rootPath
console.log(`API backend to use: ${backend}`)

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(
  //<React.StrictMode>
    <BrowserRouter basename={rootPath}>
      <SnackbarProvider>
        <App />
      </SnackbarProvider>
    </BrowserRouter>
  //</React.StrictMode>
);
