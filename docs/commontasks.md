# Common Tasks

## Your first log
The first time you access your fresh copy of Kwirth you must login with admin credentials, **admin/password** (yes the password is password).

 &nbsp;&nbsp;&nbsp;&nbsp;![login](./_media/login.png)

So, if everything is ok (and you have changed your password, you cannot continue if not), you should see the main Kwirth page:

 ![main kwirth page](./_media/main-page.png)

What you can see in the main Kwirth is:

  - The toolbar, with your login info (the user on the right), the name of the current board (just on the left of the user), we will see later what is a board. On the very left you'll find the access to the main menu, the burger icon.

    ![toolbar](./_media/toolbar.png)

  - The resource selector. This is one of the most important things in Kwirth.
  
    ![resource selector](./_media//resource-selector.png)

    The resource selector is the tool you use to select what kubernetes objects you want to work with. It has **7 selectors** and the 'add' button (to add the objects to the board):
    - **Cluster**. You can see here the list of Kubernetes clusters you have access to. You use this selector to decide what log to add to your board.
    - **Scope**. Once you select the cluster you must decide the scope of the log you want to add. You can add information that targets the whole cluster (yes, you can consolidate all the information you want of your cluster in one only point), a whole namespace (all the pods in a namespace) or one only pod (a pod log can include replica sets, daemon sets and stateful sets). *To have a cluster scope, you should select all namespaces*.
    - **Namespace**. Select here the list of namespaces you want to work with.
    - **Group**. If your scope is 'group' or lower, you can select here what group inside the namespace you want to work with. In the selector you will see *replica sets*, *stateful sets* and *daemons sets*.
    - **Pod**. If the scope is 'pod' or lower, you must select what pod/pods you want to use as source object.
    - **Container**. If the scope is 'container', you must decide here what container/containers you want to use as source.
  - The main menu gives you access to several configuration and operation options of your Kwirth installation.

    ![main menu](./_media/main-menu.png)

    These are the actions in the menu:
    - In the first block you can manage your boards by creating (new), loading (load) saving (save and 'save as') and deleting boards.
    - Next you have options for exporting your boards to a file or import them from a file.
    - Next option  is 'USer settings'. In user setting panel you can configure default behaviours of your channels, like maximum number of mesages in a log, adding timestamp to log lines, interval for refreshing metrics...
    - Next option is 'Cluster settings', where you can set some cluster-wide settings of Kwirth, like, for example, the interval Kwirth use to extract metrics from node's cAdvisor.
    - 'Manage cluster security' gives you the chance to manage other clusters you want to **access from this Kwirth**.
    - 'API security' allows viewing and managing API keys you can create to share with other parties.
    - 'User security' is for managing users that will have access to this instance of Kwirth.
    - Update Kwirth' (an *admin option* only permforms a Kwirth restart), so if you deployed Kwirth with 'latest' tag in the OCI image, Kwirth will restart with the **newest version**.`
    - **Exit Kwirth**, just logging you off.
    - At the very end of the menu you will find the version of the Kwirth you are workking with.


### The *boards*
A board is a set of channel views, where a channel view can have different forms depending on its configuration:

  - A board is a set of tabs.
  - Each tab can have a different channel type (log, metrics...)

A typical board have this form:

![sample board](./_media/sample-view.png)

Where the content of the board is as follows:

  - Tabs with log objects.
  - Tabs with metrics (chart views).
  - Tabs with alert systems.
  - Tabs names can be colored indicating: the tab has new content (pink), the tab is runnig, or the tab is paused (gray).
