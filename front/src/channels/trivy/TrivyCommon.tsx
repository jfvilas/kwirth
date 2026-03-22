import { red } from '@mui/material/colors'
import { IconAlpine, IconDebian, IconUbuntu } from '../magnify/icons/Icons'

export type TReportType = 'vulnerabilityreports'|'configauditreports'|'sbomreports'|'exposedsecretreports'

export const getAvatarContent = (os:string) => {
    if (os.toLocaleLowerCase()==='alpine') return <IconAlpine size={'24'}/>
    if (os.toLocaleLowerCase()==='debian') return <IconDebian size={'24'}/>
    if (os.toLocaleLowerCase()==='ubuntu') return <IconUbuntu size={'24'}/>
    return <>{os.substring(0,1).toUpperCase()}</>
}
    
const assetAvatarColor = (os:string) => {
    if (!os) return red[500]
    const index = os.charCodeAt(0) - 65
    const hue = Math.round((index / 26) * 360)
    const saturation = 70
    const lightness = 50
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;        
}

export { assetAvatarColor }