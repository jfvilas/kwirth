# Where the table is stored

## The ConfigMap

The high-score table lives in a single ConfigMap in Kwirth's namespace:

```
kwirth-store-channel-asteroids-scores
```

It is the **only** thing this plugin writes to the cluster. It contains at most ten entries, each
with a name, a score, a level and a date.

To see it:

```bash
kubectl get configmap kwirth-store-channel-asteroids-scores -n kwirth -o jsonpath='{.data.data}'
```

> **The content comes out double-serialized.** That is how Kwirth stores channel storage in
> general, not something specific to Asteroids: the core serializes the value and the ConfigMap
> serializes it again when writing the field. When the plugin reads it, both layers are undone and
> the data arrives correctly; it is only a nuisance when inspecting it by hand. To make it readable,
> run it through a JSON parser twice.

## Resetting the table

There is no button in the interface, and that is on purpose: it is a shared table and not just
anyone should be able to empty it from the UI. It is deleted by hand:

```bash
kubectl delete configmap kwirth-store-channel-asteroids-scores -n kwirth
```

The next score someone saves creates it again. There is no need to restart the core or the plugin.

## One table per cluster

The ConfigMap lives in the cluster, so **each cluster has its own table**. A Kwirth connected to
several clusters keeps independent tables, and a game played against development does not score in
production.

## Backup

If you want to keep it before a deletion or a migration, it is an ordinary ConfigMap:

```bash
kubectl get configmap kwirth-store-channel-asteroids-scores -n kwirth -o yaml > asteroids-scores.yaml
```

And it is restored with `kubectl apply -f`.

## Known limitation: several replicas

When inserting a score, the plugin chains the writes so that two games ending at the same time do
not overwrite each other. That protection works **within one process**.

With several `kwirth-back` replicas, two simultaneous scores handled by different replicas can
overlap, and one of the two could be lost. For a game's high-score table that is an acceptable loss,
which is why it is not hardened further. If it ever stopped being acceptable, the solution would be
to re-read and retry when Kubernetes returns a version conflict on writing the ConfigMap.

It does not affect the integrity of anything else: the worst case is that a high score is not
recorded.
