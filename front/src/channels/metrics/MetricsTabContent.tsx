import { useEffect, useRef, useState } from 'react'
import { IMetricsData, MetricsEventSeverityEnum } from './MetricsData'
import { Alert, Box, Button, Snackbar } from '@mui/material'
import { IContentProps } from '../IChannel'
import { IMetricsConfig, METRICSCOLOURS } from './MetricsConfig'
import { Chart, ISample } from './Chart'

const MetricsTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let metricsData:IMetricsData = props.channelObject.data
    let metricsConfig:IMetricsConfig = props.channelObject.config
    const [refresh, setRefresh] = useState(false)
    const [refreshTabContent, setRefreshTabContent] = useState(0)
    const metricsBoxRef = useRef<HTMLDivElement | null>(null)
    const [metricsBoxTop, setMetricsBoxTop] = useState(0)

    useEffect(() => {
        if (metricsBoxRef.current) setMetricsBoxTop(metricsBoxRef.current.getBoundingClientRect().top)
    })

    // const mergeSeries = (names:string[], series:ISample[][]) => {
    //     // names is an array of names of series
    //     // series is an array of arrays of samples
    //     // example:
    //     //   [default, ingress-nginx]
    //     //   [  [ {timestamp:'dad',value:1}, {timestamp:'dad',value:2} ], [ {timestamp:'dad',value:4}, {timestamp:'dad',value:0} ]  ]
    //     if (!names || names.length===0) return []
    //     let resultSeries = []

    //     for (var i=0; i<series[0].length; i++) {
    //         var item: { [key: string]: string|number } = {}
    //         for (var j=0; j<series.length; j++ ) {
    //             if (series[j][i]) {
    //                 item['timestamp'] = series[0][i].timestamp
    //                 item[names[j]] = series[j][i].value
    //             }
    //         }
    //         resultSeries.push(item)
    //     }

    //     // result is:
    //     // [ 
    //     //   {timestamp: '09:16:27', default: 0.21, ingress-nginx: 0.93}
    //     //   {timestamp: '09:16:32', default: 0.5, ingress-nginx: 0.04}
    //     // ]
    //     return resultSeries
    // }

    // const menuChartOptionSelected = (opt:MenuChartOption) => {
    //     setAnchorMenuChart(null)
    // }

    // const createChart = (metricDescription:MetricDefinition, names:string[], series:ISample[][], colour:string, chartType:string) => {
    //     let result
    //     let height=300
    //     let mergedSeries = mergeSeries(names, series)

    //     const renderLabel = (data:any) => {
    //         var values:any[] = series.map (s => s[data.index])
    //         var total:number = values.reduce((acc,value) => acc+value.value, 0)
    //         return <text x={data.x + data.width/3.5} y={data.y-10}>{total.toPrecision(3).replace(/0+$/, '').replace(/\.+$/, '')}</text>
    //     }

    //     switch (chartType) {
    //         case 'value':
    //             height = 40 + series.length*80
    //             result = (
    //                 <Stack direction={'row'}>
    //                     {
    //                         <Typography textAlign={'center'} alignSelf={'center'} width={'100%'}>
    //                             { series.map( (serie,index) => {
    //                                 return (<>
    //                                     <Typography textAlign={'center'} alignSelf={'center'} width={'100%'} fontSize={48} color={series.length===1?colour:METRICSCOLOURS[index]}>
    //                                         {serie[serie.length-1].value}
    //                                     </Typography>
    //                                     <Typography textAlign={'center'} alignSelf={'center'} width={'100%'} fontSize={12} color={series.length===1?colour:METRICSCOLOURS[index]}>
    //                                         {names[index]}
    //                                     </Typography>
    //                                 </>)
    //                             })}
    //                         </Typography>
    //                     }
    //                 </Stack>
    //             )
    //             break
    //         case 'line':
    //             result = (
    //                 <LineChart data={mergedSeries}>
    //                     <CartesianGrid strokeDasharray='3 3'/>
    //                     <XAxis dataKey='timestamp' fontSize={8}/>
    //                     <YAxis/>
    //                     <Tooltip />
    //                     <Legend/>
    //                     { series.map ((_serie,index) => <Line key={index} name={names[index]} type='monotone' dataKey={names[index]} stroke={series.length===1?colour:METRICSCOLOURS[index]} activeDot={{ r: 8 }} />) }
    //                 </LineChart>
    //             )
    //             break
    //         case 'area':
    //             result = (
    //                 <AreaChart data={mergedSeries}>
    //                     <defs>
    //                         {
    //                             series.map( (_serie,index) => {
    //                                 return (
    //                                     <linearGradient key={index} id={`color${series.length===1?colour:METRICSCOLOURS[index]}`} x1='0' y1='0' x2='0' y2='1'>
    //                                         <stop offset='7%' stopColor={series.length===1?colour:METRICSCOLOURS[index]} stopOpacity={0.8}/>
    //                                         <stop offset='93%' stopColor={series.length===1?colour:METRICSCOLOURS[index]} stopOpacity={0}/>
    //                                     </linearGradient>
    //                                 )
    //                             })
    //                         }
    //                     </defs>
    //                     <CartesianGrid strokeDasharray='3 3'/>
    //                     <XAxis dataKey='timestamp' fontSize={8}/>
    //                     <YAxis />
    //                     <Tooltip />
    //                     <Legend/>
    //                     { series.map ((_serie,index) => 
    //                         <Area key={index} name={names[index]} type='monotone' {...(metricsConfig.stack? {stackId:'1'}:{})} dataKey={names[index]} stroke={series.length===1?colour:METRICSCOLOURS[index]} fill={`url(#color${series.length===1?colour:METRICSCOLOURS[index]})`}/> )
    //                     }
    //                 </AreaChart>
    //             )
    //             break
    //         case 'bar':
    //             result = (
    //                 <BarChart data={mergedSeries}>
    //                     <CartesianGrid strokeDasharray='3 3'/>
    //                     <XAxis dataKey='timestamp' fontSize={8}/>
    //                     <YAxis />
    //                     <Tooltip/>
    //                     <Legend/>
    //                     { series.map ((serie,index) =>
    //                         <Bar name={names[index]} {...(metricsConfig.stack? {stackId:'1'}:{})} dataKey={names[index]} stroke={series.length===1?colour:METRICSCOLOURS[index]} fill={series.length===1?colour:METRICSCOLOURS[index]}>
    //                             { index === series.length-1 && series.length > 1 ? <LabelList dataKey={names[index]} position='insideTop' content={renderLabel}/> : null }
    //                         </Bar>
    //                     )}
    //                 </BarChart>
    //             )
    //             break
    //         case 'pie':
    //             var ns:any[] = names.map( (name,index) => {
    //                 return { name, value:(series[index] as any[]).reduce((ac,val) => ac+val.value,0)}
    //             })
    //             result = (
    //                 <PieChart>
    //                     <Tooltip />
    //                     <Legend layout='vertical' align='right' verticalAlign='middle'/>
    //                     <Pie key={'asd'} data={ns} dataKey={'value'} fill={METRICSCOLOURS[0]} innerRadius={0} outerRadius={90}>
    //                         {ns.map((entry, index) => (
    //                             <Cell key={`cell-${index}`} fill={METRICSCOLOURS[index % METRICSCOLOURS.length]} />
    //                         ))}
    //                     </Pie>
    //                 </PieChart>
    //             )
    //             break
    //         default:
    //             result = <Alert severity='error'>Unsupported chart type '{metricsConfig.chart}'</Alert>
    //             break
    //     }

    //     let title = metricDescription.metric.replaceAll('_',' ')
    //     title = title[0].toLocaleUpperCase()+ title.substring(1)
    //     title = title.replaceAll('cpu', 'CPU')
    //     title = title.replaceAll(' fs ', ' FS ')
    //     title = title.replaceAll(' io ', ' IO ')
    //     title = title.replaceAll('oom', 'OOM')
    //     title = title.replaceAll('nvm', 'NVM')
    //     title = title.replaceAll('rss', 'RSS')
    //     title = title.replaceAll('failcnt', 'fail count')
    //     title = title.replaceAll('mbps', 'Mbps')

    //     return (
    //         <Stack direction='column' alignItems='center' width='100%' sx={{mb:'32px'}}>
    //             <Stack direction={'row'} alignItems={'center'}>
    //                 <MUITooltip key={'tooltip'+metricDescription.metric+JSON.stringify(names)} title={<Typography style={{fontSize:12}}><b>{metricDescription.metric}</b><br/><br/>{metricDescription.help}</Typography>}>
    //                         <Typography align='center'>{title}</Typography>
    //                 </MUITooltip>
    //                 <IconButton onClick={(event) => setAnchorMenuChart(event.currentTarget)}><MoreVert fontSize='small'/></IconButton> 
    //                 { anchorMenuChart && <MenuChart onClose={() => setAnchorMenuChart(null)} optionSelected={menuChartOptionSelected} anchorMenu={anchorMenuChart}/>}
    //             </Stack>
    //             <ResponsiveContainer width='100%' height={height} key={metricDescription.metric+JSON.stringify(names)}>
    //                 {result}
    //             </ResponsiveContainer>
    //         </Stack>
    //     )
    // }

    const handleClose = (reason:string, dataMetrics:IMetricsData, event:{ severity:MetricsEventSeverityEnum, text:string }) => {
        dataMetrics.events = dataMetrics.events.filter(e => e.severity!==event.severity && e.text!==event.text)
        setRefreshTabContent(Math.random())
    }

    const formatMetricsError = (dataMetrics:IMetricsData) => {
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
        if (!props.channelObject.metricsList || metricsData.assetMetricsValues.length === 0) {
            return <>{formatMetricsError(metricsData)}</>
        }

        let data:Map<string, Map<string, ISample[]>> = new Map()
        for (let assetMetricsValues of metricsData.assetMetricsValues) {
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
        if (metricsConfig.merge) {
            let assetNames=Array.from(data.keys())
            let selectedMetrics:string[] = Array.from(new Set(data.get(assetNames[0])!.keys()))

            for (let metric of selectedMetrics) {
                let metricDefinition = props.channelObject.metricsList.get(metric)!
                let series = assetNames.map(assetName => {
                    return data.get(assetName)!.get(metric)!
                })
                //allCharts.push(<>{createChart(metricDefinition, assetNames, series, '', metricsConfig.chart)}</>)
                allCharts.push(
                    <Chart metricDefinition={metricDefinition} names={assetNames} series={series} colour={''} chartType={metricsConfig.chart} stack={metricsConfig.stack} numSeries={series.length}/>
                )
            }

            let rows = []
            for (let i = 0; i < allCharts.length; i += metricsConfig.width) {
                rows.push(allCharts.slice(i, i + metricsConfig.width))
            }
            return (<>
                {formatMetricsError(metricsData)}
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
                    let metricDefinition = props.channelObject.metricsList?.get(metric)!
                    var series = data.get(asset)?.get(metric)!
                    //return (<>{createChart(metricDescription, [asset], [series], METRICSCOLOURS[index], metricsConfig.chart)}</>)
                    return <Chart metricDefinition={metricDefinition} names={[asset]} series={[series]} colour={METRICSCOLOURS[index]} chartType={metricsConfig.chart} stack={metricsConfig.stack} numSeries={series.length} />
                })
            })

            // convert allCharts (an array of charts) into a series of rows of charts
            let rows = []
            for (var resultAsset of allCharts) {
                for (let i = 0; i < resultAsset.length; i += metricsConfig.width) {
                    rows.push(resultAsset.slice(i, i + metricsConfig.width))
                }
            }
            return (<>
                {formatMetricsError(metricsData)}
                {rows.map((row, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {row}
                    </div>
                ))}
            </>)
        }
    }

    return (
        <Box ref={metricsBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${metricsBoxTop}px)`}}>
            {formatMetrics()}
        </Box>
    )

}
export { MetricsTabContent }