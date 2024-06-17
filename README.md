# Kwirth project
Kwirth is the final implementation of the idea of having a simple way to manage logging inside a Kubernetes cluster. Maybe you feel comfortable with your DataDog or your Grafana and the Loki and the Promtrail. But maybe these (and other tools) are too complex for you.

If this is the case, Kwirth is what you need.

### What you can do with Kwirth
Basically, Kwirth receives logs form one or more Kubernetes clusters in real-time, and with the data received you can do several thinks depending on your role.

  - Kwirth can be used on Operations areas for detecting exceiotioonal situations.
  - It can also be used by development teams for reviewing logs of the services deployed to the cluster.
  - A Security team (a SOC) can also configure alerts on messages received from the source logs.

### How Kwirth works
Kwirth is not Loki nor Grafana, Kwirth is not Elastic, Kwirth is not DataDog, Kwirth is not Azure Log Analytics... Kwirth is not an APM tool.

Kwirth just **shows the right logging information to the user that needs it**.

It is important to undertand that Kwirth does not store any logging information, it is just a **log visualization and analyse tool**.

The architecture of Kwirth is the one depicted below.

>>add diagram

There is only one pod with one only container needed to run Kwirth. Of course, you can create replicas and services and ingresses if you need to scale out, but, generally speaking, Kwirth has no computing needs, since the only function of the pod is receiveing log data and re-sending it to jworth front applications.

### Some snapshots
Some snapshots of Kwirth.