# Echo channel
This channels sends users realtime "echo" information on objects in scope. IT has been built for channel implementers to have a simple channel implementtion to use as a starting point.

## What for
It's a referenc implementation, and  although that is its main objective, Echo Channel can also be used to test Kwirth connectivity and to monitor th status of objects in scope.

## Features
You can just configure two options prior to starting an Echo Channel:

  - **Max lines**, maximum number of lines to keep on screen, when the maximum is reached, old lines will start to disapear.
  - **Interval**, seconds to wait befor sending next echo

This is how the Echo setup feels:
![echosetup](./ch-echo-setup.png)

You can set your selected configuration as a default for future Echo Channel startings.

## Use
When yo add am Echo Channel to your Kwirth desktop, when you start it (after configuring echo interval) Kwirth will start sending information on added objects in a regular basis (your interval in seconds), as shown in next figure.

![echo-running](./ch-echo-running.png)
