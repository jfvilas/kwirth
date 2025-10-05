const OPSWELCOMEMESSAGE:string[] = [
    'Welcome to OpsChannel frontend interface. This is a command-like interface where you can launch several commands:',
    ' '
]

const OPSHELPMESSAGE:string[] = [
    'CLEAR      to clear this command console',
    'HELP       to get help on commands',
    'GET        to get simple information on a specific namespace, pod or container',
    '           samples:    GET default/mypod-1234-abcd/mycontainer   GET default/mypod   GET default',
    'DESCRIBE   obtain detailed info on object (same formats as GET)',
    'LIST       get a list of your authorized objects (according to your accessKey)',
    'EXECUTE    launch a command to a container object (format: EXECUTE ns/pod/cont command)',
    'SHELL      launch a shell console against object (format: SHELL ns/pod/cont) ',
    '           You can switch between shell sessions using F1-F10 keys, use F11 to show all shells and F12 to return here',
    'RESTART    You can restart a container inside a pod (format: RESTART ns/pod/cont)',
    'RESTARTPOD You can also restart a specific pod (format: RESTARTPOD ns/pod)',
    'RESTARTNS  Or you can even restart a whoooooole namespace (format: RESTARTNS ns) ',
    ' '
]

export { OPSWELCOMEMESSAGE, OPSHELPMESSAGE }