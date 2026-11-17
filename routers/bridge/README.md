# Bridge

**Two Kwirths that reach each other through one outbound link.** Only one of them needs to reach the other:
with that single link, **each one sees the other in its cluster list** and the whole of Kwirth works against
it — tabs, live channels, Magnify — even when one of them is behind NAT or a firewall.

It is a **Kwirth router** (the `router` extension type): no tab, no panel. It is configured in the
**Routers** manager and speaks through the core's log. It is also the reference router: its code shows how one
is written.

```
   Kwirth A (behind NAT)                                      Kwirth B (exposed)
 ┌──────────────────────┐   one outbound WebSocket link   ┌──────────────────────┐
 │ bridge: peer = B,key ├────────────────────────────────►│ bridge (accepts)     │
 │                      │◄═══ A's sessions use B ════════│                      │
 │                      │════ B's sessions use A ═══════►│                      │
 └──────────────────────┘          (multiplexed)          └──────────────────────┘
```

## Setting it up

1. Install **bridge** in both Kwirths (*Manage extensions → Routers*). No restart.
2. In **B** (the one that can be reached), create an access key with the scope **`bridge$peer`**
   (*Access keys*). Nothing else to configure there.
3. In **A**, open bridge's configuration (the gear) and fill in:

   | Field | Value |
   |---|---|
   | *Sibling URL* | B's URL, e.g. `https://b.example.com/kwirth` |
   | *Access key created in the sibling* | the key from step 2 (masked, with the eye) |
   | *Reconnect every (seconds)* | 10 by default |
   | *Heartbeat every (seconds)* | 30 by default (5–300). Keep it **below the idle timeout of every proxy on the way** (Azure Application Gateway, AWS ALB, your ingress…): they cut a WebSocket that stays idle longer than theirs |

   Save: A links to B at once. The card says *Started*; its tooltip, who it is linked to.
4. In each Kwirth, add the other one to the cluster list (*Manage cluster list*): its **real URL**, an access
   key **of that cluster** (as for any cluster), *Route* = **bridge**, and *Cluster UID* = the other one's
   cluster uid.

## What it does, and what it does not

- What arrives for the sibling's cluster is carried across the link and delivered to the sibling's core
  **over loopback**, as if a browser had made it. **That core authenticates and authorizes it** with the
  credential the request carries: bridge never decides what a user may do.
- Exactly **one** sibling. A third Kwirth is refused while the link lives. If both are configured to each
  other, the link opened by the lower cluster uid stays.
- **Several instances of the same Kwirth** (replicas, or a development back end sharing the store of the Kwirth
  deployed in its cluster) share bridge's configuration, so they all dial. The sibling keeps the link of the first
  one while it answers and refuses the others; one whose old link died without a close (a restart) gets it back.
- It comes back on its own: retries every *Reconnect every* seconds. **Both ends** ping the link every *Heartbeat
  every* seconds (30 by default): a link that does not answer by the next beat is given up — the side that dialled
  dials again, the side that received it waits for the sibling to come back. A link that dies without a close (a
  machine or a network gone) is noticed within two beats, on both sides. Changing it applies at once, without
  dropping the link.
- There are **two heartbeats, one per end**, each with its own setting: they do not need to match. A proxy sees
  traffic as often as the **shorter** one pings, so one end below its idle timeout is enough to keep the link up;
  each end notices a dead link at its own pace. The same value on both is the simple choice.
- Deleting the `bridge$peer` key in B cuts the link at once (the core does it), and A says so in its log.
- **Security:** whoever holds a `bridge$peer` key of B can *be* B's sibling. Protect it like any other key.
- **Login IP filter:** what the bridge delivers reaches the sibling's core **over loopback**. Sessions through a
  route use access keys, which the login IP filter never checks — but a hand-made `/login` through the bridge
  would be seen as coming from loopback. It passes the filter only where loopback is allowed: a **Magnify
  desktop** (always), or a Kwirth whose admin put loopback in the allow list or in the trusted proxies. Do not
  do the latter on a Kwirth that has bridge installed.
- Both directions share one socket: a very noisy live channel can slow the rest down.

## Log

Everything goes to the core's log, component **Routers** (`rout`), id `bridge`: link up and down (with whom),
refused links and why, retries, and requests that could not be delivered.

## Build, test, install

```
npm install
npm test
npm run build
cd dist && npm pack          # installable .tgz
```

To develop against a running Kwirth: `back/kwirth-dev.json` → `"routers": { "bridge": "<path to this dist>" }`
and `npm run watch` — the core reloads it on every build.

Product and plan: [docs/plan/PRD.md](docs/plan/PRD.md), [docs/plan/PLAN.md](docs/plan/PLAN.md).
