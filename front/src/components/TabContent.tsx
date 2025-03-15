import { Box, Stack, Typography } from '@mui/material'
import { LogObject } from '../model/LogObject'
import { LogMessage, MetricsMessage, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { Area, AreaChart, Line, LineChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Label, Cell } from 'recharts'
import { FiredAlert } from '../model/AlertObject'

//import { MetricsObject } from '../model/MetricsObject'
//import { AlarmObject } from '../model/AlarmObject'

interface IProps {
    channel: string
    // filter: string
    lastLineRef: React.MutableRefObject<null>
    logObject: LogObject
    //metricsObject: MetricsObject
    //alarmObject: AlarmObject
    channelObject: any
    objectMerge:boolean
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
        "#5285b0"  // azul oscuro
      ];

    // const formatLog = (message:LogMessage|null, index:number, color:number=0, ) => {
    //     if (!message) return null

    //     if (message.type==='data') {
    //         var txt=message.text
    //         if (props.logObject.view==='cluster') {
    //             var fill=message.namespace!.length+1+message.pod!.length+1
    //             var f=' '.repeat(fill)
    //             txt=txt.replaceAll('\n','\n'+f).trimEnd()
    //         }
    //         else if (props.logObject.view==='namespace') {
    //             var preLength=message.pod!.length+1
    //             var preBlanks=' '.repeat(preLength)
    //             txt=txt.replaceAll('\n','\n'+preBlanks).trimEnd()
    //         }

    //         if (props.logObject.view==='cluster') {
    //             return <><span style={{color:"red"}}>{message.namespace}</span><span style={{color:"blue"}}>{' '+message.pod+' '}</span>{txt}</>
    //         }
    //         else if (props.logObject.view==='namespace') {
    //             return <><span style={{color:"blue"}}>{message.pod+' '}</span>{txt}</>
    //         }
    //         else
    //             return txt
    //     }
    //     else if (message.type==='signal') {
    //         if ((message as any).action) {
    //             return <span style={{color:"black"}}><b>{"***** "+message.text+" *****"}</b></span>
    //         }
    //         else {
    //             var sgn=message as SignalMessage
    //             switch (sgn.level) {
    //                 case SignalMessageLevelEnum.INFO:
    //                     return <span style={{color:"blue"}}><b>{`***** ${sgn.text} *****`}</b></span>
    //                 case SignalMessageLevelEnum.WARNING:
    //                     return <span style={{color:"orange"}}><b>{`***** ${sgn.text} *****`}</b></span>
    //                 case SignalMessageLevelEnum.ERROR:
    //                     return <span style={{color:"red"}}><b>{`***** ${sgn.text} *****`}</b></span>
    //             }
    //         }
    //     }
    //     else  {
    //         return <span>{message.text}</span>
    //     }
    // }

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
        var messages = props.channelObject.messages as LogMessage[]
        return <pre>
            {messages.map((message, index) => {
                if (index===props.channelObject.messages.length-1)
                    return <><div key={index} ref={props.lastLineRef} >{formatLogLine(message, index, 0)}</div><div key={-1} >&nbsp;</div></>
                else 
                    return <div key={index}>{formatLogLine(message, index, 0)}</div>
            })}
        </pre>
    }

    // const formatAlarm = () => {
    //     return (<pre>
    //         {
    //             props.alarmObject.firedAlarms.map(f => {
    //                 var color = 'black'
    //                 if (f.severity === AlarmSeverityEnum.WARNING) color='orange'
    //                 if (f.severity === AlarmSeverityEnum.ERROR) color='red'
    //                 let prefix = ''
    //                 if (props.alarmObject.view==='namespace') 
    //                     prefix = f.namespace+'/'
    //                 else 
    //                     prefix += f.namespace+'/'+ f.pod +'/'
    //                 return <>{prefix + f.container + ' '}<span style={{color}}> {new Date(f.timestamp).toISOString() + ' ' + f.text} </span><br/></>
    //             })
    //         }
    //     </pre>)
    // }

    const formatAlert = () => {
        let firedAlerts = props.channelObject.firedAlerts as FiredAlert[]
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

    // const formatMetrics = () => {
    //     if (!props.metricsObject || !props.metricsObject.metrics || !props.metricsObject.assetMetricsValues || props.metricsObject.assetMetricsValues.length===0) return <></>
    //     if (props.metricsObject.assetMetricsValues) {
    //         var data:Map<string, Map<string, { timestamp:string, value:number}[]>> = new Map()
    //         for (var assetMetricsValues of props.metricsObject.assetMetricsValues) {                
    //             var ts = new Date(assetMetricsValues.timestamp)
    //             var timestamp = ts.getHours()+':'+ts.getMinutes()+':'+ts.getSeconds()
    //             for (var i=0;i<assetMetricsValues.assets.length;i++) {
    //                 var assetName=assetMetricsValues.assets[i].assetName
    //                 for (var metrics of assetMetricsValues.assets[i].values) {
    //                     if (!data.has(assetName)) data.set(assetName, new Map())
    //                     if (!data.get(assetName)?.has(metrics.metricName)) data.get(assetName)?.set(metrics.metricName,[])
    //                     data.get(assetName)?.get(metrics.metricName)?.push({timestamp, value:metrics.metricValue})
    //                 }
    //             }   
    //         }

    //         var allResults = Array.from(data.keys()!).map( asset =>  {
    //             return Array.from(data.get(asset)?.keys()!).map ( metric => {
    //                 var serie:any=data.get(asset)?.get(metric)!
    //                 return (
    //                     <ResponsiveContainer width="100%" height={300} key={asset+metric}>
    //                     <LineChart data={serie}>
    //                         <CartesianGrid strokeDasharray="3 3"/>
    //                         <XAxis dataKey="timestamp" fontSize={8} />
    //                         <YAxis />
    //                         <Tooltip />
    //                         <Line name={asset+' / '+metric} type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
    //                         <Legend/>
    //                     </LineChart>
    //                 </ResponsiveContainer>                        
    //                 )

    //             })
    //         })

    //         let rows = []
    //         for (var resultAsset of allResults) {
    //             for (let i = 0; i < resultAsset.length; i += props.metricsObject.width) {
    //                 rows.push(resultAsset.slice(i, i + props.metricsObject.width))
    //             }
    //         }

    //         return (<>
    //             {rows.map((row, index) => (
    //                 <div key={index} style={{ display: 'flex', justifyContent: 'space-around' }}>
    //                     {row}
    //                 </div>
    //             ))}
    //         </>)
    //     }
    // }

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

    const addChart = (metric:string, names:string[], series:any[]) => {
        var mergedSeries = mergeSeries(names, series)
        switch (props.channelObject.data.type) {
            case 'line':
                return (
                    <LineChart data={mergedSeries}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="timestamp" fontSize={8}>
                            <Label value={metric} offset={0} position="insideBottom" />
                        </XAxis>
                        <YAxis />
                        <Tooltip />
                        <Legend/>
                        {
                            series.map ((serie,index) => <Line name={names[index]} type="monotone" dataKey={names[index]} stroke={colours[index]} activeDot={{ r: 8 }} />)
                        }

                    </LineChart>
                )
            case 'area':
                return (
                    <AreaChart data={mergedSeries}>
                        <defs>
                            {
                                series.map( (s,index) => {
                                    var color = '#' + (Math.round(Math.random()*128)).toString(16) + (Math.round(Math.random()*128)).toString(16) + (Math.round(Math.random()*128)).toString(16)
                                    return (
                                        <linearGradient id={`color${names[index]}`} x1='0' y1='0' x2='0' y2='1'>
                                            <stop offset='7%' stopColor={colours[index]} stopOpacity={0.8}/>
                                            <stop offset='93%' stopColor={colours[index]} stopOpacity={0}/>
                                        </linearGradient>
                                    )
                                })
                            }
                        </defs>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="timestamp" fontSize={8} >
                            <Label value={metric} offset={0} position="insideBottom" />
                        </XAxis>
                        <YAxis />
                        <Tooltip />
                        <Legend/>
                        {
                            series.map ((serie,index) => <Area name={names[index]} type="monotone" dataKey={names[index]} fill={`url(#color${names[index]})`} />)
                        }
                    </AreaChart>
                )
            case 'bar':
                return (
                    <BarChart data={mergedSeries}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="timestamp" fontSize={8}>
                            <Label value={metric} offset={0} position="insideBottom" />
                        </XAxis>
                        <YAxis />
                        <Tooltip />
                        <Legend/>
                        {
                            series.map ((serie,index) => <Bar name={names[index]} dataKey={names[index]} fill={colours[index]} />)
                        }
                    </BarChart>
                )
            case 'pie':
                var ns:any[] = names.map( (name,index) => {
                    return { name, value:(series[index] as any[]).reduce((ac,val) => ac+val.value,0)}
                })
                return (
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
            default:
                return <>{'unsupported chart type'}</>
        }
    }

    const formatMetrics = () => {
        if (!props.channelObject.metrics || props.channelObject.assetMetricsValues.length === 0) return <></>

        let data:Map<string, Map<string, { timestamp:string, value:number}[]>> = new Map()
        for (var assetMetricsValues of props.channelObject.assetMetricsValues) {
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
        if (props.channelObject.data.merge) {
            var assetNames=Array.from(data.keys())
            var firstAsset=assetNames[0]
            var allMetrics:string[] = Array.from( new Set(data.get(firstAsset)!.keys()))

            for (var metric of allMetrics) {
                var series = assetNames.map(an => {
                    return data.get(an)!.get(metric)
                })

                allCharts.push(
                    <Stack direction={'column'} alignItems={'center'} width={'100%'}>
                        <Typography>{metric}</Typography>
                        <ResponsiveContainer width="100%" height={300} key={metric+JSON.stringify(assetNames)}>
                            {addChart(metric, assetNames, series)}
                        </ResponsiveContainer>                        
                    </Stack>
                )
            }

            let rows = []
            props.channelObject.width = 2
            for (let i = 0; i < allCharts.length; i += props.channelObject.width) {
                rows.push(allCharts.slice(i, i + props.channelObject.width))
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
                    return (
                        <ResponsiveContainer width="100%" height={300} key={asset+metric}>
                            {addChart(metric, [asset], [serie])}
                        </ResponsiveContainer>                        
                    )

                })
            })

            // convert allResults (a list of charts) into a series of rows of charts
            let rows = []
            for (var resultAsset of allCharts) {
                for (let i = 0; i < resultAsset.length; i += props.channelObject.width) {
                    rows.push(resultAsset.slice(i, i + props.channelObject.width))
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
            {/* { props.metricsObject && props.metricsObject.assetMetricsValues && formatMetrics() } */}
            { props.channelObject &&  props.channel==='metrics' && props.channelObject.assetMetricsValues && formatMetrics() }

            {/* show alarms */}
            {/* { props.alarmObject && props.alarmObject.firedAlarms && formatAlarm() } */}

            {/* show alerts */}
            { props.channelObject &&  props.channel==='alert' && props.channelObject.firedAlerts && formatAlert() }

            {/* show log lines */}
            {props.channelObject &&  props.channel==='log' && props.channelObject.messages && formatLog() }

        </Box>
        </>
    );
}
export default TabContent