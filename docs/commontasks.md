# Common Tasks
Explain how to perform common tasks.

### Your first log
The first time you access yout fresh copy of Kwirth you mut login with admin credentials, admin/password (yes the password is password). So, if everything is ok, you should see the main Kwirth page:

>> main menu

What you can see in the main Kwirth is:

  - The toolbar, with your login info (the user on the right), the name of the current view (just before the user), we will see ater what is a view. On the very left you'll find the access to the main menu, the burger icon.
    >> toolbar image
  - The resource selector. This is one of the most important things in Kwirth. The resel (**re**source **sel**ector) is the tool you use to access logs on your source Kubernetes cluster. The resel has 4 selectors and the 'add' button (to add the surce object to the view):
    - 'Cluster'. You can see here the list of Kubernetes clusters you have access to. You use this selector to decide what log to add to your view.
    - 'Scope'. Once you select the cluster you must decide the scope of the log you want to add. You can add logs that target the whole cluster (yes, you can consolidate all the logs of your cluster in one only log), a whole namespace (all the pods in a namespace) and one only pod (a pod log can include replica sets, daemon sets and stateful sets).
    - 'Namespace'. If your scope is not cluster, you must select a namespace for deciding your source for logs.
    - 'Object'. If the scope is 'deployment', you must decide here what pod you want to use as source for your log info. 

### The *views*
A view is a set of log objects, where a log object can have different forms depending on the configuration:

  - A log object can simply show log inf (log lines, thta is stdout of a source object)
  - A log object can be configured to just show selected events, for instance, events linked to alarms.
  - A log object can be configured to show metrics info.
  - A log object can be configured to show alarms linked to matrics thresholds.

A typical view have this form:

>> view image

Where the content of the view is as follows:

  - Filter.
  - Search.
  - Log objects.
  
### Alarming
Closely...

### Multi-cluster
Closely...

### User management
Closely...

### Use-Cases
Closely...
