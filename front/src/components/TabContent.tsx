import { Box } from '@mui/material'
import { LogObject } from '../model/LogObject'
import { LogMessage, MetricsMessage, SignalMessage, SignalMessageLevelEnum, StreamMessage } from '@jfvilas/kwirth-common'
import { MetricsObject } from '../model/MetricsObject'

interface IProps {
  filter:string
  lastLineRef: React.MutableRefObject<null>
  logObject:LogObject
  metricsObject:MetricsObject
}
  
const TabContent: React.FC<any> = (props:IProps) => {

    const formatMessage = (message:LogMessage|null, index:number, color:number=0, ) => {
        if (!message) return null

        if (message.type==='data') {
            var txt=message.text
            if (props.logObject.view==='cluster') {
                var fill=message.namespace!.length+1+message.pod!.length+1
                var f=' '.repeat(fill)
                txt=txt.replaceAll('\n','\n'+f).trimEnd()
            }
            else if (props.logObject.view==='namespace') {
                var fill=message.pod!.length+1
                var f=' '.repeat(fill)
                txt=txt.replaceAll('\n','\n'+f).trimEnd()
            }

            if (props.logObject.view==='cluster') {
                return <><span style={{color:"red"}}>{message.namespace}</span><span style={{color:"blue"}}>{' '+message.pod+' '}</span>{txt}</>
            }
            else if (props.logObject.view==='namespace') {
                return <><span style={{color:"blue"}}>{message.pod+' '}</span>{txt}</>
            }
            else
                return txt
        }
        else if (message.type==='signal') {
            if ((message as any).action) {
                return <span style={{color:"black"}}><b>{"***** "+message.text+" *****"}</b></span>
            }
            else {
                var sgn=message as SignalMessage
                switch (sgn.level) {
                    case SignalMessageLevelEnum.INFO:
                        return <span style={{color:"blue"}}><b>{`***** ${sgn.text} *****`}</b></span>
                    case SignalMessageLevelEnum.WARNING:
                        return <span style={{color:"orange"}}><b>{`***** ${sgn.text} *****`}</b></span>
                    case SignalMessageLevelEnum.ERROR:
                        return <span style={{color:"red"}}><b>{`***** ${sgn.text} *****`}</b></span>
                }
            }
        }
        else  {
            return <span>{message.text}</span>
        }
    }

    const formatMetrics = () => {
        if (!props.metricsObject || !props.metricsObject.metrics) return <></>
        return (<div><b>{`${props.metricsObject.namespace}/${props.metricsObject.pod}`}</b><br/><pre>
            { props.metricsObject.metrics.map ( (metricName, i) => {
                return `${metricName}: ${props.metricsObject.values[i]}\n`
            })}
        </pre></div>)
    }

    return (
        <>
        <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
            {/* show metrics */}
            { props.metricsObject && formatMetrics() }

            {/* show log lines */}
            <pre>
                {props.logObject && props.logObject.messages.map(m => {
                    return m.text.includes(props.filter)? m : null}).map((message, index) => {
                        if (index===props.logObject.messages.length-1)
                            return <><div key={index} ref={props.lastLineRef} >{formatMessage(message, index, 0)}</div><div key={-1} >&nbsp;</div></>
                        else 
                            return <div key={index}>{formatMessage(message, index, 0)}</div>
                })}
            </pre>
        </Box>
        </>
    );
}
export default TabContent