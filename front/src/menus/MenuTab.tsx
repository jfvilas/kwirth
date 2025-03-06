import React, { useContext } from 'react'
import { Collapse, Divider, Menu, MenuItem, MenuList, Typography } from '@mui/material'
import { Check, Pause, PlayArrow, RemoveCircleRounded,  Stop, ExpandLess, ExpandMore, DriveFileRenameOutline, KeyboardArrowLeft, KeyboardArrowRight, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, PlayCircle, RestartAlt, Info, Add } from '@mui/icons-material'
import { SessionContext, SessionContextType } from '../model/SessionContext'
import { TabObject } from '../model/TabObject'

enum MenuTabOption {
    AlarmCreate,
    ManageAlarms,
    TabInfo,
    TabRename,
    TabSetDefault,
    TabMoveLeft,
    TabMoveRight,
    TabMoveFirst,
    TabMoveLast,
    TabRemove,
    LogBackground,
    LogTimestamp,
    LogStart,
    LogPause,
    LogStop,
    MetricsStart,
    MetricsAdd,
    MetricsPause,
    MetricsStop,
    AlarmStart,
    AlarmPause,
    AlarmStop,
    TabManageRestart
}

interface IProps {
    onClose:() => {}
    optionSelected: (opt:MenuTabOption) => {}
    anchorMenuTab:Element
    tabs:TabObject[]
    selectedTab:TabObject
    selectedTabIndex:number
}

