# How it works

This page explains **why you see what you see**. You do not need it to play, but it answers almost
every question that comes up while using it: why the game is still there when you come back to the
tab, why the keyboard sometimes does not respond, and why the high-score table is not yours but
everyone's.

## Where the game runs

Entirely in your browser. The Kwirth back **simulates nothing**: it does not know where your ship is
or how many asteroids are left. Not a single message per second travels over the websocket.

That has a practical consequence: the game runs smoothly even if the cluster is saturated, because
the cluster takes no part in it.

## Why the game survives a tab switch

Kwirth **unmounts** a tab's content when you go to another one and mounts it again when you come
back. If the game lived inside the component, switching tabs would destroy it.

That is why the game state does not live in the component but in the channel object, which Kwirth
keeps outside the interface tree. When you come back, the component is rebuilt —the canvas, the
animation loop, the keyboard— and hooks back up **to the same game**, which is exactly where you
left it.

What is recreated every time is whatever depends on the canvas. That is why the size is
recalculated when you come back and when the window is resized.

## Why the keyboard needs the focus

The game **does not listen to the whole document**. It listens only to its tab's element, and only
while that element has the focus.

This is deliberate. If Asteroids listened to the window, it would keep the arrows, the space bar and
Enter for itself, and would steal them from you while you type anywhere else in Kwirth. The price
of not doing that is that you have to **click the play area** to start playing.

It is also the number one cause of "it does not respond": the channel is started, the game is
there, but the focus is somewhere else.

## The world and the aspect ratio

The game world **is not measured in screen pixels**. It has a fixed area, and the aspect ratio you
choose in the configuration only decides how that area is split between width and height.

This matters because it means that **changing the aspect ratio does not change the difficulty**: a
wider world is also shorter, and the amount of space the asteroids move through is the same.
Enlarging the window does not change it either: the canvas is drawn bigger, but the world it
represents is identical.

The canvas takes up all the space available in the tab while respecting that ratio: it tries the
full width first and, if the resulting height does not fit, the height rules and there is spare
space on the sides. That is why the game usually appears centred with black margins on the left and
right.

## So what does the back do

Just one thing: **it owns the high-score table**.

When you finish a game that makes it into the table, your browser sends it **one entry** —name,
score and level— and it is the back that inserts it, sorts, trims to ten and saves it.

The browser never sends the whole table, and that is on purpose. Since the table is shared by the
whole cluster, your copy may have gone stale while you were playing: if you sent it whole, you would
erase the games others saved in the meantime.

When the back saves a new entry, it notifies **every** Asteroids tab open in that Kwirth. That is
why the table updates by itself, without reloading, when someone scores.

It also sets the date itself, and trims the name to 24 characters. What arrives from the browser is
always user code, and the back does not trust it.
