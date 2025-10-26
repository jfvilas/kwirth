# Developing channels
On the very first versions of Kwirth all its capabilities were implemented inside Kwirth core. That is, log streaming or the ability to restart pods or deployments were in fact TypeScript modules co-developed and integrated into Kwirth core, they were built next to it, creating one only piece which contains the core backend features (connection to kubernetes cluster, managing security, serving as a storage system for profiles, etc.), the Kwirh capabilities (log streaming, cluster basic operations) and serving the front application (the React module).

Channel development has been taken outside of Kwirth core, so Kwirth features can be increased independently from Kwirth core evolution.

## Back Channel development
The channel system has been designed to allow **an ordered evolution of Kwirth core** and, at the same time, to serve as a basis for other developers to create its own channels, that is, its own real-time data-streaming services for Kubernetes.

Creating a channel involves the following processes:

  1. Design your channel.
  2. Implement the back channel interface.
  3. Configure your Kwirth.

### The channel interface
When you create a new channel, the first thing you should do is to review the interface you must implement for your channel to be integrable with Kwirth. This is how the channel system has been defined for the 0.3.160 version of Kwirth:

```typescript
interface IChannel {
    getChannelData() : BackChannelData
    getChannelScopeLevel(scope:string) : number
    
    endpointRequest(endpoint:string,req:Request, res:Response, accessKey?:AccessKey) : void

    addObject (webSocket:WebSocket, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containerName:string) : void
    deleteObject (webSocket:WebSocket, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containerName:string) : void


    pauseContinueInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, action:InstanceMessageActionEnum) : void
    modifyInstance (webSocket: WebSocket, instanceConfig: InstanceConfig) : void
    containsInstance (instanceId:string) : boolean
    stopInstance (webSocket:WebSocket, instanceConfig:InstanceConfig) : void
    removeInstance (webSocket:WebSocket, instanceId:string) : void

    processCommand (webSocket:WebSocket, instanceMessage:InstanceMessage, podNamespace?:string, podName?:string, containerName?:string) : Promise<boolean>

    containsConnection (webSocket:WebSocket) : boolean
    removeConnection (webSocket:WebSocket) : void
    refreshConnection (webSocket:WebSocket) : boolean
    updateConnection (webSocket:WebSocket, instanceId:string) : boolean
}
```

And this is a short explanation on each function:
  - **getChannelData**. The back channel must implement this function to inform Kwirth core which capabilities does it support. This refers to things like 'pausing', 'reconnecting', source support (Kubernetes, MesOS, Docker...), routing, metrics, etc.
  - **getChannelScopeLevel**. Your channel may need to offer different scope levels to your users. For example, in metrics channel the clients can just do SNAPSHOT (obtaining a set of metrics and its values) or do STREAM (that is, obtaining metrics through a stream of data implemented as an instance inside a web socket). This function returns an id that Kwirth core uses for deciding if a specific user has an Access Key with a scope for performing the fucntion he requested. For example, if the user has an access key for getting SNAPSHOT (value 1) and requests a metrics STREAM (value 2), Kwirth will deny the request.
  - **endpointRequest**. This function is invoked when a client invokes a predefined HTTP endpoint that is has been previously predefined when the channel was initially created. HTTP endpoints can be used to have a non-websocket communication between client and Kwirth, but normally you will have no need to implement this.
  - **addObject**. This function is invoked when a client requests to start a new instance of the channel, and it will be invoked whenever a new container is detected that matches instance filters.
  - **deleteObject**. This function is invoked when a container finishes execution.
  - **pauseContinueInstance**. This funciton will be invoked when the client connected to the channel wants to pause receiving data (but not stopping the instance) or continue receiving data if instance has been previously paused.
  - **modifyInstance**. Modify instance (if enabled for your channel) will be invoked if the connected client wants to make some changes on instance configuration.
  - **containsInstance**. This fucntion provides Kwirth core with the ability to discover which type of channel a web socket belongs to.
  - **stopInstance**. stopInstance is invoked when the client wants to stop an instance.
  - **removeInstance**. Kwirth core may invoke your channel removeInstance function for helping your channel keep healthy information on your clients.
  - **containsConnection**, the channel should return true/false indicating if it contains a specific connection (identified by its websocket).
  - **refreshConnection**, Kwirth core informs channels when a front client sends a "ping", ofr back channels to kwnow if clients are still alive (or to know last time client was alive). The connection is identified by thw websocket.
  - **updateConnection**. If your channel supports reconnect actions, this is the function call your channel will receive when a client connets an exiting instance with a new web socket. The connection is identified by thw websocket.
  - **removeConnection**. When a web socket is closed, due to an error, a client request to close a socket or whatever, Kwirth core will invoke this function for your channel to perform cleaning functions (removeConnection would typically remove all instances of the web socket). The connection is identified by thw websocket.

