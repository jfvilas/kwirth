const { VERSION } = require('./version')
const { app, BrowserWindow,  BaseWindow, nativeImage, ImageView, ipcMain } = require('electron')
const path = require('path')
const { fork } = require('child_process')
const portfinder = require('portfinder')
const dns = require('node:dns').promises; // Usa la versión de promesas
const https = require('https');


ipcMain.handle('kube-api-available', async (event, rawUrl) => {
	console.log(rawUrl)
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(rawUrl);
            const opciones = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: '/version',
                method: 'GET',
                rejectUnauthorized: false,
                timeout: 5000 // Importante: que no se quede colgado si no responde
            }

			console.log('launch')
            const req = https.request(opciones, res => {
                // Si responde 200 o 401 (unauthorized), el servidor existe
				console.log('ok', res.statusCode)
                resolve(res.statusCode === 200 || res.statusCode === 401)
            })

            req.on('error', () => resolve(false))
            req.on('timeout', () => {
                req.destroy()
                resolve(false)
            })
            req.end()
        }
		catch (e) {
            resolve(false)
        }
    })
})

ipcMain.handle('validate-dns', async (event, hostname) => {
	console.log(hostname)
    try {
        let x = await dns.lookup(hostname)
		console.log(x)
        return true
    }
	catch (error) {
		console.log(error)
        return false
    }
})

async function createMainWindow() {
    console.log('Starting Kwirth Desktop...')

    // 1. Splash inmediato
    // let splash = new BrowserWindow({
    //     width: 450, 
    //     height: 300, 
    //     frame: false, 
    //     alwaysOnTop: true,
    //     center: true,
    //     backgroundColor: '#1A1A1A', // Pon el color de tu splash para evitar el flash blanco
    //     show: true // Que se vea ya
    // })
    // splash.loadFile('./splash.html')


	let splash = new BaseWindow({
        width: 450,
        height: 300,
        frame: false,
        //transparent: true,
        alwaysOnTop: true,
        center: true,
		resizable: false,
        show: false
    });

    // const view = new ImageView();
    // // Importante: Usa una ruta absoluta a una imagen (PNG/JPG)
    // view.image = path.join(__dirname, 'splash.png'); 
    
    // splash.contentView.addChildView(view);
    // view.setBounds({ x: 0, y: 0, width: 450, height: 300 });

    // // Esto aparecerá muchísimo más rápido que un loadFile()
    // splash.show();
	const splashPath = path.join(__dirname, 'splash.png');
	console.log("Image path:", splashPath); // Verifica esto en la consola

	const splashView = new ImageView()
	const splashImage = nativeImage.createFromPath(splashPath);

	// Verifica si la imagen realmente se cargó en memoria
	if (splashImage.isEmpty()) {
		console.error("Image could not be loaded from:", splashPath);
	}
	let resImg = splashImage.resize({
		width: 450,
		height: 300,
		quality: 'best'
	});
	splashView.setImage(resImg)
	splash.setContentView(splashView)

	splash.show()







	setTimeout( async () => {
		// 3. Crear ventana principal (pero oculta)
		const win = new BrowserWindow({
			width: 1200,
			height: 800,
			webPreferences: {
			preload: path.join(__dirname, 'preload.js')
			},
			show: false
		})


		// 2. Preparar puerto y lanzar BACKEND inmediatamente
		portfinder.basePort = 3883
		const port = await portfinder.getPortPromise()

		try {
			process.env.PORT = String(port);
			process.env.NODE_ENV = 'production';
			
			// Cambiamos el directorio y ejecutamos el bundle
			const backendDir = path.join(__dirname, 'build');
			process.chdir(backendDir)
			
			console.log(`Starting Kwirth backend at port: ${port} and dir ${backendDir}`);
			require('./build/bundle.js'); // Nota: Si ya hiciste chdir a /build, es './bundle.js'
		}
		catch (err) {
			console.error("Error loading backend:", err);
		}


		// 4. Iniciar el intento de conexión
		const loadApp = () => {
			win.loadURL(`http://localhost:${port}/`).then( () => {
				setTimeout(() => {if (splash && !splash.isDestroyed()) splash.destroy()}, 2000)				
			})
			.catch(() => {
				console.log('Waiting for backend to be ready...');
				setTimeout(loadApp, 200); 
			});
		};

		loadApp();

		win.once('ready-to-show', () => {
			console.log('Backend is ready and front is rendered. Success!')
			win.show()
			win.focus()
		})
	}, 5000)
}

app.whenReady().then(createMainWindow)