const MenuTab: React.FC<any> = (props:IProps) => {
    const {user} = useContext(SessionContext) as SessionContextType;
    const [subMenuTabOpen, setSubmenuTabOpen] = React.useState(false)
    const [subMenuLogOpen, setSubmenuLogOpen] = React.useState(false)
    const [subMenuMetricsOpen, setSubmenuMetricsOpen] = React.useState(false)
    const [subMenuAlarmOpen, setSubmenuAlarmOpen] = React.useState(false)
    const [subMenuManageOpen, setSubmenuManageOpen] = React.useState(false)

    const submenuTabClick = () => {
        if (!subMenuTabOpen) {
            setSubmenuLogOpen(false)
            setSubmenuMetricsOpen(false)
            setSubmenuManageOpen(false)
        }
        setSubmenuTabOpen(!subMenuTabOpen)
    }

    const submenuLogClick = () => {
        if (!subMenuLogOpen) {
            setSubmenuTabOpen(false)
            setSubmenuMetricsOpen(false)
            setSubmenuAlarmOpen(false)
            setSubmenuManageOpen(false)
        }
        setSubmenuLogOpen(!subMenuLogOpen)
    }

    const submenuMetricsClick = () => {
        if (!subMenuMetricsOpen) {
            setSubmenuTabOpen(false)
            setSubmenuLogOpen(false)
            setSubmenuAlarmOpen(false)
            setSubmenuManageOpen(false)
        }
        setSubmenuMetricsOpen(!subMenuMetricsOpen)
    }

    const submenuAlarmClick = () => {
        if (!subMenuAlarmOpen) {
            setSubmenuTabOpen(false)
            setSubmenuLogOpen(false)
            setSubmenuMetricsOpen(false)
            setSubmenuManageOpen(false)
        }
        setSubmenuAlarmOpen(!subMenuAlarmOpen)
    }

    const submenuManageClick = () => {
        if (!subMenuManageOpen) {
            setSubmenuTabOpen(false)
            setSubmenuLogOpen(false)
            setSubmenuAlarmOpen(false)
            setSubmenuMetricsOpen(false)
        }
        setSubmenuManageOpen(!subMenuManageOpen)
    }

    const menuTabs=(
        <Menu id='menu-logs' anchorEl={props.anchorMenuTab} open={Boolean(props.anchorMenuTab)} onClose={props.onClose}>
            <MenuList dense sx={{width:'40vh'}}>
            <MenuItem key='fa' onClick={() => props.optionSelected(MenuTabOption.AlarmCreate)} sx={{ml:3}} disabled={true}>Convert filter to alarm...</MenuItem>
            <MenuItem key='ma' onClick={() => props.optionSelected(MenuTabOption.ManageAlarms)} sx={{ml:3}} disabled={true}>Manage alarms...</MenuItem>
            <Divider/>
        
            <MenuItem key='subtab' onClick={submenuTabClick} sx={{ml:3}}>Tab<Typography sx={{flexGrow:1}}></Typography>{subMenuTabOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuTabOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='tabi' onClick={() => props.optionSelected(MenuTabOption.TabInfo)} disabled={props.selectedTabIndex<0}><Info/>&nbsp;Information</MenuItem>
                <MenuItem key='tabr' onClick={() => props.optionSelected(MenuTabOption.TabRename)} disabled={props.selectedTabIndex<0}><DriveFileRenameOutline/>&nbsp;Rename</MenuItem>
                <MenuItem key='tabd' onClick={() => props.optionSelected(MenuTabOption.TabSetDefault)} disabled={props.selectedTabIndex<0} sx={{ml: props.selectedTab?.defaultTab?0:3}}> {props.selectedTab?.defaultTab && <Check/>} Set default tab for board</MenuItem>
                <MenuItem key='tabml' onClick={() => props.optionSelected(MenuTabOption.TabMoveLeft)} disabled={props.selectedTabIndex===0}><KeyboardArrowLeft/>Move to left</MenuItem>
                <MenuItem key='tabmr' onClick={() => props.optionSelected(MenuTabOption.TabMoveRight)} disabled={props.selectedTabIndex===props.tabs.length-1}><KeyboardArrowRight/>Move to right</MenuItem>
                <MenuItem key='tabms' onClick={() => props.optionSelected(MenuTabOption.TabMoveFirst)} disabled={props.selectedTabIndex===0}><KeyboardDoubleArrowLeft/>&nbsp;Move to start</MenuItem>
                <MenuItem key='tabme' onClick={() => props.optionSelected(MenuTabOption.TabMoveLast)} disabled={props.selectedTabIndex===props.tabs.length-1}><KeyboardDoubleArrowRight/>&nbsp;Move to end</MenuItem>
                <MenuItem key='tabrm' onClick={() => props.optionSelected(MenuTabOption.TabRemove)}><RemoveCircleRounded/>&nbsp;Remove</MenuItem>
            </Collapse>
            
            <MenuItem key='sublog' onClick={submenuLogClick} sx={{ml:3}} disabled={!Boolean (props.selectedTab?.logObject)}>Log<Typography sx={{flexGrow:1}}></Typography>{subMenuLogOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuLogOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='logbg' onClick={() => props.optionSelected(MenuTabOption.LogBackground)} sx={{ml: props.selectedTab?.logObject?.showBackgroundNotification?0:3}}>{ props.selectedTab?.logObject?.showBackgroundNotification &&  <Check/>} Show background notifications</MenuItem>
                <MenuItem key='logts' onClick={() => props.optionSelected(MenuTabOption.LogTimestamp)} disabled={props.selectedTab?.logObject?.started} sx={{ml: props.selectedTab?.logObject?.addTimestamp?0:3}}>{ props.selectedTab?.logObject?.addTimestamp &&  <Check/>} Add timestamp to messages</MenuItem>
                <MenuItem key='logstart' onClick={() => props.optionSelected(MenuTabOption.LogStart)} disabled={props.selectedTab?.logObject?.started}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='logpr' onClick={() => props.optionSelected(MenuTabOption.LogPause)} disabled={!props.selectedTab?.logObject?.started}>{props.selectedTab?.logObject?.paused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
                <MenuItem key='logstop' onClick={() => props.optionSelected(MenuTabOption.LogStop)} disabled={!props.selectedTab?.logObject?.started}><Stop/>&nbsp;Stop</MenuItem>
            </Collapse>

            <MenuItem key='submetrics' onClick={submenuMetricsClick} sx={{ml:3}} disabled={!Boolean(props.selectedTab?.metricsObject)}>Metrics<Typography sx={{flexGrow:1}}></Typography>{subMenuLogOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuMetricsOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='metricsstart' onClick={() => props.optionSelected(MenuTabOption.MetricsStart)} disabled={props.selectedTab?.metricsObject?.started}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='metricsadd' onClick={() => props.optionSelected(MenuTabOption.MetricsAdd)} disabled={true}><Add/>&nbsp;Add</MenuItem>
                <MenuItem key='metricspause' onClick={() => props.optionSelected(MenuTabOption.MetricsPause)} disabled={!props.selectedTab?.metricsObject?.started}>{props.selectedTab?.metricsObject?.paused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>            
                <MenuItem key='metricsstop' onClick={() => props.optionSelected(MenuTabOption.MetricsStop)} disabled={!props.selectedTab?.metricsObject?.started}><Stop/>&nbsp;Stop</MenuItem>
            </Collapse>

            <MenuItem key='subalarm' onClick={submenuAlarmClick} sx={{ml:3}} disabled={!Boolean(props.selectedTab?.alarmObject)}>Alarm<Typography sx={{flexGrow:1}}></Typography>{subMenuAlarmOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuAlarmOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='alarmstart' onClick={() => props.optionSelected(MenuTabOption.AlarmStart)} disabled={props.selectedTab?.alarmObject?.started}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='alarmpause' onClick={() => props.optionSelected(MenuTabOption.AlarmPause)} disabled={!props.selectedTab?.alarmObject?.started}>{props.selectedTab?.alarmObject?.paused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
                <MenuItem key='alarmstop' onClick={() => props.optionSelected(MenuTabOption.AlarmStop)} disabled={!props.selectedTab?.alarmObject?.started}><Stop/>&nbsp;Stop</MenuItem>
            </Collapse>


            <MenuItem key='submanage' onClick={submenuManageClick} sx={{ml:3}}>Manage<Typography sx={{flexGrow:1}}></Typography>{subMenuManageOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuManageOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='manstart' onClick={() => props.optionSelected(MenuTabOption.TabManageRestart)} disabled={user?.scope==='view' || (props.selectedTab?.logObject?.view!=='group' && props.selectedTab?.logObject?.view!=='pod')}><RestartAlt/>&nbsp;Restart</MenuItem>
            </Collapse>
            </MenuList>
        </Menu>
    )
    
    return menuTabs
}

export { MenuTab, MenuTabOption }