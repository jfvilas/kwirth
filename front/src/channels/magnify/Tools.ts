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


export { reorderJsonYamlObject, objectEqual }