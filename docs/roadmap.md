# Roadmap
We cite here some interesting capabilities that are missing today:

  - **Ephimeral log**. When you use Kwirth for alerting, you don't need in fact to store all the messages, you just want to receive them, process them and show alerts if something happens, but you don't really want to store all the messages that you are not interested in.
  - **Consolidated log object**. In addition to the ability to have config views with content that comes from more than one source cluster, it is desirable to create a log object (a tab, not a full config) in which you can consolidate logging from different source clusters.
  - **Non-root path**. In order to be able to share an ingress with other kubernetes services, it is desirable to have the abiity to configure Kwirth (front and API) for receiving requests in a non-root path, that is, something like 'http://your.dns.name/kwirth'.

