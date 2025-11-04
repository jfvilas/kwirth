import React, { useState } from 'react'
import { Alert, Box, Stack, Typography } from '@mui/material'
import { MetricDefinition } from './MetricDefinition'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from 'recharts'
import { METRICSCOLOURS } from './MetricsConfig'
import { Tooltip as MUITooltip, IconButton } from '@mui/material'
import { MenuChart, MenuChartOption } from './MenuChart'
import { MoreVert } from '@mui/icons-material'
import { TreemapNode } from 'recharts/types/util/types'

export interface ISample {
    timestamp:string
    value:number
}

export interface IChartProps {
    metricDefinition: MetricDefinition,
    names: string[],
    series: ISample[][],
    colour: string,
    chartType: MenuChartOption,
    stack: boolean
    tooltip: boolean
    labels: boolean
    numSeries: number
}

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

const CustomizedContent: React.FC<TreemapNode> = (props) => {
    const { root, depth, x, y, width, height, index, name } = props

    return (
        <g>
            <rect x={x} y={y} width={width} height={height}
                style={{
                    fill: depth < 2 ? METRICSCOLOURS[Math.floor((index / root.children.length) * 6)] : '#ffffff00',
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                }}
            />
            {depth === 1 ? (
                <text x={x + width / 2} y={y + height / 2 + 7} textAnchor="middle" fill="#fff" fontSize={14} fontFamily='Roboto, Helvetica, Arial, sans-serif'>
                {name}
                </text>
            ) : null}

        </g>
    )
}

