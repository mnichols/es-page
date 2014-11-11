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


### Strict pattern -> Scalable solution

It is important to note that all state changes to event provider models _must_ abide by the command / transactional pipeline. Stepping outside 
the transactional construct will not allow models to retain data integrity during forward/backward playbacks.
This appears to be strict (rigid?) at first, but the freedom gained from eventing voids this concern and in fact increases understandability 
and code quality because of its predictability.

## Glossary

The infrastructure required to accomodate this pattern is surprisingly small.
Still, some terminology must be clarified.

### Revision

Documents are distinguished by their revisions. Our software artifacts are no different.
For our purposes, 'revision' is used at the following levels:

* **event provider** each event provider is revisioned. This revision is updated for
each **event** which it raises.
* **application** the application undergoes an increase in revision for each transaction which is committed.

### Event Provider

Any object which has an `id` (unique) that raises events that should be persisted.
These object _should_ use distinct event handlers that actually perform changes to their
state (internal or external).

When an **event provider** is instantiated it should be tracked by the current **unit of work**.
This allows the instance to either have its 'pending events' be stored upon transaction committal,
or be enrolled to receive events during an **event pipe** stream depending on the 
context of the **unit of work**.

### Command

A `command` is simply a message that is put on the message bus. Invocations of `send`
on the command bus are _transactional_. See unit of work.
A command includes the following attributes:

* `id` {Any}  the identifier for the event provider the command targets
* `command` {String} the command name to be handled by the event provider
* `revision` {Any} [optional] The revision of the event provider to act upon
* `[data]` {Any} The data required for this command

The integrity of the command _can_ be increased by including the revision number of the entity
the command is acting upon. This _could_ be useful for cases where a command is in-flight
when a navigation action has been demanded (eg 'back'). 

### Event

An `event` is simply a message stating in _past tense_ a behavior which the **event provider** demonstrated,
usually during an command handler. 
An event includes the following attributes:

* `id` {Any} the identifier for the event provider that raised the event
* `event` {String} the name/description of the behavior that has occurred
* `revision` {Any} the revision of the event provider as a result of this event
* `[data]` {Any} The data required to change the state of the event provider

### Transaction

A transaction is created to stamp a set of events with the current **application revision** for playback
later on. These transactions are actually persisted in the **event storage** for navigation
through the application.

### Unit of Work

Command handlers are transactional, and the entities they act upon must be 
tracked during the transaction so that `event`'s raised may be flushed to the event storage
on commit of the transaction.

Similarly, **event pipe**'s are governed by a unit of work. This allows events to be
routed to **event provider** instances by their admission into the **identity map** during
rehydration.

The **Unit of Work** is responsible for tracking these entities in an _identity map_.
When a unit of work is `start`ed, it opens a transaction which is committed after
the current command handler has completed invocation.

Unlike other ES systems, the _ordering_ of these events are important within a
transaction (not just a single event provider), so a universal indexer
is necessary to keep events raised across event providers.

This makes DDDD advocates squeal because of the breakdown of transactional boundary
an aggregate root forms, but remember this isn't Domain Driven Design we are using here.
A view model _may_ (and often does) form a transactional boundary but a command may
result in events from _n_ event providers which must be persisted. 

### Event Storage

The event storage stores events. It may do so in a simple `Array` or perhaps `localStorage`.
Even better would be api support for event streams that can be reconciled prior to user
reloads.

It is important to note that we are not merely storing events in order per **event provider** but storing
the actual transaction containing the (ordered) events, including its annotation of the **application revision**. 

A `commit` of a transaction to the event storage results in an increment of the **application revision**.
If a commit occurs while the application is in a _restored_ state (eg a historical revision), then revisions between
the _restored_ revision and the current revision (before commit) are discarded _prior_ to determining
the new **application revision**. 

There should be NO GAPS in **application revision** sequence.

### Event Pipe

Given revision _n_, the event pipe is a transient object responsible for streaming event transactions out of the
**event storage** starting from **revision 0** _up to_ (parameter) revision _n_. 
Each transactions's event messages are handled asynchronously (in serial), 
routed by a convention for the event name upon an **event provider**.

These event providers are mapped by the current unit of work. When an event provider is instantiated
it should _always_ register itself on the unit of work to receive these events.

When invoking an event handler upon an **event provider** the revision of the event provider must be
updated to match that found in the event header.

Note that streaming events does not alter the **application revision**. 
Updating the **application revision** is done _only_ after a commit to the **event storage**.
When the stream has ended, the **application revision** is said to be at revision _n_.
