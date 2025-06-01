import React from 'react'
import { Collapse, Menu, MenuItem, MenuList, Typography } from '@mui/material'
import { Check, Pause, PlayArrow, RemoveCircleRounded,  Stop, ExpandLess, ExpandMore, DriveFileRenameOutline, KeyboardArrowLeft, KeyboardArrowRight, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, PlayCircle, Info } from '@mui/icons-material'
import { ITabObject } from '../model/ITabObject'

enum MenuTabOption {
    // AlarmCreate,
    // ManageAlarms,
    TabInfo,
    TabRename,
    TabSetDefault,
    TabMoveLeft,
    TabMoveRight,
    TabMoveFirst,
    TabMoveLast,
    TabRemove,
    ChannelStart,
    ChannelPause,
    ChannelStop
}

interface IProps {
    onClose:() => void
    optionSelected: (opt:MenuTabOption) => void
    anchorMenuTab: Element
    tabs: ITabObject[]
    selectedTab?: ITabObject
    selectedTabIndex: number
}

const MenuTab: React.FC<IProps> = (props:IProps) => {
    const [subMenuTabOpen, setSubmenuTabOpen] = React.useState(false)

    return (
        <Menu id='menu-logs' anchorEl={props.anchorMenuTab} open={Boolean(props.anchorMenuTab)} onClose={props.onClose}>
            <MenuList dense sx={{width:'40vh'}}>
                {/* <MenuItem key='fa' onClick={() => props.optionSelected(MenuTabOption.AlarmCreate)} sx={{ml:3}} disabled={true}>Convert filter to alarm...</MenuItem>
                <MenuItem key='ma' onClick={() => props.optionSelected(MenuTabOption.ManageAlarms)} sx={{ml:3}} disabled={true}>Manage alarms...</MenuItem>
                <Divider/> */}
            
                <MenuItem key='subtab' onClick={() => setSubmenuTabOpen(!subMenuTabOpen)} sx={{ml:3}}>Tab<Typography sx={{flexGrow:1}}></Typography>{subMenuTabOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
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
                
                <MenuItem key='channelstart' onClick={() => props.optionSelected(MenuTabOption.ChannelStart)} disabled={props.selectedTab?.channelStarted}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='channelpause' onClick={() => props.optionSelected(MenuTabOption.ChannelPause)} disabled={!props.selectedTab?.channelStarted}>{props.selectedTab?.channelPaused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
                <MenuItem key='channelstop' onClick={() => props.optionSelected(MenuTabOption.ChannelStop)} disabled={!props.selectedTab?.channelStarted}><Stop/>&nbsp;Stop</MenuItem>

                {/* <MenuItem key='submanage' onClick={submenuManageClick} sx={{ml:3}}>Manage<Typography sx={{flexGrow:1}}></Typography>{subMenuManageOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
                <Collapse in={subMenuManageOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                    <MenuItem key='manstart' onClick={() => props.optionSelected(MenuTabOption.TabManageRestart)} disabled={user?.scope==='view' || (props.selectedTab?.logObject?.view!==InstanceConfigViewEnum.GROUP && props.selectedTab?.logObject?.view!=='pod')}><RestartAlt/>&nbsp;Restart</MenuItem>
                </Collapse> */}
            </MenuList>
        </Menu>
    )
}

export { MenuTab, MenuTabOption }