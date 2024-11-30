import { Box } from '@mui/material'
import { LogObject } from '../model/LogObject'
import { LogMessage, MetricsMessage, SignalMessage, SignalMessageLevelEnum, StreamMessage } from '@jfvilas/kwirth-common'
import { MetricsObject } from '../model/MetricsObject'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

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
        //+++ actually, is rendered according to user events, but should not if no new data is received
        if (!props.metricsObject || !props.metricsObject.metrics || !props.metricsObject.values || props.metricsObject.values.length===0) return <></>
        if (props.metricsObject.values) {

            var charts = props.metricsObject.metrics.map ((mname,index) => {
                var serie=[]
                for (var i=0;i<props.metricsObject.values.length;i++) {
                    var x=new Date (props.metricsObject.timestamps[i])
                    var label = `${x.getHours().toString().padStart(2,'0')}:${x.getMinutes().toString().padStart(2,'0')}:${x.getSeconds().toString().padStart(2,'0')}`
                    //serie.push({ time:label, value:props.metricsObject.values[i][index]+Math.random()*100})
                    serie.push({ time:label, value:props.metricsObject.values[i][index]})
                }
                return (
                    <ResponsiveContainer width="100%" height={300} key={index}>
                        <LineChart data={serie}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="time" fontSize={8} />
                            <YAxis />
                            <Tooltip />
                            <Line name={mname} type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
                            <Legend/>
                        </LineChart>
                    </ResponsiveContainer>
                )
            })

            let filas = []
            for (let i = 0; i < charts.length; i += props.metricsObject.width) {
                filas.push(charts.slice(i, i + props.metricsObject.width))
            }

            return (
                <>
                    {filas.map((fila, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {fila}
                    </div>
                    ))}
                </>
                )
        }
    }

    return (
        <>
        <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
            {/* show metrics */}
            { props.metricsObject && props.metricsObject.values && formatMetrics() }

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