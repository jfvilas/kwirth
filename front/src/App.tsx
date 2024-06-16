import React, { useState, useRef, ChangeEvent, useEffect } from 'react';

// material & icons
import { Collapse, Box, Button, Divider, IconButton, Menu, MenuItem, MenuList, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Check, KeyboardArrowDown, Pause, PlayArrow, RemoveCircleRounded,  Settings, Start, Stop, Info, ArrowUpward, ArrowDownward, ExpandLess, ExpandMore, Clear } from '@mui/icons-material';

// model
import { Alert } from './model/Alert';
import { LogObject } from './model/LogObject';
import { Cluster } from './model/Cluster';

// tools
import { SnackbarKey, closeSnackbar, enqueueSnackbar } from 'notistack';
import { Beep } from './tools/Beep';
import { PickListConfig } from './model/PickListConfig';
import { PopupConfig } from './model/PopupConfig';

// components
import BlockingAlert from './components/BlockingAlert';
import AlertConfig from './components/AlertConfig';
import RenameLog from './components/RenameLog';
import SaveConfig from './components/SaveConfig';
import ManageApiSecurity from './components/ManageApiSecurity';
import PickList from './components/PickList';
import Popup from './components/Popup';
import Login from './components/Login';
import ManageClusters from './components/ManageClusters';
import ManageUserSecurity from './components/ManageUserSecurity';
import MenuMain from './menus/MenuMain';
import Selector from './menus/ResourceSelector';


