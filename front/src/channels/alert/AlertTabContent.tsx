import { Box } from '@mui/material'
import { AlertObject } from './AlertObject'
import { IContentProps } from '../IChannel'

const AlertTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const formatAlert = () => {
        let alertObject = props.channelObject.uiData as AlertObject
        return (<pre>{
            alertObject.firedAlerts.map(alert => {
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
                return <>{prefix}<span style={{color}}>{new Date(alert.timestamp).toISOString() + ' ' + alert.text}</span><br/></>
            })
        }</pre>)
    }

    return (
        <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
            { formatAlert() }
        </Box>
    )
}
export { AlertTabContent }