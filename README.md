es-page
=======

Goals

Demonstrate forward only models for page transitions.


### Transactions and Units of Work

A typical ES setup has the notion of _transactions_ , allowing a 
well-defined lifecycle for committing events. We can reproduce this by having
_all_ changes to the model use a bus for invocation, essentially wrapping each
invocation in a transaction. During the course of the transaction, 
entities are added to the current context to have their pending events committed
to the store after completion. 

A transaction is started for each command that is sent. Upon completion of these
command handlers, registered event providers flush their pending events
into the event storage.

It's important to note that 'render' calls that transform the DOM are treated
just like any other event. This ensures that during event streaming the 
proper DOM nodes are available for dependents, just like any other form of state.


### Instance lifecycle

If the page can be rebuilt from events, that means current instances will
be 'wiped out', potentially leaving dangling references to instances in the form
of event subscriptions or other closure scope concerns (rare).

Right before streaming events into the app, an event could be pushed into the app
that allows all the components to clean up after themselves.

This ultimately commits the page to be forward only, rather than permitting
replaying events from _x_ to _z_. 

For this to work, event providers must register themselves upon creation
to be tracked.  This is acceptable since they must register themselves during
streaming anyways to receive events from the storage.
Since we have a handle on these references we could destroy them just prior
to starting a streaming unit.

### Rewind

When rewinding the application to a prior revision, what is to be done with the
events that happened since that revision?

So if user has revisions 1,2,3,4,5 and then reverts to revision 3. What happens
to revisions 4 and 5? If we 'keep' those revisions then we could allow the
user to go 'forward'. 
On the other hand, if the user selects a new path from revision 3 he effectively
created two branches... one branch having original revs 4/5, and now the other having a
new revision 4. Parallel models emerge, but is this really useful?

The answer is 'yes', but not really for a page which is representing the 'truth' singularly.
When a user clicks the 'forward' control to go through history, he expects to see the recent future, 
not the future that existed before going back in time and creating a new path.

Another approach is to treat going 'back' as in fact appending all events up to _n_ to the event history and then replaying.
So going back in time is actually going forward to a representation built from past events. The next discussion will
show this interesting worldview is not very practical though.

Assume the following path:

* user has arrived at revision 5
* user goes back to revision 4
* user goes back to revision 3
* user selects a new code path (different from what would imitate the path toward revision 5). User is now at revision 6
* user goes back -1. **Which puts the user at revision 3, not 5**.
* when user goes forward, he expects to be at revision 6, not 4 or 5.


What does this mean? Revisions 4 and 5 are not very useful anymore. 
This means that if a transaction commits events, then it will _always_ be tagged as the `current revision + 1` and events which
are greater than the current revision will be *wiped out from event storage*.

This would change the above path to :

* user has arrived at revision 5
* user goes back to revision 4
* user goes back to revision 3
* user selects a new code path (different from what would imitate the path toward revision 5). User is marked as being at revision 4 (not '6' like above).
* user goes back -1. This puts the user where they 'were' like she expects.
* when user goes forward, he lands at our new revision 4 (the new code path).

### HTML5 history

How does this model relate to/integrate with HTML5 history? 
We can wire up the (singleton) page revision to supervise revisions of
the page since we are doing transactions. When a transaction has been
committed, then a call to `window.history.pushState` will cause the current
revision to be included in history with the `state` argument to the function
simply being the revision that should be restored `onpopstate`. Note that urls are _optional_ for `pushState`.
_The back and forward button on the browser has become enabled._ 

To see this at work, look in the source at `app.js` and grep 'window.history' and
'popstate'.


### Rigid pattern -> Scalable solution

It is important to note that all state changes to event provider models _must_ abide by the command / transactional pipeline. Stepping outside 
the transactional construct will not allow models to retain data integrity during forward/backward playbacks.
This appears to be rigid at first, but the freedom gained from eventing voids this concern and in fact increases code quality because
of its predictability.