Please be aware of the difference that exists between an instance and the real communications transport (a web socket). When a client starts an intance, a web socket must be created and connected previously. And remember, **a web socket can carry multiple instances of the same channel**.

### Available data structures
The main data structure you will face when working with channels (aside form some basic data stored in strings or numbers) is **InstanceConfig**, which is the structure that contains all the data related to an instance.

`InstanceConfig` is declared like this:
```typescript
export interface InstanceConfig {
    objects: InstanceConfigObjectEnum
    accessKey: string
    scope: string
    view: InstanceConfigViewEnum
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}
```

`InstanceConfig` is an extension of `IInstanceMessage`, which is declared like this:
```typescript
export interface IInstanceMessage {
    action: InstanceMessageActionEnum
    flow: InstanceMessageFlowEnum
    type: InstanceMessageTypeEnum
    channel: string
    instance: string
}
```

So, these are all the properties included in an 'start instance' message (an instance config message):

 - **channel**. It is the id of the channel ('log', 'metrics', 'alert', or your own).
 - **objects**. It points to the type of kubernetes object your channel will manage: 'pods' and 'events' are the only ones starting with Kwirth 0.3.160.
 - **action**. The action the client is requesting or the server is answering, for exmaple: 'start', 'stop', 'pause'...
 - **flow**. Indicates the direction of the message: 'request' flows from client to server and 'response' flows back.
 - **instance**. Is the id of the instance the client or the server are working with by using this specific instance config.
 - **accessKey**. As we have explained, this is a string contianing the access key the client has obtained previously.
 - **scope**. This is the scope the client is requesting.
 - **view**. This indicates at which level the instance will be working. Only values allowed are: 'container', 'pod', 'group', 'namespace'.
 - **namespace**. Is a comma-separated list of namespaces (or blank).
 - **group**.  Is a comma-separated list of groups (a group can be a deployment, replica set, a daemon set and a stateful set) (or blank).
 - **pod**.  Is a comma-separated list of pod names (or blank).
 - **container**.  Is a comma-separated list of container names (or blank).
 - **type**. The type fo message being sent ('signal' or 'data').
 - **data**. This is a generic holder for your channel specific data.

