import React, { useContext } from 'react';
import { Collapse, Divider, Menu, MenuItem, MenuList, Typography } from "@mui/material"
import { Check, Pause, PlayArrow, RemoveCircleRounded,  Stop, ExpandLess, ExpandMore, DriveFileRenameOutline, KeyboardArrowLeft, KeyboardArrowRight, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, PlayCircle, RestartAlt, Info } from '@mui/icons-material';
import { LogObject } from '../model/LogObject';
import { SessionContext, SessionContextType } from '../model/SessionContext';
import { MetricsObject } from '../model/MetricsObject';

enum MenuLogOption {
    LogAlarmCreate,
    LogManageAlarms,
    LogOptionsBackground,
    LogOptionsTimestamp,
    LogOrganizeInfo,
    LogOrganizeRename,
    LogOrganizeDefault,
    LogOrganizeMoveLeft,
    LogOrganizeMoveRight,
    LogOrganizeMoveFirst,
    LogOrganizeMoveLast,
    LogActionsStart,
    LogActionsPause,
    LogActionsStop,
    LogActionsRemove,
    LogMetricsStart,
    LogMetricsStop,
    LogManageRestart
}

interface IProps {
    onClose:() => {}
    optionSelected: (opt:MenuLogOption) => {}
    anchorMenuLog:Element
    logs:LogObject[]
    selectedLog:LogObject
    selectedLogIndex:number
    selectedMetrics:MetricsObject
}

