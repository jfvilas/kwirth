# Routers

Back-only Kwirth extensions that **carry the core's traffic to a cluster with no direct path** (behind NAT, a
firewall, a DMZ). They have no tab: they are configured in Kwirth's **Routers** manager and speak through the
core's log. The type, its contract (`IRouter`) and its scaffolder live in the Kwirth repository:
[kwirthmagnify/kwirth · routers](https://github.com/kwirthmagnify/kwirth/tree/master/routers).

| Router | Package | What it does |
|---|---|---|
| [bridge](bridge) | `@jfvilas/kwirth-router-bridge` | Two Kwirths that reach each other through one outbound link — the reference router |