This strucutre (and some others), as well as some 'enums', are included in the (**@jfvilas/kwirth-common**)[https://www.npmjs.com/package/@jfvilas/kwirth-common] package.


## Front Channel development
Starting with Kwirth 0.4 the front React app has been rearchitected to support the channel system in such a way that front features are implement *separately* via front plugins. For easing front channel development, the Kwirth team has created an interface that Front Channels must implement.

```typescript
interface IChannel {
    SetupDialog: React.FC<ISetupProps>
    TabContent: React.FC<IContentProps>
    readonly channelId: string

    requiresSetup(): boolean
    requiresMetrics(): boolean
    requiresClusterUrl(): boolean
    requiresAccessString(): boolean
    requiresWebSocket(): boolean
    setNotifier(notifier:(level:ENotifyLevel, message:string) => void): void
    getScope(): string
    getChannelIcon(): JSX.Element
    getSetupVisibility():boolean
    setSetupVisibility(visibility:boolean):void
    processChannelMessage (channelObject:IChannelObject, wsEvent:MessageEvent): IChannelMessageAction
    initChannel(channelObject:IChannelObject): boolean
    startChannel(channelObject:IChannelObject): boolean
    pauseChannel(channelObject:IChannelObject): boolean
    continueChannel(channelObject:IChannelObject): boolean
    stopChannel(channelObject:IChannelObject): boolean
    socketDisconnected(channelObject: IChannelObject): boolean
    socketReconnect(channelObject: IChannelObject): boolean
}
```

This is the explanation for each member of the interface:

  - **SetupDialog: React.FC<ISetupProps>**, it is a function that implements a React Functional Component
  - **TabContent: React.FC<IContentProps>**, it is a function that implements a React Functional Component
  - **readonly channelId: string**, it is the channel Id ('log', 'metrics', 'trivy',...) it must be unique. The same id is used also in back channels.

And this is the explanation for each function the interface must implement:
  - **requiresSetup(): boolean**, returns a boolean indicating if the channal needs a setup beor it can be started. Kwirth main App will invoke the `SetupDialog` previously mentioned i `requiresSetip` si `true`.
  - **requiresClusterUrl(): boolean**, indicates if the channel requires knowing the cluster URL for any of its features.
  - **requiresMetrics():boolean**, returns a value indicating if the channel requires the use of metrics (Kubernetes metrics, Docker metrics, etc...). If front channel requires metrics, Kwirth front will inject a list of available metrics when using the channel. That list comes from back channel.
  - **requiresAccessString():boolean**, must return a value indicating if the channel requires using the access Key. This is not normally needed, but it is a requirement if the channel plans to communicate directly to corresponding back channel.
  - **requiresWebSocket():boolean**, as explained before, if the front channel requires sending/receiving data over the channel websocket, this function must return **true**.
  - **setNotifier(notifier:(level:ENotifyLevel, message:string) => void): void**, the `notifier` is a function that channels can use to send notifications to end-user. It use is simple: a *notification level* (info, warning, error or success) and a *notification message*.
  - **getScope(): string**, channel must return the minimum scope needed to use the channel 
  - **getChannelIcon(): JSX.Element**, returns an SVG icon that will be shown on tabs nect to the name of the tab in front app.
  - **getSetupVisibility():boolean**, channel must return the visibulity status of the SetUp dialog.
  - **setSetupVisibility(visibility:boolean):void**, Kwirth informs channel about a new visibility status for the SetUp dialog.
  - **processChannelMessage (channelObject:IChannelObject, wsEvent:MessageEvent): IChannelMessageAction**, when a channel message is received from a Back Channel via a connected websocket, the message is delivered to the channel for its further processing.
  - **initChannel(channelObject:IChannelObject): boolean**, Kwirth will invoke this function when a new tab using this channel is first created (exactly after the user selects resources and clicks 'ADD' on resource selector).
  - **startChannel(channelObject:IChannelObject): boolean**, this function will be invoked when the user clicks on 'START' to start the channel.
  - **pauseChannel(channelObject:IChannelObject): boolean**, when the user click on 'PAUSE' Kwirth front will invoke this function.
  - **continueChannel(channelObject:IChannelObject): boolean**, when the user click on 'CONTINUE' on a paused channel, Kwirth front will invoke this function.
  - **stopChannel(channelObject:IChannelObject): boolean**, this function will be invoked when the user clicks on 'STOP' to stop the channel.
  - **socketDisconnected(channelObject: IChannelObject): boolean**, when the websocket is disconnected (user removing a tab, for example) Kwirth will invoke this function.
  - **socketReconnect(channelObject: IChannelObject): boolean**, , when a connection to a back channel is restored creating a new websocket (after websocket connection has been lost due to communication errors),  Kwirth will invoke this function.

All the information nnede to run a channel is atored in an instance of IChannelObject:

```Typescript
interface IChannelObject {
    clusterName: string
    view: InstanceConfigViewEnum
    namespace: string
    group: string
    pod: string
    container: string
    instanceId: string
    instanceConfig: any
    config: any
    data: any
    metricsList?: Map<string, MetricDescription>
    accessString?: string
    webSocket?: WebSocket
    clusterUrl?: string
}
```

As you may see, metricsList, accessString and webSocket are optional, they depend on the abovementioned **requires...**.

!> `data`, `config` and `instanceConfig` are channel-specific.

### Sample implementation
For a simple implementaiton of a channel, please review [echo Back Channel](https://github.com/jfvilas/kwirth/tree/master/back/src/channels/echo) and [echo Front Channel](https://github.com/jfvilas/kwirth/tree/master/front/src/channels/echo) on GitHub.

This is a reference implementation that you can use as a starter pack for channel development.