export const Chart: React.FC<IChartProps> = (props:IChartProps) => {
    const [anchorMenuChart, setAnchorMenuChart] = useState<null | HTMLElement>(null)
    const [chartType, setChartType] = useState<MenuChartOption>(props.chartType)
    const [stack, setStack] = useState<boolean>(props.stack)
    const [tooltip, setTooltip] = useState<boolean>(props.tooltip)
    const [labels, setLabels] = useState<boolean>(props.labels)
    
    let result
    let height=300
    let mergedSeries = mergeSeries(props.names, props.series)

    const menuChartOptionSelected = (opt:MenuChartOption) => {
        setAnchorMenuChart(null)
        switch (opt) {
            case MenuChartOption.Stack:
                setStack(!stack)
                break
            case MenuChartOption.Remove:
                //+++ pending implementation on parent
                break
            case MenuChartOption.Export:
                //+++ pending implementation on parent
                break
            case MenuChartOption.Tooltip:
                setTooltip(!tooltip)
                break
            case MenuChartOption.Labels:
                setLabels(!labels)
                break
            default:
                setChartType(opt)
            break
        } 
    }

    const renderLabel = (data:any) => {
        var values:any[] = props.series.map (s => s[data.index])
        var total:number = values.reduce((acc,value) => acc+value.value, 0)
        return <text x={data.x + data.width/3.5} y={data.y-10}>{total.toPrecision(3).replace(/0+$/, '').replace(/\.+$/, '')}</text>
    }

    switch (chartType) {
        case MenuChartOption.ValueChart:
            result = (
                <div style={{padding:'30px', height:height*0.8, alignItems:'center', justifyContent:'center', display:'flex'}}>
                <Stack direction={'row'} alignItems={'center'} justifyContent={'center'} spacing={2} sx={{ flexWrap: 'wrap'}}>
                    { props.series.map( (serie,index) => {
                        return (
                            <Stack direction={'column'}>
                                <Typography mt={2} textAlign={'center'} width={'100%'} fontSize={Math.min(48, 192/props.series.length)} color={props.series.length===1?props.colour:METRICSCOLOURS[index]}>
                                    {serie[serie.length-1].value}
                                </Typography>
                                <Typography textAlign={'center'} width={'100%'} fontSize={12} color={props.series.length===1?props.colour:METRICSCOLOURS[index]}>
                                    {props.names[index]}
                                </Typography>
                            </Stack>
                        )
                    })}
                </Stack>
                </div>
            )
            break
        case MenuChartOption.LineChart:
            result = (
                <LineChart data={mergedSeries}>
                    <CartesianGrid strokeDasharray='3 3'/>
                    <XAxis dataKey='timestamp' fontSize={8}/>
                    <YAxis/>
                    { tooltip && <Tooltip /> }
                    <Legend/>
                    { props.series.map ((_serie,index) => <Line key={index} name={props.names[index]} type='monotone' dataKey={props.names[index]} stroke={props.series.length===1?props.colour:METRICSCOLOURS[index]} activeDot={{ r: 8 }} />) }
                </LineChart>
            )
            break
        case MenuChartOption.AreaChart:
            result = (
                <AreaChart data={mergedSeries}>
                    <defs>
                        {
                            props.series.map( (_serie,index) => {
                                return (
                                    <linearGradient key={index} id={`color${props.series.length===1?props.colour:METRICSCOLOURS[index]}`} x1='0' y1='0' x2='0' y2='1'>
                                        <stop offset='7%' stopColor={props.series.length===1?props.colour:METRICSCOLOURS[index]} stopOpacity={0.8}/>
                                        <stop offset='93%' stopColor={props.series.length===1?props.colour:METRICSCOLOURS[index]} stopOpacity={0}/>
                                    </linearGradient>
                                )
                            })
                        }
                    </defs>
                    <CartesianGrid strokeDasharray='3 3'/>
                    <XAxis dataKey='timestamp' fontSize={8}/>
                    <YAxis />
                    { tooltip && <Tooltip /> }
                    <Legend/>
                    { props.series.map ((_serie,index) => 
                        <Area key={index} name={props.names[index]} type='monotone' {...(stack? {stackId:'1'}:{})} dataKey={props.names[index]} stroke={props.series.length===1?props.colour:METRICSCOLOURS[index]} fill={`url(#color${props.series.length===1?props.colour:METRICSCOLOURS[index]})`}/> )
                    }
                </AreaChart>
            )
            break
        case MenuChartOption.BarChart:
            result = (
                <BarChart data={mergedSeries}>
                    <CartesianGrid strokeDasharray='3 3'/>
                    <XAxis dataKey='timestamp' fontSize={8}/>
                    <YAxis />
                    { tooltip && <Tooltip /> }
                    <Legend/>
                    { props.series.map ((serie,index) =>
                        <Bar name={props.names[index]} {...(stack? {stackId:'1'}:{})} dataKey={props.names[index]} stroke={props.series.length===1?props.colour:METRICSCOLOURS[index]} fill={props.series.length===1?props.colour:METRICSCOLOURS[index]}>
                            { index === props.series.length-1 && props.series.length > 1 && labels ? <LabelList dataKey={props.names[index]} position='insideTop' content={renderLabel}/> : null }
                        </Bar>
                    )}
                </BarChart>
            )
            break
        case MenuChartOption.PieChart:
            var dataSummarized:any[] = props.names.map( (name,index) => {
                return { name, value:(props.series[index] as ISample[]).reduce((ac,val) => ac+val.value,0)}
            })
            result = (
                <PieChart>
                    { tooltip && <Tooltip /> }
                    <Legend layout='vertical' align='right' verticalAlign='middle'/>
                    <Pie key={'asd'} data={dataSummarized} dataKey={'value'} fill={METRICSCOLOURS[0]} innerRadius={0} outerRadius={90}>
                        {dataSummarized.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={METRICSCOLOURS[index % METRICSCOLOURS.length]} />
                        ))}
                    </Pie>
                </PieChart>
            )
            break
        case MenuChartOption.TreemapChart:
            var dataSummarized:any[] = props.names.map( (name,index) => {
                return { name, value:(props.series[index] as ISample[]).reduce((ac,val) => ac+val.value,0)}
            })
            console.log(dataSummarized)
            result = (
                <div style={{paddingLeft:'32px', height:height*0.8, alignItems:'center', justifyContent:'center', display:'flex'}}>
                    <ResponsiveContainer width='100%' onResize={() => {}}>
                        <Treemap data={dataSummarized} dataKey='value' nameKey='name' aspectRatio={4 / 3} stroke="#ffffff" fill="#6e5bb8" content={React.createElement(CustomizedContent)}>
                            { tooltip && <Tooltip /> }
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            )
            break
        default:
            result = <Alert severity='error'>Unsupported chart type '{props.chartType}'</Alert>
            break
    }

    let title = props.metricDefinition.metric.replaceAll('_',' ')
    title = title[0].toLocaleUpperCase()+ title.substring(1)
    title = title.replaceAll('cpu', 'CPU')
    title = title.replaceAll(' fs ', ' FS ')
    title = title.replaceAll(' io ', ' IO ')
    title = title.replaceAll('oom', 'OOM')
    title = title.replaceAll('nvm', 'NVM')
    title = title.replaceAll('rss', 'RSS')
    title = title.replaceAll('failcnt', 'fail count')
    title = title.replaceAll('mbps', 'Mbps')

    return (
        <Stack direction='column' alignItems='center' width='100%' sx={{mb:'32px'}}>
            <Stack direction={'row'} alignItems={'center'}>
                <MUITooltip key={'tooltip'+props.metricDefinition.metric+JSON.stringify(props.names)} title={<Typography style={{fontSize:12}}><b>{props.metricDefinition.metric}</b><br/><br/>{props.metricDefinition.help}</Typography>}>
                        <Typography align='center'>{title}</Typography>
                </MUITooltip>
                <IconButton onClick={(event) => setAnchorMenuChart(event.currentTarget)}><MoreVert fontSize='small'/></IconButton> 
                { anchorMenuChart && <MenuChart onClose={() => setAnchorMenuChart(null)} optionSelected={menuChartOptionSelected} anchorMenu={anchorMenuChart} selected={chartType} stacked={stack} tooltip={tooltip} labels={labels} numSeries={props.numSeries} />}
            </Stack>
            <ResponsiveContainer width='100%' height={height} key={props.metricDefinition.metric+JSON.stringify(props.names)}>
                {result}
            </ResponsiveContainer>
        </Stack>
    )
}
