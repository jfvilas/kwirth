import { Box } from '@mui/material'
import { LogObject } from '../model/LogObject'
import { LogMessage, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
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
                var preLength=message.pod!.length+1
                var preBlanks=' '.repeat(preLength)
                txt=txt.replaceAll('\n','\n'+preBlanks).trimEnd()
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
        if (!props.metricsObject || !props.metricsObject.metrics || !props.metricsObject.assetMetricsValues || props.metricsObject.assetMetricsValues.length===0) return <></>
        if (props.metricsObject.assetMetricsValues) {
            var data:Map<string, Map<string, { timestamp:string, value:number}[]>> = new Map()
            for (var assetMetricsValues of props.metricsObject.assetMetricsValues) {                
                var ts = new Date(assetMetricsValues.timestamp)
                var timestamp = ts.getHours()+':'+ts.getMinutes()+':'+ts.getSeconds()
                for (var i=0;i<assetMetricsValues.assets.length;i++) {
                    var assetName=assetMetricsValues.assets[i].assetName
                    for (var metrics of assetMetricsValues.assets[i].values) {
                        if (!data.has(assetName)) data.set(assetName, new Map())
                        if (!data.get(assetName)?.has(metrics.metricName)) data.get(assetName)?.set(metrics.metricName,[])
                        data.get(assetName)?.get(metrics.metricName)?.push({timestamp, value:metrics.metricValue})
                    }
                }   
            }

            var allResults = Array.from(data.keys()!).map( asset =>  {
                return Array.from(data.get(asset)?.keys()!).map ( metric => {
                    var serie:any=data.get(asset)?.get(metric)!
                    return (
                        <ResponsiveContainer width="100%" height={300} key={asset+metric}>
                        <LineChart data={serie}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="timestamp" fontSize={8} />
                            <YAxis />
                            <Tooltip />
                            <Line name={asset+' / '+metric} type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
                            <Legend/>
                        </LineChart>
                    </ResponsiveContainer>                        
                    )

                })
            })

            let rows = []
            for (var resultAsset of allResults) {
                for (let i = 0; i < resultAsset.length; i += props.metricsObject.width) {
                    rows.push(resultAsset.slice(i, i + props.metricsObject.width))
                }
            }

            return (<>
                {rows.map((row, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {row}
                    </div>
                ))}
            </>)
        }
    }

    return (
        <>
        <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
            {/* show metrics */}
            { props.metricsObject && props.metricsObject.assetMetricsValues && formatMetrics() }

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