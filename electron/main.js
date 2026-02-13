const { VERSION } = require('./version')
const { app, BrowserWindow,  BaseWindow, nativeImage, ImageView, ipcMain } = require('electron')
const path = require('path')
const portfinder = require('portfinder')
const https = require('https');


// ipcMain.handle('kube-api-available', async (event, rawUrl) => {
// 	//console.log('test', rawUrl)
//     return new Promise((resolve) => {
//         try {
//             const parsedUrl = new URL(rawUrl);
//             const options = {
//                 hostname: parsedUrl.hostname,
//                 port: parsedUrl.port || 443,
//                 path: '/version',
//                 method: 'GET',
//                 rejectUnauthorized: false,
//                 timeout: 2000
//             }

//             const req = https.request(options, res => {
// 				console.log('toresolove', options)
//                 let gotResponse = (res.statusCode === 200 || res.statusCode === 401)
// 				console.log(options.hostname, options.port)
// 				if (gotResponse) {
// 					let x = JSON.parse(res)
// 					console.log(x)
// 					resolve(true)
// 				}
// 				else {
// 					resolve(false)
// 				}
//             })

//             req.on('error', () => resolve(false))
//             req.on('timeout', () => {
//                 req.destroy()
//                 resolve(false)
//             })
//             req.end()
//         }
// 		catch (err) {
// 			console.log('error', err)
//             resolve(false)
//         }
//     })
// })

ipcMain.handle('kube-api-available', async (event, rawUrl) => {
    return new Promise((resolve) => {
        let timer;
        let req;

        try {
            const parsedUrl = new URL(rawUrl);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: '/version', 
                method: 'GET',
                rejectUnauthorized: false,
            };

            timer = setTimeout(() => {
                if (req) req.destroy();
                resolve(false);
            }, 2000);

            req = https.request(options, (res) => {
                let rawData = '';

                // 1. Vamos acumulando los trozos de texto que llegan
                res.on('data', (chunk) => { rawData += chunk; });

                // 2. Cuando termina la respuesta, intentamos parsear
                res.on('end', () => {
                    clearTimeout(timer);
                    
                    // Si es 401 o 403, el API existe pero no tenemos permiso (es un "true" técnico)
                    // if (res.statusCode === 401 || res.statusCode === 403) {
                    //     return resolve(true);
                    // }

                    if (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 403) {
                        try {
                            const json = JSON.parse(rawData);
							console.log(json)
                            // Verificamos si tiene campos típicos de la respuesta /version de K8s
                            //const isK8s = !!(json.major || json.gitVersion);
                            resolve(json.kind==='Status');
                        } catch (e) {
                            // Si responde 200 pero no es JSON, no es un Kube API válido
                            resolve(false);
                        }
                    } else {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => {
                clearTimeout(timer);
                resolve(false);
            });

            req.end();
        } catch (err) {
            if (timer) clearTimeout(timer);
            resolve(false);
        }
    });
});

async function createMainWindow() {
    console.log('Starting Kwirth Desktop...')

	let splash = new BaseWindow({
        width: 450,
        height: 300,
        frame: false,
        alwaysOnTop: true,
        center: true,
		resizable: false,
        show: false
    })

	const splashPath = path.join(__dirname, 'splash.png')
	const splashView = new ImageView()
	const splashImage = nativeImage.createFromPath(splashPath)
	let resizedImage = splashImage.resize({ width: 450, height: 300, quality: 'best' })
	splashView.setImage(resizedImage)
	splash.setContentView(splashView)

	splash.show()

	setTimeout( async () => {
		const win = new BrowserWindow({
			width: 1200,
			height: 800,
			webPreferences: {
				preload: path.join(__dirname, 'preload.js')
			},
			show: false
		})

		portfinder.basePort = 3883
		const port = await portfinder.getPortPromise()
		try {
			process.env.PORT = String(port)
			process.env.NODE_ENV = 'production'
			// +++ process.env.ROOTPATH = ''  
			
			const backendDir = path.join(__dirname, 'build');
			process.chdir(backendDir)
			
			console.log(`Starting Kwirth Desktop backend at port: '${port}' and home path '${backendDir}'`)
			require('./build/bundle.js')
		}
		catch (err) {
			console.error("Error loading backend:", err);
		}

		const loadApp = () => {
			win.loadURL(`http://localhost:${port}/`).then( () => {
				setTimeout(() => {if (splash && !splash.isDestroyed()) splash.destroy()}, 2000)				
			})
			.catch(() => {
				console.log('Waiting for backend to be ready...')
				setTimeout(loadApp, 100)
			})
		}

		loadApp()

		win.once('ready-to-show', () => {
			console.log('Backend is ready and front is rendered. Success!')
			win.show()
			win.focus()
		})
	}, 5000)
}

console.log('Kwirth Desktop version:', VERSION)
app.whenReady().then(createMainWindow)
