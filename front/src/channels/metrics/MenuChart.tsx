import React from 'react'
import { Divider, Menu, MenuItem, MenuList } from '@mui/material'
import { Analytics, AreaChart, BarChart, Delete, ImportExport, Info, LocalOffer, PieChart, ShowChart, StackedLineChart, ThirtyFps } from '@mui/icons-material'

enum MenuChartOption {
    LineChart='line',
    BarChart='bar',
    AreaChart='area',
    ValueChart='value',
    PieChart='pie',
    TreemapChart='treemap',
    Stack='stack',
    Tooltip='tooltip',
    Labels='labels',
    Remove='remove',
    Export='export'
}

interface IProps {
    onClose:() => void
    optionSelected: (opt:MenuChartOption) => void
    anchorMenu: Element
    selected: MenuChartOption
    stacked: boolean
    tooltip: boolean
    labels: boolean
    numSeries: number
}

const MenuChart: React.FC<IProps> = (props:IProps) => {

    return <Menu id='menu-logs' anchorEl={props.anchorMenu} open={Boolean(props.anchorMenu)} onClose={props.onClose}>
        <MenuList dense sx={{width:'180px'}}>
            <MenuItem key='chartline' onClick={() => props.optionSelected(MenuChartOption.LineChart)} selected={props.selected===MenuChartOption.LineChart}><ShowChart/>&nbsp;Line chart</MenuItem>
            <MenuItem key='chartarea' onClick={() => props.optionSelected(MenuChartOption.AreaChart)} selected={props.selected===MenuChartOption.AreaChart}><AreaChart/>&nbsp;Area chart</MenuItem>
            <MenuItem key='chartbar' onClick={() => props.optionSelected(MenuChartOption.BarChart)} selected={props.selected===MenuChartOption.BarChart}><BarChart/>&nbsp;Bar chart</MenuItem>
            <MenuItem key='chartpie' onClick={() => props.optionSelected(MenuChartOption.PieChart)} selected={props.selected===MenuChartOption.PieChart} disabled={props.numSeries<2}><PieChart/>&nbsp;Pie chart</MenuItem>
            <MenuItem key='chartvalue' onClick={() => props.optionSelected(MenuChartOption.ValueChart)} selected={props.selected===MenuChartOption.ValueChart}><ThirtyFps/>&nbsp;Show value</MenuItem>
            <MenuItem key='charttreemap' onClick={() => props.optionSelected(MenuChartOption.TreemapChart)} selected={props.selected===MenuChartOption.TreemapChart}><Analytics/>&nbsp;Tree map</MenuItem>
            <Divider/>
            <MenuItem key='chartstack' onClick={() => props.optionSelected(MenuChartOption.Stack)} selected={props.stacked} disabled={props.selected!==MenuChartOption.AreaChart && props.selected!==MenuChartOption.BarChart}><StackedLineChart/>&nbsp;Stack values</MenuItem>
            <MenuItem key='charttooltip' onClick={() => props.optionSelected(MenuChartOption.Tooltip)} selected={props.tooltip}><Info/>&nbsp;Show tooltip</MenuItem>
            <MenuItem key='chartlabel' onClick={() => props.optionSelected(MenuChartOption.Labels)} selected={props.labels}><LocalOffer/>&nbsp;Show labels</MenuItem>
            <Divider/>
            <MenuItem key='chartexport' disabled={true}><ImportExport/>&nbsp;Export data</MenuItem>
            <MenuItem key='chartremove' disabled={true}><Delete/>&nbsp;Remove chart</MenuItem>
        </MenuList>
    </Menu>
}

export { MenuChart, MenuChartOption }