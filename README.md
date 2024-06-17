<p align="center">
    <img height=auto src="https://jfvilaspersonal.github.io/kwirth/_media/kwirth-logo-20.png" /><br/>
    <a href='https://jfvilaspersonal.github.io/kwirth'><img src='https://img.shields.io/badge/contributions-welcome-orange.svg'/></a>
    <a href='https://jfvilaspersonal.github.io/kwirth'><img src='https://img.shields.io/badge/project-homepage-8EA8D8.svg'/></a>
</p>

# Kwirth project
Kwirth is the final implementation of the idea of having a simple way to manage logging inside a Kubernetes cluster. Maybe you feel comfortable with your DataDog or your Grafana and the Loki and the Promtrail. But maybe these (and other tools) are too complex for you.

If this is the case, **Kwirth is what you need**.

Yo can go to Kwirth web site if you prefer a user-friendly (non-developer) interface [here](https://jfvilaspersonal.github.io/kwirth).
## What you can do with Kwirth
Basically, Kwirth receives logs form one or more Kubernetes clusters in real-time, and with the data received you can do several thinks depending on your role.

  - Kwirth can be used on Operations areas for detecting exceptional situations.
  - It can also be used by development teams for reviewing logs of the services deployed to the cluster.
  - A Security team (a SOC) can also configure alerts on messages received from the source logs.

## Installation
Yes, **one only command**, just a simple 'kubectl' is enough for deploying Kwirth to your cluster.

```bash
kubectl apply -f https://raw.githubusercontent.com/jfvilasPersonal/kwirth/master/test/kwirth.yaml
```

If everithing is ok, in no more than 8 to 10 seconds Kwirth should be up and running. So next step is accessing the front application of your fresh new logging system. You can access Kwrith via your Kubernetes management sofware, via kubectl-port-forwarding, or even creating an ingress. By default, Kwirth listens on root path at port 3883.

If you have created a port forward by entering...

```bash
kubectl port-forward svc/kwirth-svc 3883
```

...you should be able to access Kwirth at http://localhost:3883/. Enjoy!!

## How Kwirth works
Kwirth is not Loki nor Grafana, Kwirth is not Elastic, Kwirth is not DataDog, Kwirth is not Azure Log Analytics... Kwirth is not an APM tool.

Kwirth just **shows the right logging information to the user that needs it**.

It is important to undertand that Kwirth does not store any logging information, it is just a **log visualization and analyse tool**.

The architecture of Kwirth is the one depicted below.

![](https://raw.githubusercontent.com/jfvilasPersonal/kwirth/master/docs/_media/kwirth-arch.png)

There is only one pod with one only container needed to run Kwirth. Of course, you can create replicas and services and ingresses if you need to scale out, but, generally speaking, Kwirth has no computing needs, since the only function of the pod is receiveing log data and re-sending it to jworth front applications.
