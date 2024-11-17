import { Box } from '@mui/material'
import { LogObject } from '../model/LogObject'
import { LogMessage, MetricsMessage, SignalMessage, SignalMessageLevelEnum, StreamMessage } from '@jfvilas/kwirth-common'
import { MetricsObject } from '../model/MetricsObject'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRef, useState } from 'react'

interface IProps {
  filter:string
  lastLineRef: React.MutableRefObject<null>
  logObject:LogObject
  metricsObject:MetricsObject
}
  
const TabContent: React.FC<any> = (props:IProps) => {
    const chartDataRef = useRef<any[]>([])
        
    const formatMessage = (message:LogMessage|null, index:number, color:number=0, ) => {
        console.log('msg')
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
        if (!props.metricsObject || !props.metricsObject.metrics || !props.metricsObject.values || props.metricsObject.values.length===0) return <></>
        if (false) {
            // text metrics
            return (<div><b>{`${props.metricsObject.namespace}/${props.metricsObject.pod}`}</b><br/><pre>
                { props.metricsObject.metrics.map ( (metricName, i) => {
                    return `${metricName}: ${props.metricsObject.values[i]}\n`
                })}
            </pre></div>)    
        }
        else {
            // // chart metrics
            // if (props.metricsObject.values && props.metricsObject.values.length>0) {
            //     // format date
            //     var x=new Date (props.metricsObject.timestamp)
            //     var label = `${x.getHours().toString().padStart(2,'0')}:${x.getMinutes().toString().padStart(2,'0')}:${x.getSeconds().toString().padStart(2,'0')}`

            //     // get delta
            //     var delta=0
            //     if (chartDataRef.current[chartDataRef.current.length-1]) delta = props.metricsObject.values[0]-chartDataRef.current[chartDataRef.current.length-1].value
            //     chartDataRef.current = [...chartDataRef.current, {time:label, value: props.metricsObject.values[0]} ]
            //     if (chartDataRef.current.length > 10) chartDataRef.current.shift()
            // }

            // return (
            //     <ResponsiveContainer width="100%" height={300}>
            //         <LineChart data={chartDataRef.current}>
            //             <CartesianGrid strokeDasharray="3 3" />
            //             <XAxis dataKey="time" fontSize={8} />
            //             <YAxis />
            //             <Tooltip />
            //             <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
            //         </LineChart>
            //     </ResponsiveContainer>
            // )

            var x=new Date (props.metricsObject.timestamp)
            var label = `${x.getHours().toString().padStart(2,'0')}:${x.getMinutes().toString().padStart(2,'0')}:${x.getSeconds().toString().padStart(2,'0')}`
            if (props.metricsObject.values && props.metricsObject.values.length===props.metricsObject.metrics.length) {
                chartDataRef.current = [...chartDataRef.current, {time:label, values: props.metricsObject.values} ]
                return props.metricsObject.metrics.map ((mname,index) => {
                    if (chartDataRef.current.length > 20) chartDataRef.current.shift()
                    var series=chartDataRef.current.map( s => {
                        return { name:mname, time:s.time, value:s.values[index] }
                    })
                    console.log(mname, series)
                    return (
                        <ResponsiveContainer width="95%" height={300} key={index}>
                            <LineChart data={series}>
                                <CartesianGrid strokeDasharray="3 3"/>
                                <XAxis dataKey="time" fontSize={8} />
                                <YAxis />
                                <Tooltip />
                                <Line name={mname} type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
                                <Legend/>
                            </LineChart>
                        </ResponsiveContainer>
                    )
                    return <></>
                })
            }
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