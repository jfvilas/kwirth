import { Box, Stack, Typography } from '@mui/material'
import { LogObject } from '../model/LogObject'
import { LogMessage, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { Area, AreaChart, Line, LineChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Label, Cell } from 'recharts'
import { FiredAlert } from '../model/AlertObject'
import { MetricsObject } from '../model/MetricsObject'
import { ReactJSXElement } from '@emotion/react/types/jsx-namespace'

interface IProps {
    channel: string
    lastLineRef: React.MutableRefObject<null>
    logObject: LogObject
    channelObject: any
}
  
const TabContent: React.FC<any> = (props:IProps) => {
    const colours = [
        "#6e5bb8", // morado oscuro
        "#4a9076", // verde oscuro
        "#b56c52", // naranja oscuro
        "#7f6b97", // color lavanda oscuro
        "#b0528f", // rosa oscuro
        "#b0b052", // amarillo oscuro
        "#b05252", // rojo oscuro
        "#5285b0", // azul oscuro
        "#a38ad6", // morado pastel
        "#89c1a0", // verde pastel
        "#e4a28a", // naranja pastel
        "#b09dbd", // lavanda pastel
        "#e2a4c6", // rosa pastel
        "#c5c89e", // amarillo pastel
        "#e2a4a4", // rojo pastel
        "#90b7e2", // azul pastel
        "#f8d5e1", // rosa claro pastel
        "#b2d7f0", // azul muy claro pastel
        "#f7e1b5", // amarillo muy claro pastel
        "#d0f0c0", // verde muy claro pastel
        "#f5b0a1", // coral pastel
        "#d8a7db", // lavanda muy claro pastel
        "#f4c2c2", // rosa suave pastel
        "#e6c7b9", // marrón claro pastel
        "#f0e2b6", // crema pastel
        "#a7c7e7", // azul pálido pastel
        "#f5e6a5", // amarillo pálido pastel
        "#e3c8f5", // lilas pastel
        "#d0c4e8", // lila pálido pastel
        "#b8d8b8", // verde claro pastel
        "#d2ebfa", // azul muy claro pastel
        "#f1c1d2"  // rosa bebé pastel
    ]
    
    const formatLogLine = (message:LogMessage|null, index:number, color:number=0, ) => {
        if (!message) return null

        if (message.type==='data') {
            var txt=message.text
            if (props.channelObject.view==='namespace') {
                var preLength=message.pod!.length+1
                var preBlanks=' '.repeat(preLength)
                txt=txt.replaceAll('\n','\n'+preBlanks).trimEnd()
            }

            var prefix = ''
            if (props.channelObject.view==='pod') prefix = message.container || ''
            if (props.channelObject.view==='container' && props.channelObject.container.includes(',')) prefix = message.container || ''
            if (props.channelObject.view==='namespace') {
                return <><span style={{color:"blue"}}>{message.pod+' '}</span>{txt}</>
            }
            else
                return <><span style={{color:"blue"}}>{prefix+' '}</span>{txt}</>
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

    const formatLog = () => {
        var messages = props.channelObject.data.messages as LogMessage[]
        return <pre>
            {messages.map((message, index) => {
                if (index===props.channelObject.data.messages.length-1)
                    return <><div key={index} ref={props.lastLineRef} >{formatLogLine(message, index, 0)}</div><div key={-1} >&nbsp;</div></>
                else 
                    return <div key={index}>{formatLogLine(message, index, 0)}</div>
            })}
        </pre>
    }

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

    const mergeSeries = (names:string[], series:any[]) => {
        if (!names || names.length===0) return []
        var resultSeries:any[] = []

        for (var i=0; i<series[0].length; i++) {
            var item: { [key: string]: any } = {}
            for (var j=0; j<series.length; j++ ) {
                item['timestamp'] =  series[0][i].timestamp
                item[names[j]] = series[j][i].value
            }
            resultSeries.push(item)
        }
        return resultSeries
    }

    const addChart = (dataMetrics: MetricsObject, metric:string, names:string[], series:any[]) => {
        var result: ReactJSXElement
        var mergedSeries = mergeSeries(names, series)
        switch (dataMetrics.type) {
            case 'line':
                result = (
                    <LineChart data={mergedSeries}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="timestamp" fontSize={8}/>
                        <YAxis />
                        <Tooltip />
                        <Legend/>
                        { series.map ((serie,index) => <Line name={names[index]} type="monotone" dataKey={names[index]} stroke={colours[index]} activeDot={{ r: 8 }} />) }
                    </LineChart>
                )
                break
            case 'area':
                result = (
                    <AreaChart data={mergedSeries}>
                        <defs>
                            {
                                series.map( (s,index) => {
                                    var color = '#' + (Math.round(Math.random()*128)).toString(16) + (Math.round(Math.random()*128)).toString(16) + (Math.round(Math.random()*128)).toString(16)
                                    return (
                                        <linearGradient key={index} id={`color${names[index]}`} x1='0' y1='0' x2='0' y2='1'>
                                            <stop offset='7%' stopColor={colours[index]} stopOpacity={0.8}/>
                                            <stop offset='93%' stopColor={colours[index]} stopOpacity={0}/>
                                        </linearGradient>
                                    )
                                })
                            }
                        </defs>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="timestamp" fontSize={8}/>
                        <YAxis />
                        <Tooltip />
                        <Legend/>
                        { series.map ((serie,index) => <Area name={names[index]} type="monotone" {...(dataMetrics.stack? {stackId:"1"}:{})} dataKey={names[index]} stroke={colours[index]} fill={`url(#color${names[index]})`} />) }
                    </AreaChart>
                )
                break
            case 'bar':
                result = (
                    <BarChart data={mergedSeries}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="timestamp" fontSize={8}/>
                        <YAxis />
                        <Tooltip />
                        <Legend/>
                        { series.map ((serie,index) => <Bar name={names[index]} {...(dataMetrics.stack? {stackId:"1"}:{})} dataKey={names[index]} stroke={colours[index]} fill={colours[index]} />) }
                    </BarChart>
                )
                break
            case 'pie':
                var ns:any[] = names.map( (name,index) => {
                    return { name, value:(series[index] as any[]).reduce((ac,val) => ac+val.value,0)}
                })
                result = (
                    <PieChart>
                        <Tooltip />
                        <Legend layout='vertical' align='right' verticalAlign='middle'/>
                        <Pie key={'asd'} data={ns} dataKey={'value'} fill={colours[0]} innerRadius={0} outerRadius={90}>
                            {ns.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colours[index % colours.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                )
                break
            default:
                result = (
                    <>{'unsupported chart type'}</>
                )
                break
        }
        return (
            <Stack direction={'column'} alignItems={'center'} width={'100%'}>
                <Typography>{metric}</Typography>
                <ResponsiveContainer width="100%" height={300} key={metric+JSON.stringify(names)}>
                    {result}
                </ResponsiveContainer>                        
            </Stack>
        )
    }

    const formatMetrics = () => {
        let dataMetrics = props.channelObject.data as MetricsObject
        if (!dataMetrics.metrics || dataMetrics.assetMetricsValues.length === 0) return <></>

        let data:Map<string, Map<string, { timestamp:string, value:number}[]>> = new Map()
        for (var assetMetricsValues of dataMetrics.assetMetricsValues) {
            var ts = new Date(assetMetricsValues.timestamp)
            var timestamp = ts.getHours().toString().padStart(2,'0')+':'+ts.getMinutes().toString().padStart(2,'0')+':'+ts.getSeconds().toString().padStart(2,'0')
            for (var i=0;i<assetMetricsValues.assets.length;i++) {
                var assetName=assetMetricsValues.assets[i].assetName
                for (var metrics of assetMetricsValues.assets[i].values) {
                    if (!data.has(assetName)) data.set(assetName, new Map())
                    if (!data.get(assetName)?.has(metrics.metricName)) data.get(assetName)?.set(metrics.metricName,[])
                    data.get(assetName)?.get(metrics.metricName)?.push({timestamp, value:metrics.metricValue})
                }
            }   
        }

        let allCharts:any[] = []
        if (dataMetrics.merge) {
            var assetNames=Array.from(data.keys())
            var firstAsset=assetNames[0]
            var allMetrics:string[] = Array.from(new Set(data.get(firstAsset)!.keys()))
            //var allMetrics:string[] = [...new Set(data.get(firstAsset)!.keys())] +++

            for (var metric of allMetrics) {
                var series = assetNames.map(an => {
                    return data.get(an)!.get(metric)
                })
                allCharts.push(<>{addChart(dataMetrics, metric, assetNames, series)}</>)
            }

            let rows = []
            for (let i = 0; i < allCharts.length; i += dataMetrics.width) {
                rows.push(allCharts.slice(i, i + dataMetrics.width))
            }
            return (<>
                {rows.map((row, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {row}
                    </div>
                ))}
            </>)
        }
        else {
            let allCharts = Array.from(data.keys()!).map( asset =>  {
                return Array.from(data.get(asset)?.keys()!).map ( metric => {
                    var serie:any=data.get(asset)?.get(metric)!
                    return (<>{addChart(dataMetrics, metric, [asset], [serie])}</>)
                })
            })

            // convert allResults (a list of charts) into a series of rows of charts
            let rows = []
            for (var resultAsset of allCharts) {
                for (let i = 0; i < resultAsset.length; i += dataMetrics.width) {
                    rows.push(resultAsset.slice(i, i + dataMetrics.width))
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
            {/* show log lines */}
            {props.channelObject &&  props.channel === 'log' && props.channelObject.data && props.channelObject.data.messages && formatLog() }

            {/* show alerts */}
            { props.channelObject &&  props.channel==='alert' && props.channelObject.data && props.channelObject.data.firedAlerts && formatAlert() }

            {/* show metrics */}
            { props.channelObject &&  props.channel==='metrics' && props.channelObject.data.assetMetricsValues && formatMetrics() }
        </Box>
        </>
    )
}
export { TabContent }