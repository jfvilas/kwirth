import { green, red, yellow } from '@mui/material/colors'
import { ITrivyInstanceConfig } from './TrivyConfig'

const assetScore = (asset:any, trivyInstanceConfig:ITrivyInstanceConfig) => {
    let maxScore = (trivyInstanceConfig.maxCritical>=0? trivyInstanceConfig.maxCritical*4:0) +
        (trivyInstanceConfig.maxHigh>=0? trivyInstanceConfig.maxHigh*4:0) +
        (trivyInstanceConfig.maxMedium>=0? trivyInstanceConfig.maxMedium*4:0) +
        (trivyInstanceConfig.maxLow>=0? trivyInstanceConfig.maxLow*4:0)

    let asssumm = asset.report.summary
    let score = (trivyInstanceConfig.maxCritical>=0? asssumm.criticalCount*4 : 0) + (trivyInstanceConfig.maxHigh>=0? asssumm.highCount*4 : 0) + (trivyInstanceConfig.maxMedium>=0? asssumm.mediumCount*4 : 0) + (trivyInstanceConfig.maxLow>=0? asssumm.lowCount*4 : 0)
    let value = (1.0 - (score / maxScore)) * 100.0
    return value
}

const assetScoreColor = (asset:any, trivyInstanceConfig:ITrivyInstanceConfig) => {
    let score = assetScore(asset, trivyInstanceConfig)
    if (score>=50) return green[400]
    if (score>=0) return yellow[700]
    return red[500]
}

const assetAvatarColor = (os:string) => {
    if (!os) return red[500]
    const index = os.charCodeAt(0) - 65
    const hue = Math.round((index / 26) * 360)
    const saturation = 70
    const lightness = 50
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;        
}


export { assetScore, assetScoreColor, assetAvatarColor }