# How it works
Basically, Kwirth receives logs form one or more Kubernetes clusters in real-time, and with the data received you can do several thinks depending on your role.

  - Kwirth can be used on Operations areas for detecting exceptional situations.
  - It can also be used by development teams for reviewing logs of the services deployed to the cluster.
  - A Security team (a SOC) can also configure alerts on messages received from the source logs.

# Architecture
As we said before, Kwirth needs just one pod **with no persistence** for running (yes, you don't have to deal with PV's PVC's, NFS, CIFS, locla disks and so on). Kwrith stores its users in Kubernetes secrets, that is: **in etcd**. In addition, all user configuration is also stored in config maps, so, **etcd** again.

What follows is a self-explaining architecture of a deployment of Kwirth.

![](/_media/kwirth-arch.png)