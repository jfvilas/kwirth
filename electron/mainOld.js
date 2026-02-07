const { VERSION } = require('./version')
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { fork } = require('child_process')
const portfinder = require('portfinder')

let serverProcess
let splash


async function createMainWindow() {
	console.log('Creating main window...')

	splash = new BrowserWindow({
		width: 450, 
		height: 300, 
		//transparent: true, 
		frame: false, 
		alwaysOnTop: true,
		center: true
	})
	splash.loadFile('./splash.html')

	const backendPath = path.join(__dirname, 'build', 'bundle.js')
	console.log('Backend path:', backendPath)

	portfinder.basePort = 3883
	const port = await portfinder.getPortPromise()
	console.log('Start KwirthDesktop on port', port)
	serverProcess = fork(backendPath, [], {
		cwd: './resources/app/build',
		env: { 
			NODE_ENV: 'production',
			PORT: String(port)
		}
	})
	console.log('Forked succcesfully')

	const win = new BrowserWindow({
		width: 1200,
		height: 800
	})

	win.once('ready-to-show', () => {
		splash.destroy()
		win.show()
	})	

	setTimeout((port) => {
		// improve
		console.log('loadurl')
		win.loadURL(`http://localhost:${port}/`)
	}, 15000, port)
}

console.log('Starting KwirthDesktop version', VERSION)

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
	callback(true)
})

app.on('window-all-closed', () => {
	if (serverProcess) serverProcess.kill()
	app.quit()
})

app.whenReady().then(createMainWindow)
