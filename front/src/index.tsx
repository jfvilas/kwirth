import ReactDOM from 'react-dom/client'
import App from './App'
import { SnackbarProvider } from 'notistack'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

var rootPath = (window.__PUBLIC_PATH__ || '/').trim().toLowerCase()
if (rootPath.endsWith('/')) rootPath=rootPath.substring(0,rootPath.length-1)
if (rootPath.endsWith('/front')) rootPath=rootPath.substring(0,rootPath.length-6)

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(
  //<React.StrictMode>
    <BrowserRouter basename={rootPath}>
      <SnackbarProvider>
        <App backend={'backend'} onBackendChange={(b:string) => console.log(b)}/>
      </SnackbarProvider>
    </BrowserRouter>
  //</React.StrictMode>
);
