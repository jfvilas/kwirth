# Data streaming
Kwirth, originally a log exporting system, can export Kubernetes data in real time. In the very first versions on ly log data was exported from Kubernetes (through Kwirth streaming mechanisms). Starting with version 0.3, Kwirth can also export:

  - Signaling data, that is, events related to contrl of the streams (info messages, error messaes and so on)
  - Metrcis data, that is, Kwirth can export Kubernetes metrics (container related metrics) in real time.

## How it works
As you may know, it's up to Kwirth clients to open connections to Kwirth server, I mean, opening web sockets for requesting data. Opening a websocket from a client to Kwirth is free, that is, there are no security requirements for opening the web socket. Secuerty comes into action once the web socket is open and you want to receive a stream of data, wherever it be log, metrics or anything else. It's important to note that a web socket is a non-dedicated transport, what menas that an open web socket can be used to stream different kinds of data. For send data from server to client in an ordered way, a web socket can be used as a transport for different **services**. A service is a stream of data with a common scope and a common view.

  - **scope** is a spec of the kind of action you want to perform with the stream of data, for example:
    - View log lines
    - View pod status (obtaining real-time status streamed)
    - Receive metrics in real-time (a stream of metics in real-time)
    - Receive a metrics snapshot (just instant values with no streaming) 
  - **view** means what group of data you want to receive, that is, if yiur scope states a namespace and group of pods, you can decide what data you want to receive, for example:
    - Receive data for a set of pods (selected, for example, via a regex)
    - Receive data for a whole namespace

It is important to undertand what a **view** means:

  - If you use open and start an streaming log service, and your view is set to **namespace**, you will receive a stream of log lines including all the pods in the namespace.
  - Using the same scope, if your view is set to **container** you will receive a stream of log lines that are produced by all the containers that fulfill your scope declaration.

## Messaging
When a client opens a web socket, the next action is to send an 'start streaming' message, taht is, to send a message to the Kiwrth server explaining what kind of streaming **service** the client wants to use.

When the server receives a message like that, it performs the following actions:

  - Extracts **access key** in orde to evaluate if that access key si suitable for this Kwirth server.
  - If everything is ok, next step is to check if the access key allows client to use the service that the client wants to start (log mstreaming, for example)
  - If the client is not allowed, a negative response is sent.
  - If the user is allowed, the streamong service is started, sending stremaing messages through the web socket according to scope spec sent by client.
  - Streaming continues until web socket is closed (obiously) 

Streaming data messages (log lines, metrics...) do conatin information on the type of nformation they carry, so one only web socket can be used to receive different kinds of data. On the other side, clients may decide to open a specific web socket for each particular scope or particular kind of data, the server doesn't mind.

A typical 'start message' would conatin this information:
  - **type** of service (log, metrics...)
  - **access key**, previously obtaind using different methods (manually creating, creating via API...)
  - scope, indicating the action you want to perform (snapshot, stream...)
  - the view, indicating how to group streaming data
  - the resource spec (namespace, group, pod, container)
  - specific data for configuring the streaming service according to the type of service the client is starting, that is, log streaming requires specific configuration that is different from the one used in metrics streaming.

## Services
Up to this vesion of Kwirth, following streaming services are available.

### Log Streaming Service
Log streaming means receiving log data streams at client that is originated at a set of resurces (or an individual one).

A typical 'log start' message for receiving all log lines originated at 'production' namespace would be created like this (Typescript sample):

```javascript
var logConfig:LogConfig = {
    type: ServiceConfigTypeEnum.LOG,
    accessKey: 'my-access-key',
    scope: 'view',
    view: 'namespace',
    namespace: 'production', 
    group: '',
    pod: '', 
    container: '',
    timestamp: true,
    previous: false,
    maxMessages: 5000
}                
ws.send(JSON.stringify(logConfig))
```

If everything is ok, the Kwirth server would start sending log messages. What follows is a stream of JSON messages sent by the websocket
+++streaming sample

### Metrics streaming
Metrics streaming means sending resource metrics from server to client. When talking about 'resource metrics' it is very important to note that metrics can be aggregated according to start message indications on resource.

A typical 'metrics start' for receiving a stream of data about pod 'shopping-cart' would be created like this (Typescript sample):
```javascript
var metricsConfig:MetricsConfig = {
    type: ServiceConfigTypeEnum.METRICS,
    interval: 60,
    accessKey: 'my-access-key',
    scope: 'stream',
    view: 'pod',
    namespace: 'staging',
    group: '',
    pod: 'shopping-cart',
    container: '',
    mode: MetricsConfigModeEnum.STREAM,
    metrics: ['container_fs_writes_total','container_fs_reads_total']
}
ws.send(JSON.stringify(metricsConfig))
```

If everything is ok, the Kwirth server would start sending log messages. What follows is a stream of JSON messages sent by the websocket
+++streaming sample

### Signaling
When a stream of data is open, clients may receive information on that stream related with the events that occur in Kubernetes and impact the resources in scope, for example, new pods created, pods deleted, streaming errors, etc...

What follows are several sample signal messages that could be received at client side:

+++signal streaming sample

As you may see, every message canotins a signal category, like 'info', 'warning', or 'error'. Typical Kubernetes events, like pod creatin, pod deletion, etc., belong to the 'info category'.