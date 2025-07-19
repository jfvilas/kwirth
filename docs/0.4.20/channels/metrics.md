# Metrics channel
Metrics Channel is a very long waited feature that eases your *needs for observability*. Aside from real-time streaming logs (the main original purpose of Kwirth), Metrics Channel can enhance your observability posture by streaming real-time metrics of your Kubernetes objects. As usual, you can build sets of objects by mixing different sources (pods from different namespaces, different whole namespaces...) or even stream real-time metrics for a single container. 

## What for
Metrics Channel can send to your browser (or your Kwirth-API consuming application) real-time observability that Kwirth gathers **directly from cAdvisor**. This is important, **Kwirth does not need Prometheus** or other metrics-scraping software, Kwirth can gather required metrics directly from the kubelets running inside your nodes.

## Features
Main features of Metrics Channel are:

  - Gather metrics directly from cAdvisor/Kubelet (**no Prometheus required**)
  - Show metrics in real-time charts of different kinds: Line, Area, Bar chart or direct value
  - Group your objects to see them together in two different modes:
    - **Agregate**: just sum up the values of same metrics from differnt objects and show it.
    - **Merge**: do not sum up the values, just show the metrics from different objects in the same chart. If you want to merge objects you can also decide whether to **stack** or **overlay** them.
  - As any other channel inside Kwirth, Metrics can reconnect even after losing the websocket connection, so you can stream real-time metrics in a non-stop way.

## Use
When you start the channel you must first setup how you want to receive the metrics and show them on the browser. These are the configuration items you must provide:

  - 

+++running
+++WIP
