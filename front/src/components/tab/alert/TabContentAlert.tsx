import { Box } from '@mui/material'
import { AlertObject } from '../../../model/AlertObject'
import { IChannelObject } from '../../../model/ITabObject'

interface IProps {
    channelObject: IChannelObject
    lastLineRef: React.MutableRefObject<null>
}

const TabContentAlert: React.FC<IProps> = (props:IProps) => {
    const formatAlert = () => {
        let alertObject = props.channelObject.data as AlertObject
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
export { TabContentAlert }