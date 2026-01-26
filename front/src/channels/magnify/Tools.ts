import cronParser from 'cron-parser'

const reorderJsonYamlObject = (objetoJson: any): any => {
    try {
        const priorityOrder = ['apiVersion', 'kind', 'metadata', 'status', 'spec']
        const orderedObject: any = {}
        priorityOrder.forEach(key => {
            if (objetoJson && Object.prototype.hasOwnProperty.call(objetoJson, key)) orderedObject[key] = objetoJson[key]
        })
        Object.keys(objetoJson).forEach(key => {
            if (!priorityOrder.includes(key)) orderedObject[key] = objetoJson[key]
        })
        return orderedObject
    }
    catch (e) {
        console.error("Error al convertir JSON a YAML:", e);
        return {}
    }
}

function objectClone(obj: any) : any {
    return JSON.parse(JSON.stringify(obj))
}
function objectEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true

    if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) return false

    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    if (keys1.length !== keys2.length) return false

    for (const key of keys1) {
        if (!keys2.includes(key) || !objectEqual(obj1[key], obj2[key])) return false
    }
    return true
}

function convertBytesToSize(bytes: number, decimals: number = 2): string {
    // Si el valor no es un número válido o es 0, simplemente devuelve "0 Bytes"
    if (!Number.isFinite(bytes) || bytes === 0) {
        return '0 Bytes';
    }

    const k = 1024; // Base binaria (IEC)
    const dm = decimals < 0 ? 0 : decimals; // Asegura que los decimales no sean negativos

    // Prefijos de unidades binarias (IEC)
    const units = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

    // Calcula el índice de la unidad más grande que cabe en el número de bytes
    // Math.floor(Math.log(bytes) / Math.log(k))
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Si el resultado de i es 0, no dividimos, y si es mayor, dividimos por 1024^i
    const calculatedValue = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    // Retorna el valor calculado y la unidad correspondiente
    return calculatedValue + ' ' + units[i];
}        

function convertSizeToBytes(fileSizeString: string): number {
    // 1. Extraer el número y la unidad
    // La RegEx busca: (Número con decimales) + Espacios opcionales + (Unidad con prefijo opcional 'i' y 'B' opcional)
    const match = fileSizeString.trim().match(/^([\d.]+)\s*([KMGTPE]i?)B?$/i);

    if (!match) {
        console.error(`Formato de tamaño de archivo no reconocido: ${fileSizeString}`);
        return NaN;
    }

    const value: number = parseFloat(match[1]); // El valor numérico (ej: 1, 23, 1.5)
    
    // Obtener la unidad base, quitando 'B' si existe y convirtiendo a mayúsculas.
    // Ej: "Gi" -> "GI", "MiB" -> "MI"
    const unitUpper: string = match[2].toUpperCase().replace(/B$/, ''); 
    
    // 2. Determinar el multiplicador (Base 1024)
    let multiplier: number;
    const base = 1024;

    switch (unitUpper) {
        case 'EI': // Exbibyte
        case 'E':
            multiplier = base ** 6;
            break;
        case 'PI': // Pebibyte
        case 'P':
            multiplier = base ** 5;
            break;
        case 'TI': // Tebibyte
        case 'T':
            multiplier = base ** 4;
            break;
        case 'GI': // Gibibyte
        case 'G':
            multiplier = base ** 3;
            break;
        case 'MI': // Mebibyte
        case 'M':
            multiplier = base ** 2;
            break;
        case 'KI': // Kibibyte
        case 'K':
            multiplier = base ** 1;
            break;
        case '': // Si solo era un número sin unidad (asume Bytes)
        case 'B': // Bytes
            multiplier = 1;
            break;
        default:
            console.warn(`Unidad desconocida '${unitUpper}'. Asumiendo Bytes.`);
            multiplier = 1;
            break;
    }

    // 3. Calcular el resultado final
    return value * multiplier;
}

interface INextExecution {
    date: Date
    isoString: string
    timeLeft: {
        days: number
        hours: number
        minutes: number
        seconds: number
    }
    description: string
}

function getNextCronExecution(cronExpression: string): INextExecution|undefined {
    try {
        const interval = cronParser.parse(cronExpression)

        const nextDate = interval.next().toDate()
        const now = new Date()

        const diff = nextDate.getTime() - now.getTime()

        const seconds = Math.floor((diff / 1000) % 60)
        const minutes = Math.floor((diff / (1000 * 60)) % 60)
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        return {
            date: nextDate,
            isoString: nextDate.toISOString(),
            timeLeft: { days, hours, minutes, seconds },
            description: `${days}d ${hours}h ${minutes}m ${seconds}s`
        }
    }
    catch (err: any) {
        return undefined
    }
}

export { type INextExecution }
export { reorderJsonYamlObject, objectEqual, convertBytesToSize, convertSizeToBytes, getNextCronExecution, objectClone }