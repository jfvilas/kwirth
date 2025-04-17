import { AlarmMessage, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { FiredAlert } from '../../model/AlertObject'

interface IProps {
    channelObject:any
    lastLineRef: React.MutableRefObject<null>
}

const TabContentAlert: React.FC<any> = (props:IProps) => {
    const formatAlert = () => {
        let firedAlerts = props.channelObject.data.firedAlerts as FiredAlert[]
        return (<pre>{
            firedAlerts.map(alert => {
                var color = 'black'
                if (alert.severity === 'warning') color='orange'
                if (alert.severity === 'error') color='red'
                let prefix = ''
                if (props.channelObject.view==='namespace') 
                    prefix = alert.namespace+'/'
                else 
                    prefix += alert.namespace+'/'+ alert.pod +'/'
                prefix = prefix + alert.container + ' '
                if (alert.namespace==='') prefix=''
                return <>{prefix}<span style={{color}}>{new Date(alert.timestamp).toISOString() + ' ' + alert.text} </span><br/></>
            })
        }</pre>)
    }

    return formatAlert()
}
export { TabContentAlert }