const App: React.FC = () => {
  var backend='http://localhost:3883';
  if ( process.env.NODE_ENV==='production') backend=window.location.protocol+'//'+window.location.host;

  const [user, setUser] = useState<string>('');
  const [logged,setLogged]=useState(false);
  const [apiKey,setApiKey]=useState('');

  
  const [pickListConfig, setPickListConfig] = useState<PickListConfig|null>(null);
  var pickListConfigRef=useRef(pickListConfig);
  pickListConfigRef.current=pickListConfig;

  const [popupConfig, setPopupConfig] = useState<PopupConfig|null>(null);
  var popupConfigRef=useRef(popupConfig);
  popupConfigRef.current=popupConfig;

  const [currentCluster, setCurrentCluster] = useState<Cluster>();
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
  const [paused, setPaused] = useState<boolean>(false);
  const [messages, setMessages] = useState<string[]>([]);
  const searchLineRef = useRef(null);
  const lastLineRef = useRef(null);


  const [startDisabled, setStartDisabled] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(false);

  
  // search & filter
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [searchPos, setSearchPos] = useState<number>(0);
  const [searchFirstPos, setSearchFirstPos] = useState<number>(-1);
  const [searchLastPos, setSearchLastPos] = useState<number>(-1);

  // menus
  const [anchorMenuConfig, setAnchorMenuConfig] = React.useState<null | HTMLElement>(null);
  const menuConfigOpen = Boolean(anchorMenuConfig);
  const [anchorMenuLogs, setAnchorMenuLogs] = React.useState<null | HTMLElement>(null);
  const menuLogsOpen = Boolean(anchorMenuLogs);

  const [showAlertConfig, setShowAlertConfig]=useState<boolean>(false);
  const [showBlockingAlert, setShowBlockingAlert]=useState<boolean>(false);
  const [showRenameLog, setShowRenameLog]=useState<boolean>(false);
  const [showManageClusters, setShowManageClusters]=useState<boolean>(false);
  const [showSaveConfig, setShowSaveConfig]=useState<boolean>(false);
  const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false);
  const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false);
  const [blockingAlert, setBlockingAlert] = useState<Alert>();
  const [configLoaded, setConfigLoaded] = useState<boolean>(false);
  const [configName, setConfigName] = useState('');

  // dialog tools
  const [showPickList, setShowPickList]=useState<boolean>(false);
  const [showPopup, setShowPopup]=useState<boolean>(false);


  useEffect ( () => {
    if (logged && !clustersRef.current) getClusters();
  });

  useEffect ( () => {
    if (logged) {
      setConfigLoaded(false);
      if (logs.length>0) {
        for (var t of logs) {
          start(t);
        }
        onChangeLogs(null, logs[0].name);
      }
    }
  }, [configLoaded]);

  const getClusters = async () => {
    // get current cluster
    var response = await fetch(`${backend}/config/cluster`, { headers:{Auhtorization:apiKey}});
    var srcCluster = await response.json() as Cluster;
    srcCluster.url=backend;
    srcCluster.source=true;
    srcCluster.apiKey=apiKey;
    setCurrentCluster(srcCluster);

    // get previously configured clusters
    var clusterList:Cluster[]=[];
    var data=localStorage.getItem('kwirth.clusters');
    if (data) clusterList=JSON.parse(data);
    clusterList=clusterList.filter (c => c.name!==srcCluster.name);
    for (var c of clusterList) {
      if (c.source) delete c.source;
    }
    clusterList.push(srcCluster);
    localStorage.setItem('kwirth.clusters', JSON.stringify(clusterList));
    setClusters(clusterList);
  }

  const onSelectorAdd = (selection:any) => {
    var logName=selection.namespace+"-"+selection.resource;
    if (selection.scope==='cluster') logName='cluster';

    // create unduplicated name
    var index=-1;
    while (logs.find (l => l.name===logName+index)) index-=1;

    var newLog:LogObject= new LogObject();
    newLog.cluster=selection.clusterName;
    newLog.scope=selection.scope;
    newLog.namespace=selection.namespace;
    newLog.obj=selection.resource;
    newLog.name=logName+index;

    logs.push(newLog);
    setMessages(['Start log reciever...']);
    setLogs(logs);
    setSelectedLogName(newLog.name);
    setPaused(false);
    setStartDisabled(false);
    setControlsVisible(true);
    setFilter('');
  };

  const onChangeLogs = (event:any,value:string)=> {
    var newlog = logs.find(log => log.name === value);
    if (newlog) {
      newlog.pending=false;
      setHighlightedLogs (highlightedLogs.filter(t => t.pending));
      setPausedLogs (pausedLogs.filter(log => log.paused));
      setPaused(newlog.paused);
      setFilter(newlog.filter);
      setMessages(newlog.messages);
      setStartDisabled(newlog.started);
      setLogs(logs);
    }
    setSelectedLogName(value);
  }

  const processEvent = (event:any) => {
    // find the log who this web socket belongs to, and add the new message
    var log=logs.find(log => log.ws!==null && log.ws===event.target);
    if (!log) return;
    
    var ev:any={};
    try {
      ev=JSON.parse(event.data);
    }
    catch (err) {
      console.log(err);
      console.log(event.data);
    }

    var text=ev.text;
    if (log) {
      if (log.addTimestamp) text=(new Date()).toISOString().replace('T',' ').replace('Z','') + ' ' + text;
      log.messages.push(text);
    }
    else {
      console.log('log not found');
      return;
    }

    // if this log is displayed (focused), add message to the screen
    if (selectedLogRef.current === log?.name) {
      if (!log?.paused) {
        setMessages( (prev) => [...prev, text ]);
        if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      else {
        // log is paused, so we show nothing;
      }
    }
    else {
      // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
      if (log && log.showBackgroundNotification && !log.paused) {
        log.pending=true;
        setHighlightedLogs((prev)=> [...prev, log!]);
        setLogs(logs);
      }
    }

    // review alerts
    if (log) {
      for (var alert of log.alerts) {
        if (text.includes(alert.expression)) {
          if (alert.beep) {
            Beep.beepError();
          }
          
          if (alert.type==='blocking') {
            setBlockingAlert(alert);
            setShowBlockingAlert(true);
          }
          else {
            const action = (snackbarId: SnackbarKey | undefined) => (
              <>
                <Button onClick={() => { closeSnackbar(snackbarId); onChangeLogs(null,log?.name); }}>
                  View
                </Button>
                <Button onClick={() => { closeSnackbar(snackbarId) }}>
                  Dismiss
                </Button>
              </>
            );
            var opts:any={
              anchorOrigin:{ horizontal: 'center', vertical: 'bottom' },
              variant:alert.severity,
              autoHideDuration:(alert.type==='timed'? 3000:null),
              action: action
            };
            enqueueSnackbar(alert.message, opts);
          }
        }
      }
    }
  }

  const start = (lo:LogObject) => {
    lo.messages=[];
    var cluster=clusters!.find(c => c.name===lo.cluster);
    if (!cluster) {
      console.log('nocluster');
      return;
    }
    var ws = new WebSocket(cluster.url+'?key='+cluster.apiKey);
    lo.ws=ws;
    ws.onopen = () => {
      console.log(`Connected to the WebSocket: ${ws.url}`);
      var payload={ scope:lo?.scope, namespace:lo?.namespace, deploymentName:lo?.obj};
      if (lo) {
        ws.send(JSON.stringify(payload));
        lo.started=true;
      }
      else {
        console.log('no loobject');
      }
    };
    
    ws.onmessage = (event) => processEvent(event);

    ws.onclose = (event) => {
      console.log(`Disconnected from the WebSocket: ${ws.url}`);
    };

    setMessages([]);
    setStartDisabled(true);
  }

  const onClickLogStart = () => {
    var lo=logs.find(t => t.name===selectedLogRef.current);
    if (lo) start(lo);
    setAnchorMenuLogs(null);
  }

  const stop = (log:LogObject) => {
    var endline='====================================================================================================';
    log.messages.push(endline);
    log.paused=false;
    setPausedLogs(logs.filter(t => t.paused));
    setMessages((prev) => [...prev,endline]);
    if (!log) {
      console.log('nto');
    }
    log.ws?.close();
    setStartDisabled(false);
  }

  const onClickLogStop = () => {    
    if (selectedLog) stop(selectedLog);
    setAnchorMenuLogs(null);
  }

  const onClickLogRemove = () => {
    if (selectedLog) {
      onClickLogStop();
      if (logs.length===1) {
        setControlsVisible(false);
        setMessages([]);
      }
      else {
        onChangeLogs(null,logs[0].name);
      }
      setLogs(logs.filter(t => t!==selectedLog));
    }
    setAnchorMenuLogs(null);
  }

  const onClickLogPauseResume = () => {
    if (selectedLog) {
      if (selectedLog.paused) {
        selectedLog.paused=false;
        setMessages(selectedLog.messages);
        setPausedLogs(logs.filter(t => t.paused));
        setPaused(false);
        setLogs(logs);
      }
      else {
        selectedLog.paused=true;
        setPausedLogs( (prev) => [...prev, selectedLog!]);
        setPaused(true);
        setLogs(logs);
      }
    }
    setAnchorMenuLogs(null);
  }

  const onChangeFilter = (event:ChangeEvent<HTMLInputElement>) => {
    setFilter(event.target.value);
    if (selectedLog) selectedLog.filter=event.target.value;
  }

  const onChangeSearch = (event:ChangeEvent<HTMLInputElement>) => {
    var newsearch=event.target.value;
    if (newsearch!=='') {
      var first=selectedLog!.messages.findIndex(m => m.includes(newsearch));
      setSearchFirstPos(first);
      setSearchLastPos(selectedLog!.messages.findLastIndex(m => m.includes(newsearch)));
      setSearchPos(first);
      if (searchLineRef.current) (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    else {
      if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ alignToTop:false, behavior: 'smooth', block: 'start' });
    }
    setSearch(newsearch);
  }

  const onClickSearchDown = () => {
    var i=messages!.findIndex( (m,i) => m.includes(search) && i>searchPos);
    if (i>=0) {
      setSearchPos(i);
      (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const onClickSearchUp = () => {
    var i=messages!.findLastIndex( (m,i) => m.includes(search) && i<searchPos);
    if (i>=0) {
      setSearchPos(i);
      (searchLineRef.current as any).scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const onClickMenuLogsOption = (option: string) => {
    switch(option) {
      case 'ml':
        if (selectedLog) {
          logs[selectedLogIndex]=logs[selectedLogIndex-1];
          logs[selectedLogIndex-1]=selectedLog;
          setLogs(logs);
        }
        break;
      case 'mr':
        if (selectedLog) {
          logs[selectedLogIndex]=logs[selectedLogIndex+1];
          logs[selectedLogIndex+1]=selectedLog;
          setLogs(logs);
        }
        break;
      case 'ms':
        if (selectedLog) {
          logs.splice(selectedLogIndex, 1);
          logs.splice(0, 0, selectedLog);
          setLogs(logs);
        }
        break;  
      case 'me':
        if (selectedLog) {
          logs.splice(selectedLogIndex, 1);
          logs.push(selectedLog);
          setLogs(logs);
        }
        break;
      case 'dbn':
        if (selectedLog) {
          selectedLog.showBackgroundNotification=!selectedLog.showBackgroundNotification;
          setLogs(logs);
        }
        break;
      case 'ats':
        if (selectedLog) {
          selectedLog.addTimestamp=!selectedLog.addTimestamp;
          setLogs(logs);
        }
        break;
      case 'cfa':
        setShowAlertConfig(true);
        break;
      case 'rt':
        setShowRenameLog(true);
        break;
      case 'dt':
        //+++ set default log
        break;
    }
    setSubmenuActionOpen(false);
    setSubmenuOptionsOpen(false);
    setSubmenuReorgOpen(false);
    setAnchorMenuLogs(null);
  };

  const saveConfig = (name:string) => {
    var newlos:LogObject[]=[];
    for (var lo of logs) {
      var newlo = new LogObject();
      newlo.addTimestamp=lo.addTimestamp;
      newlo.alerts=lo.alerts;
      newlo.cluster=lo.cluster;
      newlo.filter=lo.filter;
      newlo.namespace=lo.namespace;
      newlo.obj=lo.obj;
      newlo.default=lo.default;
      newlo.paused=lo.paused;
      newlo.scope=lo.scope;
      newlo.showBackgroundNotification=lo.showBackgroundNotification;
      newlo.started=lo.started;
      newlo.name=lo.name;
      newlos.push(newlo);
    }
    var payload=JSON.stringify(newlos);
    fetch (`${backend}/store/${user}/${name}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    if (configName!==name) setConfigName(name);
  }

  const showNoConfigs = () => {
    popup('Config management...',<Stack direction={'row'} alignItems={'center'}><Info  color='info' fontSize='large'/>&nbsp;You have no config stored in your local store</Stack>,true, false, false, false, false, false);
  }

  const loadConfig = async () => {
    var allConfigs:string[] = await (await fetch (`${backend}/store/${user}`)).json();
    if (allConfigs.length===0)
      showNoConfigs();
    else
      pickList('Load config...','Please, select the config you want to load:',allConfigs,loadConfigSelected);
  }

  var clear = () => {
    setControlsVisible(false);
    for (var t of logs) {
      stop(t);
    }
    setLogs([]);
    setMessages([]);

  }

  const menuConfigOptionSelected = async (option: string) => {
    switch(option) {
      case 'new':
        clear();
        setConfigName('untitled');
        break;
      case 'save':
        if (configName!=='' && configName!=='untitled')
          saveConfig(configName);
        else
          setShowSaveConfig(true);
        break;
      case 'saveas':
        setShowSaveConfig(true);
        break;
      case 'open':
        loadConfig();
        break;
      case 'delete':
        var allConfigs:string[] = await (await fetch (`${backend}/store/${user}`)).json();
        if (allConfigs.length===0)
          showNoConfigs();
        else
          pickList('Config delete...','Please, select the config you want to delete:',allConfigs,deleteConfigSelected);
        break;
      case 'mc':
        setShowManageClusters(true);
        break;
      case 'asec':
        setShowApiSecurity(true);
        break;
      case 'usec':
        setShowUserSecurity(true);
        break;
      case 'cfgexp':
        var allConfigs:string[] = await (await fetch (`${backend}/store/${user}`)).json();
        if (allConfigs.length===0)
          showNoConfigs();
        else {
          var content:any={};
          for (var cfg of allConfigs) {
            var readCfg = await (await fetch (`${backend}/store/${user}/${cfg}`)).json();
            content[cfg]=JSON.parse(readCfg);
          }
          handleDownload(JSON.stringify(content),`${user}-export-${new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString()}.kwirth.json`);
        }
        break;
      case 'cfgimp':
        // nothing to do, the menuitem launches the handleUpload
        break;
      case 'exit':
        setLogged(false);
        setAnchorMenuConfig(null);
        break;
    }
    setAnchorMenuConfig(null);
  };

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
          var allConfigs=JSON.parse(e.target.result);
          for (var cfg of Object.keys(allConfigs)) {
            var payload=JSON.stringify(allConfigs[cfg]);
            fetch (`${backend}/store/${user}/${cfg}`, {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
          }
        };
        reader.readAsText(file);
    }
    setAnchorMenuConfig(null);
  }

  const alertConfigClosed= (a:Alert) => {
    setShowAlertConfig(false);
    if (a.expression) {
        var alert=new Alert();
        alert.expression=a.expression;
        alert.severity=a.severity;
        alert.message=a.message;
        alert.type=a.type;
        alert.beep=a.beep;
        selectedLog?.alerts.push(alert);
        setLogs(logs);
      }
  }

  const renameLogClosed= (newname:string|null) => {
    setShowRenameLog(false);
    if (newname!=null) {
      selectedLog!.name=newname;
      setLogs(logs);
      //+++ poner foco en nuevo tab
    }
  }

  const saveConfigClosed = (newname:string|null) => {
    setShowSaveConfig(false);
    if (newname!=null) saveConfig(newname);
  }

  const loadConfigSelected = async (a:string) => {
    if (a) {
      clear();
      var n = await (await fetch (`${backend}/store/${user}/${a}`)).json();
      var newlos=JSON.parse(n) as LogObject[];
      setControlsVisible(true);
      setLogs(newlos);
      setConfigLoaded(true);
      setConfigName(a);
      //+++ habilitar el log que este marcado como default
    }
  }

  const deleteConfigSelected = (cfg:string) => {
    if (cfg) fetch (`${backend}/store/${user}/${cfg}`, {method:'DELETE'});
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

  const popup = (title:string, message:JSX.Element, ok:boolean, yes:boolean, yestoall:boolean, no:boolean, notoall:boolean, cancel:boolean, onClose:(a:string) => void = () => {} ) =>{
    var pc:PopupConfig=new PopupConfig();
    pc.title=title;
    pc.message=message;
    pc.ok=ok;
    pc.yes=yes;
    pc.yestoall=yestoall;
    pc.no=no;
    pc.notoall=notoall;
    pc.cancel=cancel;
    pc.originOnClose=onClose;
    pc.onClose=popupClosed;
    setPopupConfig(pc);
    setShowPopup(true);
  }

  const pickListClosed = (a:string|null) => {
    setShowPickList(false);
    if (a!==null) pickListConfigRef?.current?.originOnClose(a);
    setPickListConfig(null);
  }

  const popupClosed = (a:string|null) => {
    setShowPopup(false);
    if (a!==null) popupConfigRef?.current?.originOnClose(a);
    setPopupConfig(null);
  }

  const manageClustersClosed = (cc:Cluster[]) => {
    setShowManageClusters(false);
    localStorage.setItem('kwirth.clusters', JSON.stringify(cc));
    setClusters(cc);
  }

  const onCloseLogin = (result:boolean, apiKey:string, user:string) => {
    if (result) {
      setLogged(true); 
      setUser(user);
      setApiKey(apiKey);
      clear();
      setConfigName('untitled');
    }
  }

  const [subMenuReorg, setSubmenuReorgOpen] = React.useState(false)
  const [subMenuAction, setSubmenuActionOpen] = React.useState(false)
  const [subMenuOptions, setSubmenuOptionsOpen] = React.useState(false)

  const menuLogs=(
    <Menu id='menu-logs' anchorEl={anchorMenuLogs} open={menuLogsOpen} onClose={() => setAnchorMenuLogs(null)}>
      <MenuList dense sx={{width:'40vh'}}>
        <MenuItem key='cfa' onClick={() => onClickMenuLogsOption('cfa')} disabled={filter===''} sx={{ml:3}}>Convert filter to alert...</MenuItem>
        <Divider/>
        <MenuItem key='subopt' onClick={() => setSubmenuOptionsOpen(!subMenuOptions)} sx={{ml:3}}>Logging options<Typography sx={{flexGrow:1}}></Typography>{subMenuOptions ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
        <Collapse in={subMenuOptions} timeout="auto" unmountOnExit sx={{ml:5}}>
          <MenuItem key='dbn' onClick={() => onClickMenuLogsOption('dbn')} sx={{ml: selectedLog?.showBackgroundNotification?0:3}}>{ selectedLog?.showBackgroundNotification &&  <Check/>} Show background notifications</MenuItem>
          <MenuItem key='ats' onClick={() => onClickMenuLogsOption('ats')} sx={{ml: selectedLog?.addTimestamp?0:3}}>{ selectedLog?.addTimestamp &&  <Check/>} Add timestamp to messages</MenuItem>
        </Collapse>


        <MenuItem key='subreorg' onClick={() => setSubmenuReorgOpen(!subMenuReorg)} sx={{ml:3}}>Organize<Typography sx={{flexGrow:1}}></Typography>{subMenuReorg ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
        <Collapse in={subMenuReorg} timeout="auto" unmountOnExit sx={{ml:5}}>
          <MenuItem key='dt' onClick={() => onClickMenuLogsOption('dt')} disabled={selectedLogIndex<0}> {selectedLog?.default && <Check/>} Default log</MenuItem>
          <MenuItem key='rt' onClick={() => onClickMenuLogsOption('rt')} disabled={selectedLogIndex<0}>Rename log</MenuItem>
          <MenuItem key='ml' onClick={() => onClickMenuLogsOption('ml')} disabled={selectedLogIndex===0}>Move to left</MenuItem>
          <MenuItem key='mr' onClick={() => onClickMenuLogsOption('mr')} disabled={selectedLogIndex===logs.length-1}>Move to right</MenuItem>
          <MenuItem key='ms' onClick={() => onClickMenuLogsOption('ms')} disabled={selectedLogIndex===0}>Move to start</MenuItem>
          <MenuItem key='me' onClick={() => onClickMenuLogsOption('me')} disabled={selectedLogIndex===logs.length-1}>Move to end</MenuItem>
        </Collapse>
        
        <MenuItem key='subaction' onClick={() => setSubmenuActionOpen(!subMenuAction)} sx={{ml:3}}>Action<Typography sx={{flexGrow:1}}></Typography>{subMenuAction ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
        <Collapse in={subMenuAction} timeout="auto" unmountOnExit sx={{ml:5}}>
          <MenuItem key='logstart' onClick={onClickLogStart} disabled={startDisabled}><Start/>&nbsp;Start</MenuItem>
          <MenuItem key='logpr' onClick={onClickLogPauseResume} disabled={!startDisabled}>{paused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
          <MenuItem key='logstop' onClick={onClickLogStop} disabled={!startDisabled}><Stop/>&nbsp;Stop</MenuItem>
          <MenuItem key='logremove' onClick={onClickLogRemove} ><RemoveCircleRounded/>&nbsp;Remove</MenuItem>
        </Collapse>
      </MenuList>
    </Menu>
  );

  const showLogContent = () => {
    return (
      <Box sx={{ flex:1, overflowY: 'auto', ml:1 }}>
        <pre>
          {messages.map(m => {
            return m.includes(filter)? m : null;
          })
          .map((message, index) => {
            if (search!=='') {
              if (index===searchPos)
                return <div key={index} ref={searchLineRef} dangerouslySetInnerHTML={{__html: message!.replaceAll(search,'<span style=\'background-color:#0000ff\'>'+search+'</span>')}}></div>;
              else
                return <div key={index} ref={null} dangerouslySetInnerHTML={{__html: message!.replaceAll(search,'<span style=\'background-color:#ff0000\'>'+search+'</span>')}}></div>;
            }
            else {
              if (index===messages.length-1)
                return <><div key={index}>{message}</div><div key={-1} ref={lastLineRef} style={{ marginTop:'15px'}}>&nbsp;</div></>;
              else
                return <div key={index}>{message}</div>;
            }
          })}
        </pre>
      </Box>);
  }

  const showLogControls = () => {
    return (
      <Stack direction={'row'} alignItems={'end'}>
        { controlsVisible && <>
            <Stack direction="row" sx={{ ml:1}} alignItems="bottom" >
              <TextField value={filter} onChange={onChangeFilter} InputProps={{ endAdornment: <IconButton onClick={()=>setFilter('')}><Clear fontSize='small'/></IconButton> }} label="Filter" variant="standard"/>
              <TextField value={search} onChange={onChangeSearch} InputProps={{ endAdornment: <IconButton onClick={()=>setSearch('')}><Clear fontSize='small'/></IconButton> }} sx={{ml:1}} label="Search" variant="standard" />
              <Typography sx={{ ml:1 }}></Typography>
              <IconButton onClick={onClickSearchUp} disabled={search==='' || searchFirstPos===searchPos}><ArrowUpward/> </IconButton>
              <IconButton onClick={onClickSearchDown} disabled={search===''  || searchLastPos===searchPos}><ArrowDownward/> </IconButton>
            </Stack>
        </>}

        <Tabs value={selectedLogName} onChange={onChangeLogs}>
          { logs.length>0 && logs.map(t => {
              if (t.scope==='cluster')
                return <Tab key={t.name} label='cluster' value={t.name}/>
              else {
                if (t===selectedLog)
                  return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton onClick={(event) => setAnchorMenuLogs(event.currentTarget)}><Settings fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                else
                  return <Tab key={t.name} label={t.name} value={t.name} icon={<Settings fontSize='small'/>} iconPosition='end' sx={{ backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
              }
            })
          }
        </Tabs>
      </Stack>
    );
  }

  if (!logged) return (<>
    <div style={{ backgroundImage:`url('/front/turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
      <Login onClose={onCloseLogin} backend={backend}></Login>
    </div>
  </>);
  
  return (<>
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div>
        <Stack direction='row' spacing={1} sx={{ ml:1}} alignItems='baseline' >
          <Button onClick={(event) => setAnchorMenuConfig(event.currentTarget)} variant='contained' endIcon={<KeyboardArrowDown/>} >Config</Button>
          { anchorMenuConfig!==null && <MenuMain optionSelected={menuConfigOptionSelected} onClose={() => setAnchorMenuConfig(null)} uploadSelected={handleUpload} menuConfigOpen={menuConfigOpen} anchorMenuConfig={anchorMenuConfig}/> }

          <Selector onAdd={onSelectorAdd} clusters={clusters}/>

          <Stack direction={'column'} alignItems={'center'} alignSelf={'center'} paddingTop={3}>
            <Typography fontSize={9} sx={{backgroundColor:'lightGray'}}>&nbsp;{user}&nbsp;</Typography>
            <Typography fontSize={9} sx={{backgroundColor:'lightYellow'}}>&nbsp;{configName}&nbsp;</Typography>
          </Stack>
        </Stack>
        {showLogControls()}
      </div>

      {menuLogs}
      {showLogContent()}
    </Box>

    { showAlertConfig && <AlertConfig onClose={alertConfigClosed} expression={filter}/> }
    { showBlockingAlert && <BlockingAlert onClose={() => setShowBlockingAlert(false)} alert={blockingAlert} /> }
    { showRenameLog && <RenameLog onClose={renameLogClosed} logs={logs} oldname={selectedLog?.name}/> }
    { showSaveConfig && <SaveConfig onClose={saveConfigClosed} name={configName} /> }
    { showManageClusters && <ManageClusters onClose={manageClustersClosed} clusters={clusters}/> }
    { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} cluster={currentCluster}/> }
    { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} backend={backend}/> }
    { pickListConfig!==null && <PickList config={pickListConfig}/> }
    { popupConfig!==null && <Popup config={popupConfig}/> }    
  </>);
};

export default App;