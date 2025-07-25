import { useState } from 'react'
import { IMetricsObject, MetricsEventSeverityEnum } from './MetricsObject'
import { Area, AreaChart, Line, LineChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, LabelList } from 'recharts'
import { Alert, Box, Button, Snackbar, Stack, Typography } from '@mui/material'
import { IContentProps } from '../IChannel'
import { IMetricsUiConfig } from './MetricsConfig'

interface ISample {
    timestamp:string
    value:number
}

const MetricsTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let metricsObject:IMetricsObject = props.channelObject.uiData
    let metricsUiConfig:IMetricsUiConfig = props.channelObject.uiConfig

    const [refresh, setRefresh] = useState(false)
    const [refreshTabContent, setRefreshTabContent] = useState(0)
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

    const mergeSeries = (names:string[], series:ISample[][]) => {
        // names is an array of names of series
        // series is an array of arrays of samples
        // example:
        //   [default, ingress-nginx]
        //   [  [ {timestamp:'dad',value:1}, {timestamp:'dad',value:2} ], [ {timestamp:'dad',value:4}, {timestamp:'dad',value:0} ]  ]
        if (!names || names.length===0) return []
        let resultSeries = []

        for (var i=0; i<series[0].length; i++) {
            var item: { [key: string]: string|number } = {}
            for (var j=0; j<series.length; j++ ) {
                if (series[j][i]) {
                    item['timestamp'] = series[0][i].timestamp
                    item[names[j]] = series[j][i].value
                }
            }
            resultSeries.push(item)
        }

        // result is:
        // [ 
        //   {timestamp: '09:16:27', default: 0.21, ingress-nginx: 0.93}
        //   {timestamp: '09:16:32', default: 0.5, ingress-nginx: 0.04}
        // ]
        return resultSeries
    }

    const addChart = (metric:string, names:string[], series:ISample[][], colour:string) => {
        let result
        let mergedSeries = mergeSeries(names, series)

        const renderLabel = (data:any) => {
            var values:any[] = series.map (s => s[data.index])
            var total:number = values.reduce((acc,value) => acc+value.value, 0)
            return <text x={data.x + data.width/3.5} y={data.y-10}>{total.toPrecision(3).replace(/0+$/, '').replace(/\.+$/, '')}</text>
        }
        let  height=300

        switch (metricsUiConfig.chart) {
            case 'value':
                height=40+series.length*80
                result = (
                    <Stack direction={'row'}>
                        {
                            <Typography textAlign={'center'} alignSelf={'center'} width={'100%'}>
                                { series.map( (serie,index) => {
                                    return (<>
                                        <Typography textAlign={'center'} alignSelf={'center'} width={'100%'} fontSize={48} color={series.length===1?colour:colours[index]}>
                                            {serie[serie.length-1].value}
                                        </Typography>
                                        <Typography textAlign={'center'} alignSelf={'center'} width={'100%'} fontSize={12} color={series.length===1?colour:colours[index]}>
                                            {names[index]}
                                        </Typography>
                                    </>)
                                })}
                            </Typography>
                        }
                    </Stack>

                )
                break
            case 'line':
                result = (
                    <LineChart data={mergedSeries}>
                        <CartesianGrid strokeDasharray='3 3'/>
                        <XAxis dataKey='timestamp' fontSize={8}/>
                        <YAxis />
                        <Tooltip />
                        <Legend/>
                        { series.map ((_serie,index) => <Line key={index} name={names[index]} type='monotone' dataKey={names[index]} stroke={series.length===1?colour:colours[index]} activeDot={{ r: 8 }} />) }
                    </LineChart>
                )
                break
            case 'area':
                result = (
                    <AreaChart data={mergedSeries}>
                        <defs>
                            {
                                series.map( (_serie,index) => {
                                    return (
                                        <linearGradient key={index} id={`color${series.length===1?colour:colours[index]}`} x1='0' y1='0' x2='0' y2='1'>
                                            <stop offset='7%' stopColor={series.length===1?colour:colours[index]} stopOpacity={0.8}/>
                                            <stop offset='93%' stopColor={series.length===1?colour:colours[index]} stopOpacity={0}/>
                                        </linearGradient>
                                    )
                                })
                            }
                        </defs>
                        <CartesianGrid strokeDasharray='3 3'/>
                        <XAxis dataKey='timestamp' fontSize={8}/>
                        <YAxis />
                        <Tooltip />
                        <Legend/>
                        { series.map ((_serie,index) => 
                            <Area key={index} name={names[index]} type='monotone' {...(metricsUiConfig.stack? {stackId:'1'}:{})} dataKey={names[index]} stroke={series.length===1?colour:colours[index]} fill={`url(#color${series.length===1?colour:colours[index]})`}/> )
                        }
                    </AreaChart>
                )
                break
            case 'bar':
                result = (
                    <BarChart data={mergedSeries}>
                        <CartesianGrid strokeDasharray='3 3'/>
                        <XAxis dataKey='timestamp' fontSize={8}/>
                        <YAxis />
                        <Tooltip/>
                        <Legend/>
                        { series.map ((serie,index) =>
                            <Bar name={names[index]} {...(metricsUiConfig.stack? {stackId:'1'}:{})} dataKey={names[index]} stroke={series.length===1?colour:colours[index]} fill={series.length===1?colour:colours[index]}>
                                { index === series.length-1 && series.length > 1 ? <LabelList dataKey={names[index]} position='insideTop' content={renderLabel}/> : null }
                            </Bar>
                        )}
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
                result = <Alert severity='error'>Unsupported chart type '{metricsUiConfig.chart}'</Alert>
                break
        }
        return (
            <Stack direction={'column'} alignItems={'center'} width={'100%'} sx={{mb:'24px'}}>
                <Typography>{metric}</Typography>
                <ResponsiveContainer width='100%' height={height} key={metric+JSON.stringify(names)}>
                    {result}
                </ResponsiveContainer>                        
            </Stack>
        )
    }

    const handleClose = (reason:string, dataMetrics:IMetricsObject, event:{ severity:MetricsEventSeverityEnum, text:string }) => {
        dataMetrics.events = dataMetrics.events.filter(e => e.severity!==event.severity && e.text!==event.text)
        setRefreshTabContent(Math.random())
    }

    const formatMetricsError = (dataMetrics:IMetricsObject) => {
        if (!dataMetrics.events || dataMetrics.events.length === 0) return <></>

        return <>
            {dataMetrics.events.map((event,index) => { 
                return (
                    <Snackbar open={true} autoHideDuration={3000} onClose={(e, r) => handleClose(r, dataMetrics, event)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                        <Alert severity={event.severity} action={<Button onClick={() => { dataMetrics.events.splice(index,1); setRefresh(!refresh)} }>Dismiss</Button>} sx={{alignItems:'center'}}>{event.text}</Alert>
                    </Snackbar>
                )
            })}
        </>
    }

    const formatMetrics = () => {
        if (!metricsUiConfig.metricsList || metricsObject.assetMetricsValues.length === 0) {
            return <>{formatMetricsError(metricsObject)}</>
        }

        let data:Map<string, Map<string, ISample[]>> = new Map()
        for (let assetMetricsValues of metricsObject.assetMetricsValues) {
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

        let allCharts = []
        if (metricsUiConfig.merge) {
            var assetNames=Array.from(data.keys())
            var firstAsset=assetNames[0]
            var allMetrics:string[] = Array.from(new Set(data.get(firstAsset)!.keys()))

            for (let metric of allMetrics) {
                var series = assetNames.map(assetName => {
                    return data.get(assetName)!.get(metric)!
                })
                allCharts.push(<>{addChart(metric, assetNames, series, '')}</>)
            }

            let rows = []
            for (let i = 0; i < allCharts.length; i += metricsUiConfig.width) {
                rows.push(allCharts.slice(i, i + metricsUiConfig.width))
            }
            return (<>
                {formatMetricsError(metricsObject)}
                {rows.map((row, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {row}
                    </div>
                ))}
            </>)
        }
        else {
            let allCharts = Array.from(data.keys()!).map( (asset, index)  =>  {
                return Array.from(data.get(asset)?.keys()!).map ( metric => {
                    var series = data.get(asset)?.get(metric)!
                    return (<>{addChart(metric, [asset], [series], colours[index])}</>)
                })
            })

            // convert allCharts (an array of charts) into a series of rows of charts
            let rows = []
            for (var resultAsset of allCharts) {
                for (let i = 0; i < resultAsset.length; i += metricsUiConfig.width) {
                    rows.push(resultAsset.slice(i, i + metricsUiConfig.width))
                }
            }
            return (<>
                {formatMetricsError(metricsObject)}
                {rows.map((row, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {row}
                    </div>
                ))}
            </>)
        }
    }

    return (
        <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }} data-refresh={refreshTabContent}>
            {formatMetrics()}
        </Box>
    )

}
export { MetricsTabContent }