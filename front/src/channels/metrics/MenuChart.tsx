import React from 'react'
import { Divider, Menu, MenuItem, MenuList } from '@mui/material'
import { AreaChart, BarChart, Delete, PieChart, Remove, ShowChart, StackedLineChart, Stop, ThirtyFps } from '@mui/icons-material'

enum MenuChartOption {
    LineChart='line',
    BarChart='bar',
    AreaChart='area',
    ValueChart='value',
    PieChart='pie',
    Stack='stack',
    Remove='remove'
}

interface IProps {
    onClose:() => void
    optionSelected: (opt:MenuChartOption) => void
    anchorMenu: Element
    selected: MenuChartOption
    stacked: boolean
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
            <Divider/>
            <MenuItem key='chartstack' onClick={() => props.optionSelected(MenuChartOption.Stack)} selected={props.stacked} disabled={props.selected!==MenuChartOption.AreaChart && props.selected!==MenuChartOption.BarChart}><StackedLineChart/>&nbsp;Stack values</MenuItem>
            <Divider/>
            <MenuItem key='chartremove' disabled={true}><Delete/>&nbsp;Remove chart</MenuItem>
        </MenuList>
    </Menu>
}

export { MenuChart, MenuChartOption }