const MenuLog: React.FC<any> = (props:IProps) => {
    const {user} = useContext(SessionContext) as SessionContextType;
    const [subMenuOptionsOpen, setSubmenuOptionsOpen] = React.useState(false)
    const [subMenuOrganizeOpen, setSubmenuOrganizeOpen] = React.useState(false)
    const [subMenuActionsOpen, setSubmenuActionsOpen] = React.useState(false)
    const [submenuMetricsOpen, setSubmenuMetricsOpen] = React.useState(false)
    const [subMenuManageOpen, setSubmenuManageOpen] = React.useState(false)

    const submenuOptionsClick = () => {
        if (!subMenuOptionsOpen) {
            setSubmenuActionsOpen(false);
            setSubmenuOrganizeOpen(false);
            setSubmenuManageOpen(false);
            setSubmenuMetricsOpen(false);
        }
        setSubmenuOptionsOpen(!subMenuOptionsOpen);
    }

    const submenuOrganizeClick = () => {
        if (!subMenuOrganizeOpen) {
            setSubmenuOptionsOpen(false);
            setSubmenuActionsOpen(false);
            setSubmenuManageOpen(false);
            setSubmenuMetricsOpen(false);
        }
        setSubmenuOrganizeOpen(!subMenuOrganizeOpen);
    }

    const submenuActionClick = () => {
        if (!subMenuActionsOpen) {
            setSubmenuOptionsOpen(false);
            setSubmenuOrganizeOpen(false);
            setSubmenuManageOpen(false);
            setSubmenuMetricsOpen(false);
        }
        setSubmenuActionsOpen(!subMenuActionsOpen);
    }

    const submenuMetricsClick = () => {
        if (!submenuMetricsOpen) {
            setSubmenuOptionsOpen(false);
            setSubmenuActionsOpen(false);
            setSubmenuOrganizeOpen(false);
            setSubmenuManageOpen(false);
        }
        setSubmenuMetricsOpen(!submenuMetricsOpen);
    }

    const submenuManageClick = () => {
        if (!subMenuManageOpen) {
            setSubmenuOptionsOpen(false);
            setSubmenuOrganizeOpen(false);
            setSubmenuActionsOpen(false);
        }
        setSubmenuManageOpen(!subMenuManageOpen);
    }

    const menuLogs=(
        <Menu id='menu-logs' anchorEl={props.anchorMenuLog} open={Boolean(props.anchorMenuLog)} onClose={props.onClose}>
            <MenuList dense sx={{width:'40vh'}}>
            <MenuItem key='fa' onClick={() => props.optionSelected(MenuLogOption.LogAlarmCreate)} sx={{ml:3}}>Convert filter to alarm...</MenuItem>
            <MenuItem key='ma' onClick={() => props.optionSelected(MenuLogOption.LogManageAlarms)} sx={{ml:3}}>Manage alarms...</MenuItem>
            <Divider/>
        
            <MenuItem key='subopt' onClick={submenuOptionsClick} sx={{ml:3}}>Logging options<Typography sx={{flexGrow:1}}></Typography>{subMenuOptionsOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuOptionsOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='bn' onClick={() => props.optionSelected(MenuLogOption.LogOptionsBackground)} sx={{ml: props.selectedLog?.showBackgroundNotification?0:3}}>{ props.selectedLog?.showBackgroundNotification &&  <Check/>} Show background notifications</MenuItem>
                <MenuItem key='ts' onClick={() => props.optionSelected(MenuLogOption.LogOptionsTimestamp)} disabled={props.selectedLog.started} sx={{ml: props.selectedLog?.addTimestamp?0:3}}>{ props.selectedLog?.addTimestamp &&  <Check/>} Add timestamp to messages</MenuItem>
            </Collapse>

            <MenuItem key='subreorg' onClick={submenuOrganizeClick} sx={{ml:3}}>Organize<Typography sx={{flexGrow:1}}></Typography>{subMenuOrganizeOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuOrganizeOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='il' onClick={() => props.optionSelected(MenuLogOption.LogOrganizeInfo)} disabled={props.selectedLogIndex<0}><Info/>&nbsp;Log information</MenuItem>
                <MenuItem key='rl' onClick={() => props.optionSelected(MenuLogOption.LogOrganizeRename)} disabled={props.selectedLogIndex<0}><DriveFileRenameOutline/>&nbsp;Rename log</MenuItem>
                <MenuItem key='dl' onClick={() => props.optionSelected(MenuLogOption.LogOrganizeDefault)} disabled={props.selectedLogIndex<0} sx={{ml: props.selectedLog?.defaultLog?0:3}}> {props.selectedLog?.defaultLog && <Check/>} Default log</MenuItem>
                <MenuItem key='ml' onClick={() => props.optionSelected(MenuLogOption.LogOrganizeMoveLeft)} disabled={props.selectedLogIndex===0}><KeyboardArrowLeft/>Move to left</MenuItem>
                <MenuItem key='mr' onClick={() => props.optionSelected(MenuLogOption.LogOrganizeMoveRight)} disabled={props.selectedLogIndex===props.logs.length-1}><KeyboardArrowRight/>Move to right</MenuItem>
                <MenuItem key='ms' onClick={() => props.optionSelected(MenuLogOption.LogOrganizeMoveFirst)} disabled={props.selectedLogIndex===0}><KeyboardDoubleArrowLeft/>&nbsp;Move to start</MenuItem>
                <MenuItem key='me' onClick={() => props.optionSelected(MenuLogOption.LogOrganizeMoveLast)} disabled={props.selectedLogIndex===props.logs.length-1}><KeyboardDoubleArrowRight/>&nbsp;Move to end</MenuItem>
            </Collapse>
            
            <MenuItem key='subaction' onClick={submenuActionClick} sx={{ml:3}}>Actions<Typography sx={{flexGrow:1}}></Typography>{subMenuActionsOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuActionsOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='logstart' onClick={() => props.optionSelected(MenuLogOption.LogActionsStart)} disabled={props.selectedLog.started}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='logpr' onClick={() => props.optionSelected(MenuLogOption.LogActionsPause)} disabled={!props.selectedLog.started}>{props.selectedLog.paused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
                <MenuItem key='logstop' onClick={() => props.optionSelected(MenuLogOption.LogActionsStop)} disabled={!props.selectedLog.started}><Stop/>&nbsp;Stop</MenuItem>
                <MenuItem key='logremove' onClick={() => props.optionSelected(MenuLogOption.LogActionsRemove)} ><RemoveCircleRounded/>&nbsp;Remove</MenuItem>
            </Collapse>

            <MenuItem key='submetrics' onClick={submenuMetricsClick} sx={{ml:3}}>Metrics<Typography sx={{flexGrow:1}}></Typography>{subMenuActionsOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={submenuMetricsOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='logmetricsstart' onClick={() => props.optionSelected(MenuLogOption.LogMetricsStart)} disabled={props.selectedMetrics?.started}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='logmetricsstop' onClick={() => props.optionSelected(MenuLogOption.LogMetricsStop)} disabled={!props.selectedMetrics?.started}><Stop/>&nbsp;Stop</MenuItem>
            </Collapse>

            <MenuItem key='submanage' onClick={submenuManageClick} sx={{ml:3}}>Manage<Typography sx={{flexGrow:1}}></Typography>{subMenuManageOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuManageOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='manstart' onClick={() => props.optionSelected(MenuLogOption.LogManageRestart)} disabled={user?.scope==='view' || (props.selectedLog.view!=='group' && props.selectedLog.view!=='pod')}><RestartAlt/>&nbsp;Restart</MenuItem>
            </Collapse>
            </MenuList>
        </Menu>
    );
    
    return menuLogs;
}

export { MenuLog, MenuLogOption };