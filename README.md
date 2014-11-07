es-page
=======

Goals

Demonstrate forward only models for page transitions.

# Distinctions

The question of when to render view models is tricky. Say we are streaming
events into models and those models would render (based on their state) 
their template, probably creating containing elements for child models.

When does this render occur to hydrate the DOM hierarchy?

A typical ES setup has the notion of _transactions_ , allowing a 
well-defined lifecycle for committing events. We can reproduce this by having
_all_ changes to the model use a bus for invocation, essentially wrapping each
invocation in a transaction. During the course of the transaction, 
entities are added to the current context to have their pending events committed
to the store after completion. 

Does render occur at this point for each event provider?
Or should a model register a render call during event rehydration to 
preserve ordering?

What about  making the call to 'render' an event? So handlers that really
do demand a rerender would simply apply an 'rendered' event and be done?
