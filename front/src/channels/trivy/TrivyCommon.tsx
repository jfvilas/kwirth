import { green, red, yellow } from '@mui/material/colors'
import { ITrivyInstanceConfig } from './TrivyConfig'
import { IconAlpine, IconDebian, IconUbuntu } from '../magnify/icons/Icons'
import { IAsset } from './TrivyData'

export type TReportType = 'vulnerabilityreports'|'configauditreports'
export const getAvatarContent = (os:string) => {
    if (os.toLocaleLowerCase()==='alpine') return <IconAlpine size={'24'}/>
    if (os.toLocaleLowerCase()==='debian') return <IconDebian size={'24'}/>
    if (os.toLocaleLowerCase()==='ubuntu') return <IconUbuntu size={'24'}/>
    return <>{os.substring(0,1).toUpperCase()}</>
}
    
const assetScore = (asset:IAsset, trivyInstanceConfig:ITrivyInstanceConfig, type:TReportType) => {
    let maxScore =
        (trivyInstanceConfig.maxCritical>=0? trivyInstanceConfig.maxCritical*4:0) +
        (trivyInstanceConfig.maxHigh>=0? trivyInstanceConfig.maxHigh*4:0) +
        (trivyInstanceConfig.maxMedium>=0? trivyInstanceConfig.maxMedium*4:0) +
        (trivyInstanceConfig.maxLow>=0? trivyInstanceConfig.maxLow*4:0)

    let asssumm = type==='vulnerabilityreports'? asset.vulnerabilityreports.report?.summary : asset.configauditreports.report?.summary
    if (asssumm) {
        let score = (trivyInstanceConfig.maxCritical>=0? asssumm.criticalCount*4 : 0) + (trivyInstanceConfig.maxHigh>=0? asssumm.highCount*4 : 0) + (trivyInstanceConfig.maxMedium>=0? asssumm.mediumCount*4 : 0) + (trivyInstanceConfig.maxLow>=0? asssumm.lowCount*4 : 0)
        let value = (1.0 - (score / maxScore)) * 100.0
        return value
    }
    return 0
}

const assetScoreColor = (asset:IAsset, trivyInstanceConfig:ITrivyInstanceConfig, type:TReportType) => {
    let score = assetScore(asset, trivyInstanceConfig, type)
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