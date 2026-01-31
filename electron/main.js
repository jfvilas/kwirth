const { app, BrowserWindow } = require('electron')
const path = require('path')
const { fork } = require('child_process')
const portfinder = require('portfinder')

let serverProcess

async function createWindow() {
	console.log('Creating window...')

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

	setTimeout((port) => {
		console.log('loadurl')
		win.loadURL(`http://localhost:${port}/`)
	}, 15000, port)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
	if (serverProcess) serverProcess.kill()
	app.quit()
})