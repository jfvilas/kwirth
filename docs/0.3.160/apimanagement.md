# API management [PENDING RE-WRITING]
Access to Kwirth can be performed by using APIs that are secured. When you access Kwirth via its own frontend application, this **React** application obtains an API key for you to work with Kwirth on your very first login.

But there are situations in which you may want to create and share an API for another external use, like integrating [Backstage Kubelog](https://github.com/jfvilas/kubelog), for example. In this case, you need to use ther API Management tool inside Kwirth.

![api-management](./_media/api-management.png)

The API management tool (named **API Security**) is on the main menu (the burger icon) but is only visible to admins and users holding an the API 'scope'.
![api security menu option](api-security-menu-option.png)


## API Keys explained
An API key requires following information to be created:

- **Description**. For obious reasons it is important to write down what an API key has been created for.
- **Expire**. In milliseconds, absolute expire moment for the API Key.
- **Type**. There are 2 types: 'permanent', that are stored in a secure site and keep alive even if Kwirth crashes, or 'volatile' they only live in memory, they are not persisted to any storage. When you create Key s manually you can only create 'permanent' keys. 'volatile' keys are expected to be created by other applications.
- **Scope**. As explained in other parts of this documentation, the scope is used to decide what an API Key owner can do with the resources declared in the key. This are the valid scopes and their meaning:
    - cluster: this scope means you can permform any Kwirth action on the cluster.
    - api: this scopes allows you to manage api keys
    - restart: this scope allows the owner of the key restartin pods or deployments in the cluster where de key has been created
    - view: this scope allows viewing logs (is the more basic scope)
- **Namespace**. It's  **a comma separated list** of namespaces (or just a single one, or nothing).
- **Group Type**. It's the type of set (replica, stateful or daemon) that you want to give access.
- **Group Name**. It's a comma separated list of sets the API can have access to, these can be replica sets, stateful sets or daemon sets.
- **Pod**. A comma separated list of pods.
- **Container**. A comma separated list of container inside a pod that an API key can access.

On the left side of the dialog you can see a list of currently existing API keys, and you can filter the list by selecting Permanent or Volatile on top of the list.

## Example
If you want to give permissions to an external application like Kubelog to view all logs in your 'production' namespace you shoult create an API key like this:

![production-logs](./_media/production-logs.png)

Which would take this aspect:

```code
93df417c-e124-7d66-12a1-277d3f246bf7|permanent|view:production:::
```

This is the API key you should configure in your client application.


## API Keys, Access Keys and Resource Id
The union of key type (permanent, volatile or bearer), the scope (view, snapshot, restart...), zero or more namespaces, zero or more groups (including its type and name), zero or ore pods and zero or more container names is what we call an **ACCESS KEY**. That is, the API key is the sum of the Access Key plus its expiration date.

When we talk about Access Keys we need to explain its content deeply. This is what an Access Key contains:
  - An unique Id (a GUID).
  - The type of key (permant, volatile, bearer or whatever)
  - The scope and a set of one or more resoure identifiers:
    - **Scope** points to the kind of actions the access key holder can perform: view logs, restart pods, manage apis, receive metrics...
    - **Resource id** is a pattern which states what resources can be managed (according to previous explained scope) by using this Access Key.

That is, an API Key contains an **expiration date and an Access Key**. And an access key contains the **type of key, the scope and the resource id**. And the resource id is a declaration of a set of names of objects from the cluster that must match with the names declared in the resource id for the user to be allowed to access them.


## Multi cluster support
When you use an instance of Kwirth as a gate to a multi-cluster log management system, you need to add clusters, as shown in (cluster managment)[clustermanagemnet]. For a cluster to be added to another Kwirth instance, you must previously create an API like we've just explained.

## Access key types
For a client to use Kwirth (the API, the channels, the instances...) he must previously obtain a token that he must present on every subsequent invocation, for example, when starting an instance, connecting to a data stream, etc.

Tokens can be any of these 3 types:

  - **Permanent**. These tokens are stored in the kubernetes control plane, so they are usable until its expiation date, even if the Kwirth or the whole cluster is stopped and restarted.
  - **Volatile**. Volatile tokens behave exactly like permanent ones in relation to permissions capabilities, but they are not perssisted, that is, they live only inside the memory of the Kwirth instance that created it, so they are not useful if you have more than one replica of a Kwirth core or you are worried about Kwirth, node or cluster restarts.
  - **Bearer**. Bearer tokens are not persisted inside Kwirth nor your kubernetes cluster, they are created and digitally signed and sent to the client on first login. Everytime a client invokes an API he must present the token, and Kwirth core will check its integrity prior to accept client requests. I mean, this is a typical bearer token like the ones used in OAuth, for example. Bearer tokns must be presented ina an HTTP 'Authorization' header with a format like this one:
    - Authorization: Bearer f417c2a1277d3f24|permanent|view:production:::
    - The id in front of the key is in fact a hash id (syncly cyphered) used to protet access key from being hacked for client scalation. Clients can read keys, and must sent them back to servers, but they cannot modify them.

Anyway, the format and content of a token is exactly the same in all three types of tokens.
