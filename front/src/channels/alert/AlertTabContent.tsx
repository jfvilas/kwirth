import { Box } from '@mui/material'
import { IAlertData } from './AlertData'
import { IContentProps } from '../IChannel'
import { useEffect, useRef, useState } from 'react'

const AlertTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const alertBoxRef = useRef<HTMLDivElement | null>(null)
    const [alertBoxTop, setAlertBoxTop] = useState(0)

    useEffect(() => {
        if (alertBoxRef.current) setAlertBoxTop(alertBoxRef.current.getBoundingClientRect().top)
    })

    const formatAlert = () => {
        let alertObject:IAlertData = props.channelObject.data
        return (<pre>{
            alertObject.firedAlerts.map((alert,index) => {
                var color = 'black'
                if (alert.severity === 'warning') color='orange'
                if (alert.severity === 'error') color='red'
                let prefix = ''
                if (props.channelObject.view==='namespace') 
                    prefix = alert.namespace+'/'
                else 
                    prefix = alert.namespace+'/'+ alert.pod +'/'
                prefix += alert.container + ' '
                if (alert.namespace === '') prefix=''
                return <span key={index}>{prefix}<span style={{color}}>{new Date(alert.timestamp).toISOString() + ' ' + alert.text}</span><br/></span>
            })
        }</pre>)
    }

    return (
        <Box ref={alertBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${alertBoxTop}px - 25px)`}}>
            { formatAlert() }
        </Box>
    )
}
export { AlertTabContent }