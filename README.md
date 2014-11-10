es-page
=======

Goals

Demonstrate forward only models for page transitions.

# Distinctions

The question of when to render view models is tricky. Say we are streaming
events into models and those models would render (based on their state) 
their template, probably creating containing elements for child models.

When does this render occur to hydrate the DOM hierarchy? This question 
demands some distinctions be dealt with between a server-side ES app and 
a stateful client-side ES app.

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
new revision 4.
What if we want to allow the user to go 'back' to revision 5 (in the original branch)?
What does it mean to even _be_ on a branch now since you jumped from one branch to another?

How do 'links' play into this? When one clicks on a link for a resource, the page models
respond and build the appropriate model for displaying that resource, emitting events along
the way that bump the current revision.

### HTML5 history

How does this model relate to HTML5 history? 
Urls are minted by using `pushState` which accepts a _state_ parameter.
If a model should 'have an address', then it is trivial to update the url
from one of its event handlers; eg :

```js

...
oninitialized: function(e) {
    window.history.pushState(null,null, '/issues/' + e.issueId)
}
```

















