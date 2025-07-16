# Channels
As of Kwirth version 0.4 these are the existing channels:

  - **[Log](./channels/log)**. Real time log streamign from different source objects (a container, a pod, a namespace or a custom mix of any of them)
  - **[Metrics](./channels/metrics)**. Real-time metrics (CPU, memory, I/O, bandwidth...) aon a set of objects.
  - **[Alert](./channels/alert)**. Alrts bases on los messages. Log messages are rocessed at Kwirth core, so you only receive alerts accordingn to your config.
  - **[Echo](./channels/echo)**. This is a reference channel for channel implementers, it is not useful for real kubernetes operations.
  - **[Trivy](./channels/trivy)**. Get security-related information based on Trivy vulnerability analuzer..
  - **[Ops](./channels/ops)**. Perform day operations like shell, restarts, getting info, etc...

Please follow the links to get specific information on each channel.
