# API management
Access to Kwirth is secured by the use of APIs. When you access Kwirth via its own frontend application, this React application obtains an API key fro you to work with Kwirth.

But there are situations in which you want to create and share an API for another external use. In this case, you need to use this API Management tool.

![api-management](./_media/api-management.png)
An API key requirres following information to be created:

- **Description**. For obious reasons it is important to write down what an API key has been created for,
- **Expire**. In milliseconds, absolute expire moment for the API Key.
- **Type**. There are 2 types: 'permanent', that are stored in a secure site and keep alive even if Kwirth crashes, or 'volatile' they only live in memory, they are not persisted to any storage.
- **Scope**. As explained in other parts of this documentation, the scope is used to decide what resrouces a user can access. This are the valid scopes and their meaning:
    - cluster: this scope means you can access log all along the cluster
    - namespace: this scopes reduces de number of pods an API key can access to the pods included in the namespace list (see below).
    - set
    - pod
    - container
    - filter
- **Namespace**. It's  **a comma separated list** of namespaces (or just a single one, or nothing)
- **Set Type**. It's the type of set (replica, stateful or daemon) that you want to give access.
- **Set Name**. It's a comma separated list of sets the API can have access to, these can be replica sets, stateful sets or daemon sets.
- **Pod**. A comma separated list of pods.
- **Container**. A comma separated list of container inside a pod that an API key can access.

On the left side of the dialog you can see a list of currently existing API keys, an d yu can filter the list by selecting Permanent or Volatile on top of the list.

## Example
If you want to concede permissions to an external application to access all logs in your 'production' namespace you shoult create an API key like this:

![production-logs](./_media/production-logs.png)

Which would take this aspect:

```code
4cccfd58-a823-f1a1-5f4b-756d753b3bc3|permanent|namespace:production:::
```

This is the API key you should use in your client application.