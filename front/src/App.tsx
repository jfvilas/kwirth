import { useState, useRef, ChangeEvent, useEffect } from 'react';

// material & icons
import { AppBar, Box, Button, Drawer, IconButton, Stack, Tab, Tabs, TextField, Toolbar, Tooltip, Typography } from '@mui/material';
import { Settings as SettingsIcon, Clear, Menu, Person } from '@mui/icons-material';

// model
import { User } from './model/User';
import { Alarm, AlarmType } from './model/Alarm';
import { LogObject } from './model/LogObject';
import { Cluster } from './model/Cluster';

// tools
import { SnackbarKey, closeSnackbar, enqueueSnackbar } from 'notistack';
import { Beep } from './tools/Beep';
import { PickListConfig } from './model/PickListConfig';

// components
import BlockingAlarm from './components/BlockingAlarm';
import AlarmConfig from './components/AlarmConfig';
import RenameLog from './components/RenameLog';
import SaveView from './components/SaveView';
import ManageApiSecurity from './components/ManageApiSecurity';
import PickList from './components/PickList';
import Login from './components/Login';
import ManageClusters from './components/ManageClusters';
import ManageUserSecurity from './components/ManageUserSecurity';
import ManageAlarms from './components/ManageAlarms';
import ResourceSelector from './components/ResourceSelector';
import LogContent from './components/LogContent';
import SettingsConfig from './components/SettingsConfig';
import { MenuLog, MenuLogOption } from './menus/MenuLog';
import { MenuDrawer, MenuDrawerOption } from './menus/MenuDrawer';
import { VERSION } from './version';
import { MsgBoxButtons, MsgBoxOk, MsgBoxYesNo } from './tools/MsgBox';
import { Message } from './model/Message';
import { Settings } from './model/Settings';
import { SessionContext, SessionContextType } from './model/SessionContext';
import { flushSync } from 'react-dom';

