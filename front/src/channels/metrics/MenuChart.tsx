import React from 'react'
import { Divider, Menu, MenuItem, MenuList } from '@mui/material'
import { Analytics, AreaChart, BarChart, Delete, DoneAll, ImportExport, Info, LocalOffer, PieChart, ShowChart, StackedLineChart, ThirtyFps } from '@mui/icons-material'

enum EChartType {
    LineChart='line',
    BarChart='bar',
    AreaChart='area',
    ValueChart='value',
    PieChart='pie',
    TreemapChart='treemap',
}

enum MenuChartOption {
    Chart='chart',
    Stack='stack',
    Tooltip='tooltip',
    Labels='labels',
    Default='default',
    Remove='remove',
    Export='export'
}

interface IProps {
    onClose:() => void
    onOptionSelected: (opt:MenuChartOption, data?:string) => void
    anchorMenu: Element
    selected: EChartType
    stacked: boolean
    tooltip: boolean
    labels: boolean
    numSeries: number
    setDefault: boolean
}

const MenuChart: React.FC<IProps> = (props:IProps) => {

    return <Menu id='menu-logs' anchorEl={props.anchorMenu} open={Boolean(props.anchorMenu)} onClose={props.onClose}>
        <MenuList dense sx={{width:'180px'}}>
            <MenuItem key='chartline' onClick={() => props.onOptionSelected(MenuChartOption.Chart, EChartType.LineChart)} selected={props.selected===EChartType.LineChart}><ShowChart/>&nbsp;Line chart</MenuItem>
            <MenuItem key='chartarea' onClick={() => props.onOptionSelected(MenuChartOption.Chart, EChartType.AreaChart)} selected={props.selected===EChartType.AreaChart}><AreaChart/>&nbsp;Area chart</MenuItem>
            <MenuItem key='chartbar' onClick={() => props.onOptionSelected(MenuChartOption.Chart, EChartType.BarChart)} selected={props.selected===EChartType.BarChart}><BarChart/>&nbsp;Bar chart</MenuItem>
            <MenuItem key='chartpie' onClick={() => props.onOptionSelected(MenuChartOption.Chart, EChartType.PieChart)} selected={props.selected===EChartType.PieChart} disabled={props.numSeries<2}><PieChart/>&nbsp;Pie chart</MenuItem>
            <MenuItem key='chartvalue' onClick={() => props.onOptionSelected(MenuChartOption.Chart, EChartType.ValueChart)} selected={props.selected===EChartType.ValueChart}><ThirtyFps/>&nbsp;Show value</MenuItem>
            <MenuItem key='charttreemap' onClick={() => props.onOptionSelected(MenuChartOption.Chart, EChartType.TreemapChart)} selected={props.selected===EChartType.TreemapChart}><Analytics/>&nbsp;Tree map</MenuItem>
            <Divider/>
            <MenuItem key='chartstack' onClick={() => props.onOptionSelected(MenuChartOption.Stack)} selected={props.stacked} disabled={props.selected!==EChartType.AreaChart && props.selected!==EChartType.BarChart}><StackedLineChart/>&nbsp;Stack values</MenuItem>
            <MenuItem key='charttooltip' onClick={() => props.onOptionSelected(MenuChartOption.Tooltip)} selected={props.tooltip}><Info/>&nbsp;Show tooltip</MenuItem>
            <MenuItem key='chartlabel' onClick={() => props.onOptionSelected(MenuChartOption.Labels)} selected={props.labels}><LocalOffer/>&nbsp;Show labels</MenuItem>
            { props.setDefault && <MenuItem key='chartdefault' onClick={() => props.onOptionSelected(MenuChartOption.Default)}><DoneAll/>&nbsp;Set default</MenuItem>}

            <Divider/>
            <MenuItem key='chartexport' onClick={() => props.onOptionSelected(MenuChartOption.Export)}><ImportExport/>&nbsp;Export data</MenuItem>
            <MenuItem key='chartremove' disabled={false} onClick={() => props.onOptionSelected(MenuChartOption.Remove)}><Delete/>&nbsp;Remove chart</MenuItem>
        </MenuList>
    </Menu>
}

export { MenuChart, MenuChartOption, EChartType }