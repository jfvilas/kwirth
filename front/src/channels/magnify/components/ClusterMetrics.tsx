import { useEffect } from 'react'
import { Stack } from '@mui/material'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { IMagnifyData } from '../MagnifyData'
import { IChannelObject } from '../../IChannel'

interface IClusterMetricsProps {
    channelObject: IChannelObject
}

const ClusterMetrics: React.FC<IClusterMetricsProps> = (props:IClusterMetricsProps) => {
    let magnifyData:IMagnifyData = props.channelObject.data as IMagnifyData

    return <Stack direction={'row'} sx={{height:'200px'}}>
        <ResponsiveContainer>
            <LineChart data={magnifyData.metricsCluster} title='CPU'>
                <CartesianGrid strokeDasharray='3 3'/>
                <XAxis dataKey='timestamp' fontSize={8}/>
                <YAxis fontSize={8}/>
                <Legend/>
                <Line name={'% CPU'} type='monotone' dataKey={'cpu'}/>
            </LineChart>
        </ResponsiveContainer>

        <ResponsiveContainer>
            <LineChart data={magnifyData.metricsCluster} title='Memory'>
                <CartesianGrid strokeDasharray='3 3'/>
                <XAxis dataKey='timestamp' fontSize={8}/>
                <YAxis fontSize={8}/>
                <Legend/>
                <Line name={'% Memory'} type='monotone' dataKey={'memory'}/>
            </LineChart>
        </ResponsiveContainer>
        <ResponsiveContainer>
            <LineChart data={magnifyData.metricsCluster} title='Network'>
                <CartesianGrid strokeDasharray='3 3'/>
                <XAxis dataKey='timestamp' fontSize={8}/>
                <YAxis fontSize={8}/>
                <Legend/>
                <Line name={'Tx Mbps'} type='monotone' dataKey={'txmbps'} stroke='#6e5bb8'/>
                <Line name={'Rx Mbps'} type='monotone' dataKey={'rxmbps'} stroke='#4a9076'/>
            </LineChart>
        </ResponsiveContainer>
        
    </Stack>
}
export { ClusterMetrics }