const App: React.FC = () => {
    var backendUrl='http://localhost:3883';
    const rootPath = window.__PUBLIC_PATH__ || '';
    if ( process.env.NODE_ENV==='production') backendUrl=window.location.protocol+'//'+window.location.host;
    backendUrl=backendUrl+rootPath;

    const [user, setUser] = useState<User>();
    const [logged,setLogged]=useState(false);
    const [accessKey,setAccessKey]=useState('');
    const [msgBox, setMsgBox] =useState(<></>);

    const [clusters, setClusters] = useState<Cluster[]>();
    const clustersRef = useRef(clusters);
    clustersRef.current=clusters;

    const [logs, setLogs] = useState<LogObject[]>([]);
    const [highlightedLogs, setHighlightedLogs] = useState<LogObject[]>([]);
    const [pausedLogs, setPausedLogs] = useState<LogObject[]>([]);

    const [selectedLogName, setSelectedLogName] = useState<string>();
    const selectedLogRef = useRef(selectedLogName);
    selectedLogRef.current=selectedLogName;
    var selectedLog = logs.find(t => t.name===selectedLogName);
    var selectedLogIndex = logs.findIndex(t => t.name===selectedLogName);

    // message list management
    const [messages, setMessages] = useState<Message[]>([]);  //+++ i think this is not being used right now
    //const searchLineRef = useRef(null);
    const lastLineRef = useRef(null);

    // search & filter
    const [filter, setFilter] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    // const [searchPos, setSearchPos] = useState<number>(0);
    // const [searchFirstPos, setSearchFirstPos] = useState<number>(-1);
    // const [searchLastPos, setSearchLastPos] = useState<number>(-1);

    // general
    const [settings, setSettings] = useState<Settings>();
    const settingsRef = useRef(settings);
    settingsRef.current=settings;

    // menus/navigation
    const [anchorMenuLog, setAnchorMenuLog] = useState<null | HTMLElement>(null);
    const [menuDrawerOpen,setMenuDrawerOpen]=useState(false);

    // dialogs
    const [pickListConfig, setPickListConfig] = useState<PickListConfig|null>(null);
    var pickListConfigRef=useRef(pickListConfig);
    pickListConfigRef.current=pickListConfig;

    // components
    const [showAlarmConfig, setShowAlarmConfig]=useState<boolean>(false);
    const [showBlockingAlarm, setShowBlockingAlarm]=useState<boolean>(false);
    const [showRenameLog, setShowRenameLog]=useState<boolean>(false);
    const [showManageClusters, setShowManageClusters]=useState<boolean>(false);
    const [showSaveView, setShowSaveView]=useState<boolean>(false);
    const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false);
    const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false);
    const [showManageAlarms, setShowManageAlarms]=useState<boolean>(false);
    const [showSettingsConfig, setShowSettingsConfig]=useState<boolean>(false);
    const [blockingAlarm, setBlockingAlarm] = useState<Alarm>();
    const [viewLoaded, setViewLoaded] = useState<boolean>(false);
    const [currentViewName, setCurrentViewName] = useState('');
    const [showPickList, setShowPickList]=useState<boolean>(false);
    
    useEffect ( () => {
        //+++ add a settings section for a log object (like settings, but specific)
        //+++ work on alarms and create and alarm manager
        //+++ when a view is loaded all messages are received: alarms should not be in effect until everything is received
        //+++ implement role checking on backend
        //+++ with ephemeral logs, the content of 'messages' should contain some info on alarms triggered, or even a dashboard (ephemeral logs do not contains log lines)
        //+++ plan to use kubernetes metrics for alarming based on resource usage (basic kubernetes metrics on pods and nodes)
        //+++ decide wether to have collapsibility on the resource selector and the toolbar (to maximize log space)
        //+++ add options to asterisk lines containing a specific text (like 'password', 'pw', etc...)

        if (logged) {
            if (!clustersRef.current) getClusters();
            if (!settingsRef.current) readSettings();
        }
    });

    useEffect ( () => {
        if (logged) {
        setViewLoaded(false);
        if (logs.length>0) {
            for (var t of logs)
            startLog(t);
            onChangeLogs(null, logs[0].name);
        }
        }
    }, [viewLoaded]);

    // useEffect ( () => {
    //     if (searchLineRef.current) (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'center' });
    // }, [search]);

    const getClusters = async () => {
        // get current cluster
        var response = await fetch(`${backendUrl}/config/cluster`, {headers:{Authorization:'Bearer '+accessKey}});
        var srcCluster = await response.json() as Cluster;
        srcCluster.url=backendUrl;
        srcCluster.accessKey=accessKey;
        srcCluster.source=true;

        // get previously configured clusters
        var clusterList:Cluster[]=[];
        var response = await fetch (`${backendUrl}/store/${user?.id}/clusters/list`, {headers:{Authorization:'Bearer '+accessKey}});
        if (response.status===200) {
        clusterList=JSON.parse (await response.json());
        clusterList=clusterList.filter (c => c.name!==srcCluster.name);
        }

        clusterList.push(srcCluster);
        setClusters(clusterList);
    }

    const readSettings = async () => {
        var resp=await fetch (`${backendUrl}/store/${user?.id}/settings/general`, {headers:{Authorization:'Bearer '+accessKey}});
        if (resp.status===200) {
        var json=await resp.json();
        if (json) {
            var readSettings:Settings=JSON.parse(json) as Settings;
            setSettings(readSettings);
        }
        }
        else {
        setSettings(new Settings());
        writeSettings(new Settings());
        }
    }

    const writeSettings = async (newSettings:Settings) => {
        setSettings(newSettings);
        var payload=JSON.stringify(newSettings);
        fetch (`${backendUrl}/store/${user?.id}/settings/general`, {method:'POST', body:payload, headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessKey}});
    }

    const onResourceSelectorAdd = (selection:any) => {
        var logName=selection.logName;

        // create unduplicated (unique) name
        var index=-1;
        while (logs.find (l => l.name===logName+index)) index-=1;

        var newLog:LogObject= new LogObject();
        newLog.cluster=selection.clusterName;
        newLog.scope=selection.scope;
        newLog.namespace=selection.namespace;
        newLog.set=selection.set;
        newLog.pod=selection.pod;
        newLog.container=selection.container;
        newLog.name=logName+index;

        logs.push(newLog);
        setMessages([]);
        setLogs(logs);
        setSelectedLogName(newLog.name);
        setFilter('');
        setSearch('');
    };

    const onChangeLogs = (event:any,value:string)=> {
        var newlog = logs.find(log => log.name === value);
        if (newlog) {
        newlog.pending=false;
        setHighlightedLogs (highlightedLogs.filter(t => t.pending));
        setPausedLogs (pausedLogs.filter(log => log.paused));
        setFilter(newlog.filter);
        setMessages(newlog.messages);
        setLogs(logs);
        }
        setSelectedLogName(value);
    }

    // const wsOnMessage = (event:any) => {
    //   // find the log who this web socket belongs to, and add the new message
    //   var log=logs.find(log => log.ws!==null && log.ws===event.target);
    //   if (!log) return;
        
    //   var e:any={};
    //   try {
    //     e=JSON.parse(event.data);
    //   }
    //   catch (err) {
    //     console.log(err);
    //     console.log(event.data);
    //   }

    //   var msg=new Message(e.text);
    //   msg.cluster=log.cluster.name;
    //   msg.namespace=e.namespace;
    //   msg.resource=e.podName;
    //   log.messages.push(msg);
    //   while (log.messages.length>log.maxMessages) log.messages.splice(0,1);

    //   // if current log is displayed (focused), add message to the screen
    //   if (selectedLogRef.current === log.name) {
    //     if (!log.paused) {
    //       setMessages((prev) => [...prev, msg ]);
    //       if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' });
    //     }
    //   }
    //   else {
    //     // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
    //     if (log.showBackgroundNotification && !log.paused) {
    //       log.pending=true;
    //       setHighlightedLogs((prev)=> [...prev, log!]);
    //       setLogs(logs);
    //     }
    //   }

    //   for (var alarm of log.alarms) {
    //     if (msg.text.includes(alarm.expression)) {
    //       if (alarm.beep) Beep.beepError();
            
    //       if (alarm.type===AlarmType.blocking) {
    //         setBlockingAlarm(alarm);
    //         setShowBlockingAlarm(true);
    //       }
    //       else {
    //         // in the view action, implement scrollinto view for showing the message that caused the received alarm
    //         const action = (snackbarId: SnackbarKey | undefined) => (
    //           <>
    //             <Button onClick={() => { closeSnackbar(snackbarId); onChangeLogs(null,log?.name); }}>
    //               View
    //             </Button>
    //             <Button onClick={() => { closeSnackbar(snackbarId) }}>
    //               Dismiss
    //             </Button>
    //           </>
    //         );
    //         var opts:any={
    //           anchorOrigin:{ horizontal: 'center', vertical: 'bottom' },
    //           variant:alarm.severity,
    //           autoHideDuration:(alarm.type===AlarmType.timed? 3000:null),
    //           action: action
    //         };
    //         enqueueSnackbar(alarm.message, opts);
    //       }
    //     }
    //   }
    // }

    const wsOnChunk = (event:any) => {
        // find the log who this web socket belongs to, and add the new message
        var log=logs.find(log => log.ws!==null && log.ws===event.target) as LogObject;
        if (!log) return;
        
        var e:any={};
        try {
            e=JSON.parse(event.data);
        }
        catch (err) {
            console.log(err);
            console.log(event.data);
            return;
        }

        var msg=new Message(log.buffer+e.text);

        msg.type=e.type;
        msg.cluster=log.cluster.name;
        msg.namespace=e.namespace;
        msg.resource=e.podName;
        log.messages.push(msg);
        while (log.messages.length>log.maxMessages) log.messages.splice(0,1);

        // if current log is displayed (focused), add message to the screen
        if (selectedLogRef.current === log.name) {
            if (!log.paused) {
                setMessages([]);  //+++ this forces LogContent to re-render +++ change to any other thing
                if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' });
            }
        }
        else {
            // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
            if (log.showBackgroundNotification && !log.paused) {
                log.pending=true;
                setHighlightedLogs((prev)=> [...prev, log!]);
                setLogs(logs);
            }
        }

        for (var alarm of log.alarms) {
            if (msg.text.includes(alarm.expression)) {
                if (alarm.beep) Beep.beepError();
                
                if (alarm.type===AlarmType.blocking) {
                    setBlockingAlarm(alarm);
                    setShowBlockingAlarm(true);
                }
                else {
                    // in the view action, implement scrollinto view for showing the message that caused the received alarm
                    const action = (snackbarId: SnackbarKey | undefined) => (<>
                        <Button onClick={() => { closeSnackbar(snackbarId); onChangeLogs(null,log?.name); }}>
                            View
                        </Button>
                        <Button onClick={() => { closeSnackbar(snackbarId) }}>
                            Dismiss
                        </Button>
                    </>);
                    var opts:any={
                        anchorOrigin:{ horizontal: 'center', vertical: 'bottom' },
                        variant:alarm.severity,
                        autoHideDuration:(alarm.type===AlarmType.timed? 3000:null),
                        action: action
                    };
                    enqueueSnackbar(alarm.message, opts);
                }
            }
        }
    }

    const startLog = (log:LogObject) => {
        log.maxMessages=settings!.maxMessages;
        log.previous=settings!.previous;
        log.addTimestamp=settings!.timestamp;
        log.messages=[];
        var cluster=clusters!.find(c => c.name===log.cluster);
        if (!cluster) {
            console.log('nocluster');
            setMsgBox(MsgBoxOk('Kwirth',`Cluster set at log configuration ${log.cluster} does not exist.`, setMsgBox));
            return;
        }
        var ws = new WebSocket(cluster.url);
        log.ws=ws;
        ws.onopen = () => {
            console.log(`WS connected: ${ws.url}`);
            var payload={ 
                accessKey: cluster!.accessKey,
                scope: log.scope, 
                namespace: log.namespace, 
                set: log.set,
                pod: log.pod, 
                container: log.container, 
                timestamp: log.addTimestamp,
                previous: log.previous,
                maxMessages: log.maxMessages
            };
            ws.send(JSON.stringify(payload));
            log.started=true;
        };
        
        ws.onmessage = (event) => wsOnChunk(event);
        ws.onclose = (event) => console.log(`WS disconnected: ${ws.url}`);
        setMessages([]);
    }

    const onClickLogStart = () => {
        var log=logs.find(l => l.name===selectedLogRef.current);
        if (log) startLog(log);
        setAnchorMenuLog(null);
    }

    const stopLog = (log:LogObject) => {
        var endline='====================================================================================================';
        log.messages.push(new Message(endline));
        log.started=false;
        log.paused=false;
        if (log.ws) log.ws.close();
        setPausedLogs(logs.filter(t => t.paused));
        setMessages(log.messages);
    }

    const onClickLogStop = () => {    
        if (selectedLog) stopLog(selectedLog);
        setAnchorMenuLog(null);
    }

    const onClickLogRemove = () => {
        setAnchorMenuLog(null);
        if (selectedLog) {
        stopLog(selectedLog);
        if (logs.length===1)
            setMessages([]);
        else
            onChangeLogs(null,logs[0].name);
        setLogs(logs.filter(t => t!==selectedLog));
        }
    }

    const onClickLogPause = () => {
        if (selectedLog) {
        if (selectedLog.paused) {
            selectedLog.paused=false;
            setMessages(selectedLog.messages);
            setPausedLogs(logs.filter(t => t.paused));
        }
        else {
            selectedLog.paused=true;
            setPausedLogs( (prev) => [...prev, selectedLog!]);
        }
        }
        setAnchorMenuLog(null);
    }

    const onChangeFilter = (event:ChangeEvent<HTMLInputElement>) => {
        if (selectedLog) selectedLog.filter=event.target.value;
        setFilter(event.target.value);
    }

    const menuLogOptionSelected = (option: MenuLogOption) => {
        setAnchorMenuLog(null);
        switch(option) {
        case MenuLogOption.LogOrganizeRename:
            setShowRenameLog(true);
            break;
        case MenuLogOption.LogOrganizeMoveLeft:
            if (selectedLog) {
                logs[selectedLogIndex]=logs[selectedLogIndex-1];
                logs[selectedLogIndex-1]=selectedLog;
                setLogs(logs);
            }
            break;
        case MenuLogOption.LogOrganizeMoveRight:
            if (selectedLog) {
                logs[selectedLogIndex]=logs[selectedLogIndex+1];
                logs[selectedLogIndex+1]=selectedLog;
                setLogs(logs);
            }
            break;
        case MenuLogOption.LogOrganizeMoveFirst:
            if (selectedLog) {
                logs.splice(selectedLogIndex, 1);
                logs.splice(0, 0, selectedLog);
                setLogs(logs);
            }
            break;  
        case MenuLogOption.LogOrganizeMoveLast:
            if (selectedLog) {
                logs.splice(selectedLogIndex, 1);
                logs.push(selectedLog);
                setLogs(logs);
            }
            break;
        case MenuLogOption.LogOptionsBackground:
            if (selectedLog) selectedLog.showBackgroundNotification=!selectedLog.showBackgroundNotification;
            break;
        case MenuLogOption.LogOptionsTimestamp:
            if (selectedLog) selectedLog.addTimestamp=!selectedLog.addTimestamp;
            break;
        case MenuLogOption.LogAlarmCreate:
            setShowAlarmConfig(true);
            break;
        case MenuLogOption.LogManageAlarms:
            setShowManageAlarms(true);
            break;
        case MenuLogOption.LogOrganizeDefault:
            if (selectedLog) selectedLog.defaultLog=true;
            break;
        case MenuLogOption.LogActionsStart:
            onClickLogStart();
            break;
        case MenuLogOption.LogActionsPause:
            onClickLogPause();
            break;
        case MenuLogOption.LogActionsStop:
            onClickLogStop();
            break;
        case MenuLogOption.LogActionsRemove:
            onClickLogRemove();
            break;
        case MenuLogOption.LogManageRestart:
            switch(selectedLog?.scope) {
            case 'cluster':
                break;
            case 'namespace':
                break;
            case 'set':
                // restart a deployment
                fetch (`${backendUrl}/manage/${selectedLog.namespace}/${selectedLog.pod}`, {method:'POST', body:'', headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessKey}});
                break;
            }
            break;
        }
    };

    const saveView = (viewName:string) => {
        var newLogs:LogObject[]=[];
        for (var log of logs) {
        var newLog = new LogObject();
        newLog.addTimestamp=log.addTimestamp;
        newLog.alarms=log.alarms;
        newLog.cluster=log.cluster;
        newLog.filter=log.filter;
        newLog.namespace=log.namespace;
        newLog.set=log.set;
        newLog.pod=log.pod;
        newLog.container=log.container;
        newLog.defaultLog=log.defaultLog;
        newLog.paused=log.paused;
        newLog.scope=log.scope;
        newLog.showBackgroundNotification=log.showBackgroundNotification;
        newLog.started=log.started;
        newLog.name=log.name;
        newLogs.push(newLog);
        }
        var payload=JSON.stringify(newLogs);
        fetch (`${backendUrl}/store/${user?.id}/views/${viewName}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessKey}});
        if (currentViewName!==viewName) setCurrentViewName(viewName);
    }

    const showNoViews = () => {
        setMsgBox(MsgBoxOk('View management','You have no views stored in your personal Kwirth space', setMsgBox));
    }

    const loadView = async () => {
        var allViews:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/views`, {headers:{Authorization:'Bearer '+accessKey}})).json();
        if (allViews.length===0)
            showNoViews();
        else
            pickList('Load view...','Please, select the view you want to load:',allViews,loadViewSelected);
    }

    const clearLogs = () => {
        for (var t of logs) {
            stopLog(t);
        }
        setLogs([]);
        setMessages([]);
    }

    const menuViewOptionSelected = async (option:MenuDrawerOption) => {
        setMenuDrawerOpen(false);
        switch(option) {
        case MenuDrawerOption.New:
            clearLogs();
            setCurrentViewName('untitled');
            break;
        case MenuDrawerOption.Save:
            if (currentViewName!=='' && currentViewName!=='untitled')
            saveView(currentViewName);
            else
            setShowSaveView(true);
            break;
        case MenuDrawerOption.SaveAs:
            setShowSaveView(true);
            break;
        case MenuDrawerOption.Open:
            loadView();
            break;
        case MenuDrawerOption.Delete:
            var allViews:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/views`, {headers:{Authorization:'Bearer '+accessKey}})).json();
            if (allViews.length===0)
                showNoViews();
            else
                pickList('View delete...','Please, select the view you want to delete:',allViews,deleteViewSelected);
            break;
        case MenuDrawerOption.ManageCluster:
            setShowManageClusters(true);
            break;
        case MenuDrawerOption.ApiSecurity:
            setShowApiSecurity(true);
            break;
        case MenuDrawerOption.UserSecurity:
            setShowUserSecurity(true);
            break;
        case MenuDrawerOption.Export:
            var allViews:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/views`, {headers:{Authorization:'Bearer '+accessKey}})).json();
            if (allViews.length===0) {
                showNoViews();
            }
            else {
                var content:any={};
                for (var viewName of allViews) {
                    var readView = await (await fetch (`${backendUrl}/store/${user?.id}/views/${viewName}`, {headers:{Authorization:'Bearer '+accessKey}})).json();
                    content[viewName]=JSON.parse(readView);
                }
                handleDownload(JSON.stringify(content),`${user?.id}-export-${new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString()}.kwirth.json`);
            }
            break;
        case MenuDrawerOption.Import:
            // nothing to do, the menuitem launches the handleUpload
            break;
        case MenuDrawerOption.Settings:
            selectedLog=new LogObject();
            selectedLog.maxMessages=10001;
            selectedLog.previous=true;
            setShowSettingsConfig(true);
            break;
        case MenuDrawerOption.UpdateKwirth:
            setMsgBox(MsgBoxYesNo('Update Kwirth',`This action will restart the Kwirth instance and users won't be able to work during 7 to 10 seconds. In addition, all volatile API keys will be deleted. Do you want to continue?`,setMsgBox, (button) => {
                if (button===MsgBoxButtons.Yes) {
                    fetch (`${backendUrl}/managekwirth/restart`, {headers:{Authorization:'Bearer '+accessKey}});
                }
            }));
            break;
        case MenuDrawerOption.Exit:
            setLogged(false);
            break;
        }
    };

    const deleteViewSelected = (viewName:string) => {
        setMsgBox(MsgBoxYesNo('Delete view',`Are you ure you want to delete view ${viewName}`,setMsgBox, (button) => {
            if (button===MsgBoxButtons.Yes) {
                fetch (`${backendUrl}/store/${user?.id}/views/${viewName}`, {method:'DELETE', headers:{Authorization:'Bearer '+accessKey}});
                setCurrentViewName('');
            }
        }));
    }

    const handleDownload = (content:string,filename:string,  mimeType:string='text/plain') => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    const handleUpload = (event:any) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e:any) => {
                var allViews=JSON.parse(e.target.result);
                for (var viewName of Object.keys(allViews)) {
                    var payload=JSON.stringify(allViews[viewName]);
                    fetch (`${backendUrl}/store/${user?.id}/views/${viewName}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json', Authorization:'Bearer '+accessKey}});
                }
            };
            reader.readAsText(file);
        }
    }

    const alarmConfigClosed = (alarm:Alarm) => {
        setShowAlarmConfig(false);
        if (alarm.expression) {
            var al=new Alarm();
            al.expression=alarm.expression;
            al.severity=alarm.severity;
            al.message=alarm.message;
            al.type=alarm.type;
            al.beep=alarm.beep;
            selectedLog?.alarms.push(al);
        }
    }

    const settingsClosed = (newSettings:Settings) => {
        setShowSettingsConfig(false);
        if (newSettings) writeSettings(newSettings);
    }

    const renameLogClosed = (newname:string|null) => {
        setShowRenameLog(false);
        if (newname!=null) {
            selectedLog!.name=newname;
            setLogs(logs);
            setSelectedLogName(newname);
        }
    }

    const saveViewClosed = (viewName:string|null) => {
        setShowSaveView(false);
        if (viewName!=null) saveView(viewName);
    }

    const loadViewSelected = async (viewName:string) => {
        if (viewName) {
            clearLogs();
            var n = await (await fetch (`${backendUrl}/store/${user?.id}/views/${viewName}`, {headers:{Authorization:'Bearer '+accessKey}})).json();
            var newLogs=JSON.parse(n) as LogObject[];
            setLogs(newLogs);
            setViewLoaded(true);
            setCurrentViewName(viewName);
            var defaultLog=newLogs.find(l => l.defaultLog);
            if (defaultLog) setSelectedLogName(defaultLog.name);
        }
    }

    const pickList = (title:string, message:string, values:string[], onClose:(a:string) => void ) =>{
        var plc:PickListConfig=new PickListConfig();
        plc.title=title;
        plc.message=message;
        plc.values=values;
        plc.originOnClose=onClose;
        plc.onClose=pickListClosed;
        setPickListConfig(plc);
        setShowPickList(true);
    }

    const pickListClosed = (a:string|null) => {
        setShowPickList(false);
        if (a!==null) pickListConfigRef?.current?.originOnClose(a);
        setPickListConfig(null);
    }

    const manageClustersClosed = (cc:Cluster[]) => {
        setShowManageClusters(false);
        fetch (`${backendUrl}/store/${user?.id}/clusters/list`, {method:'POST', body:JSON.stringify(cc), headers:{'Content-Type':'application/json', Authorization:'Bearer '+accessKey}});
        setClusters(cc);
    }

    const onCloseLogin = (result:boolean, user:User, accessKey:string) => {
        if (result) {
            setLogged(true);
            setUser(user);
            setAccessKey(accessKey);
            setCurrentViewName('untitled');
            clearLogs();
        }
    }

    // const onChangeSearch = (event:ChangeEvent<HTMLInputElement>) => {
    //     var newsearch=event.target.value;
    //     setSearch(newsearch);
    //     if (newsearch!=='') {
    //     var pos=selectedLog!.messages.findIndex(m => m.text.includes(newsearch));
    //     setSearchFirstPos(pos);
    //     setSearchLastPos(selectedLog!.messages.findLastIndex(m => m.text.includes(newsearch)));
    //     setSearchPos(pos);
    //     if (searchLineRef.current) (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'center' });
    //     }
    // }

    // const onClickSearchDown = () => {
    //     var pos=messages!.findIndex( (msg,index) => msg.text.includes(search) && index>searchPos);
    //     if (pos>=0) {
    //     setSearchPos(pos);
    //     (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'center' });
    //     }
    // }

    // const onClickSearchUp = () => {
    //     var pos=messages!.findLastIndex( (msg,index) => msg.text.includes(search) && index<searchPos);
    //     if (pos>=0) {
    //     setSearchPos(pos);
    //     (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'center' })
    //     }
    // }

    if (!logged) return (<>
        <div style={{ backgroundImage:`url('./turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
            <SessionContext.Provider value={{ user, accessKey, logged, backendUrl }}>
                <Login onClose={onCloseLogin}></Login>
            </SessionContext.Provider>
        </div>
    </>);

    return (<>
        <SessionContext.Provider value={{ user, accessKey, logged, backendUrl }}>
            <AppBar position="sticky" elevation={0} sx={{ zIndex: 99, height:'64px' }}>
                <Toolbar>
                <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 1 }} onClick={() => setMenuDrawerOpen(true)}><Menu /></IconButton>
                <Typography sx={{ ml:1,flexGrow: 1 }}>KWirth</Typography>
                <Typography variant="h6" component="div" sx={{mr:2}}>{currentViewName}</Typography>
                <Tooltip title={<div style={{textAlign:'center'}}>{user?.id}<br/>{user?.name}</div>} sx={{ mr:2 }}><Person/></Tooltip>
                </Toolbar>
            </AppBar>

            <Drawer sx={{  flexShrink: 0,  '& .MuiDrawer-paper': { mt: '64px' }  }} anchor="left" open={menuDrawerOpen} onClose={() => setMenuDrawerOpen(false)}>
                <Stack direction={'column'}>
                <MenuDrawer optionSelected={menuViewOptionSelected} uploadSelected={handleUpload} user={user}/>
                <Typography fontSize={'small'} color={'#cccccc'} sx={{ml:1}}>Version: {VERSION}</Typography>
                </Stack>
            </Drawer>

            <Box sx={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
                <ResourceSelector clusters={clusters} onAdd={onResourceSelectorAdd} sx={{ mt:1, ml:3, mr:3 }}/>
                <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>          
                    <Tabs value={selectedLogName} onChange={onChangeLogs} variant="scrollable" scrollButtons="auto" sx={{ml:1}}>
                    { logs.length>0 && logs.map(t => {
                        if (t===selectedLog) {
                            return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton onClick={(event) => setAnchorMenuLog(event.currentTarget)}><SettingsIcon fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                        }
                        else {
                            return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton><Box sx={{minWidth:'20px'}} /></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                        }
                        })
                    }
                    </Tabs>

                    <Typography sx={{ flexGrow: 1 }}></Typography>

                    { (logs.length>0) && <>
                        <Stack direction="row" alignItems="bottom" sx={{ width:'200px', mr:1}}>
                        <TextField value={filter} onChange={onChangeFilter} InputProps={{ endAdornment: <IconButton onClick={()=>setFilter('')}><Clear fontSize='small'/></IconButton> }} label="Filter" variant="standard"/>

                        {/* <TextField value={search} onChange={onChangeSearch} InputProps={{ endAdornment: <IconButton onClick={()=>setSearch('')}><Clear fontSize='small'/></IconButton> }} sx={{ml:1}} label="Search" variant="standard" />
                        <Typography sx={{ ml:1 }}></Typography>
                        <IconButton onClick={onClickSearchUp} disabled={search==='' || searchFirstPos===searchPos}><ArrowUpward/> </IconButton>
                        <IconButton onClick={onClickSearchDown} disabled={search===''  || searchLastPos===searchPos}><ArrowDownward/> </IconButton> */}

                        </Stack>
                    </>}

                </Stack>
                { anchorMenuLog && <MenuLog onClose={() => setAnchorMenuLog(null)} optionSelected={menuLogOptionSelected} anchorMenuLog={anchorMenuLog} logs={logs} selectedLog={selectedLog} selectedLogIndex={selectedLogIndex} />}
                {/* <LogContent log={selectedLog} filter={filter} search={search} searchPos={searchPos} searchLineRef={searchLineRef} lastLineRef={lastLineRef}/> */}
                <LogContent log={selectedLog} filter={filter} search={search} lastLineRef={lastLineRef}/>
            </Box>

            { showAlarmConfig && <AlarmConfig onClose={alarmConfigClosed} expression={filter}/> }
            { showBlockingAlarm && <BlockingAlarm onClose={() => setShowBlockingAlarm(false)} alarm={blockingAlarm} /> }
            { showRenameLog && <RenameLog onClose={renameLogClosed} logs={logs} oldname={selectedLog?.name}/> }
            { showSaveView && <SaveView onClose={saveViewClosed} name={currentViewName} /> }
            { showManageClusters && <ManageClusters onClose={manageClustersClosed} clusters={clusters}/> }
            { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} /> }
            { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} /> }
            { showManageAlarms && <ManageAlarms onClose={() => setShowManageAlarms(false)} log={selectedLog}/> }
            { showSettingsConfig && <SettingsConfig  onClose={settingsClosed} settings={settings} /> }
            { pickListConfig!==null && <PickList config={pickListConfig}/> }
            { msgBox }
        </SessionContext.Provider>
    </>);
};

export default App;