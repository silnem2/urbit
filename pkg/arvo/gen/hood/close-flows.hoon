::  Deletes all stale ames flows from failed (re) subscriptions
::
::    It runs in dry mode by default, printing the flows that can be closed.
::    To actually close the flows, run with |close-flows, =dry |
::
::    verbosity:
::      |close-flows, =veb %1  ::  flows already in closing
::      |close-flows, =veb %2  ::  stale (re) subscriptions
::      |close-flows, =veb %21 ::  ... that don't have a sub-nonce.yoke
::      |close-flows, =veb %22 ::  ... that have packets in-flight
::      |close-flows, =veb %3  ::  stale current subscription
::      |close-flows, =veb %4  ::  latest subscription was %nacked
::
/=  gall-raw  /sys/vane/gall
::
=>  |%
    +$  key  [subscriber=term =path =ship app=term]
    +$  val  [bone sub-nonce=@ud last-nonce=(unit @ud) live=?]
    --
:-  %say
|=  $:  [now=@da eny=@uvJ bec=beak]
        arg=~
        peer=(unit @p)
        dry=?
        veb=?(%1 %2 %21 %22 %3 %4 ~)
    ==
::
=/  our-gall  (gall-raw p.bec)
=/  peers-map
  .^((map ship ?(%alien %known)) %ax /(scot %p p.bec)//(scot %da now)/peers)
=/  gall-yokes
  .^((map dude:gall yoke:our-gall) %gy /(scot %p p.bec)//(scot %da now)/$)
::
=/  peers=(list ship)
  %+  murn  ~(tap by peers-map)
  |=  [=ship val=?(%alien %known)]
  ?:  =(ship p.bec)
    ~  ::  this is weird, but we saw it
  ?-  val
    %alien  ~
    %known  (some ship)
  ==
::
=;  bones=(list [ship bone])
  :-  %helm-ames-kroc
  ~?  dry  "#{<(lent bones)>} flows can be closed"
  dry^bones
::
%+  roll  peers
|=  [=ship bones=(list [ship bone])]
?:  &(?=(^ peer) !=(u.peer ship))
  bones
::
=+  .^  =ship-state:ames
        %ax  /(scot %p p.bec)//(scot %da now)/peers/(scot %p ship)
    ==
=/  =peer-state:ames  ?>(?=(%known -.ship-state) +.ship-state)
|^
::
%+  roll  ~(tap by resubscriptions)
|=  [[key flows=(list val)] bones=_bones]
::
%-  flop  %-  tail
%+  roll  (sort flows |=([[@ n=@ *] [@ m=@ *]] (lte n m)))
|=  [[=bone nonce=@ app-nonce=(unit @ud) live=?] resubs=_(lent flows) b=_bones]
::
=/  log=tape
  "[bone={<bone>} agent={<app>} nonces={<[wire=nonce app=app-nonce]>}] {<path>}"
=;  corkable=?
  ~?  &(?=(%22 veb) corkable live)
    [ship (weld "stale (re)subscription, still live (skip) " log)]
  =?  b  &(corkable !live)  [[ship bone] b]
  (dec resubs)^b
::  checks if this is a stale re-subscription
::
?.  =(resubs 1)
  ::  if there are more than one subscription per path, and we have a sub-nonce,
  ::  we check that this is indeed a (post-nonce) resubscription and the nonce
  ::  in the flow is less than the latest one.
  ::
  ?^  app-nonce
    ~?  ?=(%2 veb)  [ship (weld "stale (re)subscription " log)]
    (lth nonce u.app-nonce)
  ~?  ?=(%21 veb)
    [ship (weld "stale (re)subscription, missing sub-nonce " log)]
  ::  since we skip pokes (flows that don't have a nonce in the wire and don't
  ::  have an entry in boat.yoke), and in this case, this would be a
  ::  resubscription, we can consider it safe to be corked
  &
::  if there's only one subscription (or this is the latest one, since we sort
::  flows by nonce) we consider it stale if the nonce in the wire is less than
::  the latest subscription the agent knows about, since that should have been
::  removed from %gall, and we don't need to coordindate between %ames and %gall
::
?:  ?&  ?=([~ @] app-nonce)
        (lth nonce u.app-nonce)
    ==
  ~?  ?=(%3 veb)  [ship (weld "latest subscription flow is stale " log)]
  &
::  not retrieving the nonce for the latest flow, could mean a %poke -- which we
::  skip; see L 152 -- or an %ames/%gall desync where %gall deleted the
::  subscription but %ames didn't. if the latter, there should be a (greater
::  than 0) nonce in the wire, XX  unless this is a desynced pre-nonce %watch...
::
?~  app-nonce
  ~?  ?=(%3 veb)
    :-  ship
    %+  weld
      "latest subscription flow is stale {?.((gth nonce 0) "skip" "")} "
    log
  (gth nonce 0)
::  if there's a sub-nonce this is the current subscription and can be safely
::  corked if there is a flow with a naxplanation ack on a backward bone
::
=+  backward-bone=(mix 0b10 bone)
?.  =(%2 (mod backward-bone 4))
  |
?~  (~(get by rcv.peer-state) backward-bone)
  |
~?  ?=(%4 veb)  [ship (weld "%watch plea was %nacked " log)]
&
::
++  resubscriptions
  %+  roll  ~(tap by snd.peer-state)
  |=  $:  [=forward=bone message-pump-state:ames]
          subs=(jar key val)
      ==
  ?~  duct=(~(get by by-bone.ossuary.peer-state) forward-bone)
    subs
  ?.  ?=([* [%gall %use sub=@ @ %out ship=@ app=@ *] *] u.duct)
    subs
  =/  =wire  i.t.u.duct
  ::  0 for old pre-nonce subscriptions that don't have a nonce in the wire
  ::  (see watches-8-to-9:load in %gall)
  ::
  =/  nonce=@     ?~((slag 7 wire) 0 ?~(n=(slaw %ud &8.wire) 0 u.n))
  =*  subscriber  &3.wire
  =*  app         &7.wire
  ::  skip the sub-nonce in the subscription path
  ::
  =/  path  ?~(=(0 nonce) |7.wire |8.wire)
  =+  key=[path ship app]
  ?:  (~(has in closing.peer-state) forward-bone)
    ~?  ?=(%1 veb)
      :-  ship
      %+  weld  "bone={<forward-bone>} in closing, "
      "#{<~(wyt in live:packet-pump-state)>} packets retrying -- {<key>}"
    subs
  ?~  yoke=(~(get by gall-yokes) app)
    subs
  ?:  ?=(%nuke -.u.yoke)
    subs
  ?:  &(=(0 nonce) !(~(has by boat.u.yoke) key))
    ::  %pokes don't have an entry in boat.yoke, so we skip them
    ::  XX this could also by an %ames/%gall desync -- see comment in L 98
    ::
    subs
  =/  agent-nonce=(unit @ud)  (~(get by boar.u.yoke) key)
  %+  ~(add ja subs)  subscriber^key
  [forward-bone nonce agent-nonce ?=(^ live.packet-pump-state)]
--
