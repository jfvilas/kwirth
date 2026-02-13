import { EInstanceConfigView } from "@jfvilas/kwirth-common"
import { ITabSummary } from "../model/ITabObject"

interface IColors {
    stop: string
    start: string
    interrupt: string
    pause: string
    pending: string
}

const TABBASECOLORS: IColors = {
    stop: '#ebebeb',
    start: '#28a745',
    interrupt: 'salmon',
    pause: '#6c757d',
    pending: '#ffc107'
}

const TABBRIGHTCOLORS: IColors = {
    stop: '#cbcbcb',
    start: '#34d058',
    interrupt: 'red',
    pause: '#dfd7df',
    pending: '#ffca2c',
}

// const OPSWELCOMEMESSAGE:string[] = [
//     'Welcome to OpsChannel frontend interface. This is a command-like interface where you can launch several commands:',
//     ' '
// ]

// const OPSHELPMESSAGE:string[] = [
//     'CLEAR      to clear this command console',
//     'GET        to get simple information on a specific namespace, pod or container',
//     '             samples: GET default/mypod-1234-abcd/mycontainer   GET default/mypod   GET default',
//     'DESCRIBE   obtain detailed info on object (same formats as GET)',
//     'LIST       get a list of your authorized objects (according to your accessKey)',
//     'EXECUTE    launch a command to a container object (format: EXECUTE ns/pod/cont command)',
//     'XTERM      launch an x-terminal console against object (format: XTERM ns/pod/cont) ',
//     '             You can switch between shell sessions using Alt+F1-F10 keys',
//     '             Use Alt+F11 to show all active shells shells',
//     '             Use Alt+F12 to return here (an dhid shells)',
//     'RESTART    You can restart a container inside a pod (format: RESTART ns/pod/cont)',
//     'RESTARTPOD You can also restart a specific pod (format: RESTARTPOD ns/pod)',
//     'RESTARTNS  Or you can even restart a whoooooole namespace (format: RESTARTNS ns) ',
//     ' '
// ]

const DEFAULTLASTTABS:ITabSummary[] = [
  {
    name: 'all-namespaces-log',
    description: 'Consolidated logs from all existing objects in all namespaces',
    channel: 'log',
    channelObject: {
      clusterName: '$cluster',
      view: EInstanceConfigView.NAMESPACE,
      namespace: '*all',
      group: '',
      pod: '',
      container: ''
    }
  },
  {
    name: 'all-groups-fileman',
    description: 'File manager for all sets',
    channel: 'fileman',
    channelObject: {
      clusterName: '$cluster',
      view: EInstanceConfigView.GROUP,
      namespace: '*all',
      group: '*all',
      pod: '',
      container: ''
    }
  },
  {
    name: 'all-pods-metrics',
    description: 'Basic metrics for all pods in cluster',
    channel: 'metrics',
    channelObject: {
      clusterName: '$cluster',
      view: EInstanceConfigView.POD,
      namespace: '*all',
      group: '*all',
      pod: '*all',
      container: ''
    }
  },
  {
    name: 'all-containers-ops',
    description: 'Perform operations on all contianers',
    channel: 'ops',
    channelObject: {
      clusterName: '$cluster',
      view: EInstanceConfigView.CONTAINER,
      namespace: '*all',
      group: '*all',
      pod: '*all',
      container: '*all'
    }
  }
]

export type { IColors }
export { DEFAULTLASTTABS, TABBASECOLORS, TABBRIGHTCOLORS }