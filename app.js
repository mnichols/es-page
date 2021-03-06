/*** infrastructure ***/
var storage
    ,evented
    ,commandable
    ,renderable
    ,bus
    ,subscription
    ,unitOfWork
    ,unitOfWorkFactory
    ,log = console.log.bind(console)
    ,warn = console.warn.bind(console)
    ,debug = console.debug.bind(console)
    ,error = console.error.bind(console)
    ,App
    ;

transaction = stampit()
    .state({
        revision: -1
        ,timestamp: new Date().toUTCString()
        ,events: []
    })

unitOfWork = stampit()
    .state({
        db: undefined
        ,eventIndex: -1
    })
    .enclose(function(){
        var identityMap = {}
        stampit.mixIn(this,{
            flush: function(){
                //creates a transaction

            }
            ,get: function(eventProviderId) {
                var obj = identityMap[eventProviderId]
                if(obj) {
                    return obj
                }
                throw new Error('eventProvider ' + eventProviderId + ' not being tracked.')
            }
            ,track: function(eventProvider) {
                if(!eventProvider) {
                    throw new Error('eventProvider is required')
                }
                if(!eventProvider.id) {
                    throw new Error('an event provider must have an `id`')
                }
                if(identityMap[eventProvider.id]) {
                    throw new Error('eventProvider ' + eventProvider.id + ' is already being tracked')
                }
                return identityMap[eventProvider.id] = eventProvider
            }
        })

    })

unitOfWorkFactory = stampit()
    .state({
        current: undefined
    })
    .methods({
        start: function(){
            return (this.current = this.current ||  unitOfWork({
                db: this.db
            }))
        }
        ,flush: function(unitOfWork) {
            return unitOfWork.flush()
                .bind(this)
                .then(function(){
                    this.current = undefined
                })
        }
    })


transaction = stampit()
    .state({
        eventProviders: []
    })
    .methods({
        add: function(eventProvider){
            this.eventProviders.push(eventProvider)
        }
        ,commit: function(db,revision){
            this.eventProviders.forEach(db.commit.bind(db,revision),this)
            return Promise.resolve(this.eventProviders)
        }
    })
uow = stampit()
    .state({
        transaction: undefined
        ,db: undefined
        ,onFlushes: []
        ,revision: 0
    })
    .methods({
        start: function(){
            this.current = transaction()
            return this
        }
        ,flush: function(){
            this.current.commit(this.db, ++this.revision)
            this.current = undefined
            this.onFlushes.forEach(function(cb){
                return cb(this.revision)
            },this)

            /*
            window.history.pushState({
                revision: this.revision
            },null, '/revisions/' + this.revision)
            */
            window.history.pushState({
                revision: this.revision
            },null, null)
            return this
        }
        //if the storage is fastforwarding,
        //then this will include the eventProvider
        //to recieve events.
        //if a unit of work is in process, then this will
        //cause the event provider to contribute its events
        //to the event store.
        ,add: function(eventProvider) {
            if(!this.current) {
                throw new Error('unit of work is not started')
            }
            this.current.add(eventProvider)
            return this
        }
        ,onFlush: function(cb) {
            this.onFlushes.push(cb)
        }
    })

subscription = stampit()
    .state({
        id: undefined
        ,action: undefined
        ,context: undefined
    })
    .methods({
        invoke: function(cmd){
            return this.context[this.action].call(this.context,cmd)
        }
    })

bus = stampit()
    .state({
        subscriptions: {}
        ,db: undefined
    })
    .methods({
        send: function(cmd) {
            App.uow.start()
            var sub = this.subscriptions[cmd.id] && this.subscriptions[cmd.id][cmd.command]
            if(!sub) {
                warn('NO HANDLERS',cmd)
                return
            }
            App.uow.add(sub.context)
            debug('handling',cmd)
            return Promise.resolve(cmd)
                .bind(sub)
                .then(sub.invoke)
                .bind(App.uow)
                .then(App.uow.flush)

        }
        ,subscribe: function(id,action,context) {
            var subs
            this.subscriptions[id] = subs = (this.subscriptions[id] || {})
            subs[action] = subscription({
                id: id
                ,action: action
                ,context: context
            })
            debug('subscribed',action,'to',id)
        }
        ,unsubscribe: function(id) {
            ;(delete this.subscriptions[id])
        }
    })

storage = stampit()
    .state({
        events: []
        ,identityMap: {}
        ,revision: 0
        ,envelopes: []
        ,streaming: false
        ,restored: 0
    })
    .methods({
        commit: function(revision, eventProvider) {
            var pending = eventProvider.events
            var envelope = {
                revision: revision
                ,events: pending.splice(0,pending.length)
            }
            this.events = this.events.concat(envelope.events)
            this.envelopes.push(envelope)
            eventProvider.events.length = 0
            return eventProvider
        }
        ,print: function(){
            console.log('envelopes','--->',JSON.stringify(this.envelopes, null, 2))
            console.log('events','--->',JSON.stringify(this.events, null, 2))
        }
        ,isStreaming: function(){
            return this.streaming
        }
        ,register: function(eventProvider) {
            log('REGISTERING',eventProvider.id,eventProvider)
            //this registers the provider to receive events during a stream
            this.identityMap[eventProvider.id] = eventProvider
        }
    })
    .enclose(function(){
        function process(events) {
            if(!events.length) {
                this.streaming = false
                return Promise.resolve(this)
            }
            this.streaming = true
            var event = events.shift()
            debug('processing',event.id,event.event,event)
            var model = this.identityMap[event.id]
            if(!model) {
                var msg = 'model not found for ' + event.id
                error(msg,this.identityMap)
                throw new Error(msg)
            }
            return Promise.resolve(event)
                .bind(model)
                .then(function(e) {
                    debug('invoking',event.event,'on',model.id)
                    return model['on' + event.event].call(model,e)
                })
                .bind(this)
                .then(process.bind(this, events))
        }
        stampit.mixIn(this, {
            restore: function(eventable, revision) {
                //if restoring to a previous revision
                //a 'commit' should cause the pruning of events between `MAX(events.revision)` and `revision`
                //This seems to make the storage be in a 'restored' state until a commit, which effectively splices revisions and
                //makes the current revision `revision+1`
                warn('restoring to',revision)
                this.register(eventable)
                var envelopes = this.envelopes.filter(function(e) {
                    return e.revision <= revision
                })
                debug('matched',envelopes.length,'envelopes')
                var events = envelopes.reduce(function(arr, curr) {
                    arr = arr.concat(curr.events)
                    return arr
                }, [])
                debug('streaming',events.length,'events')
                return process.call(this,events)
            }
        })


    })

evented = stampit()
    .state({
        events: []
        ,revision: 0
        ,id: undefined
    })
    .methods({
        raise: function(e) {
            e.id = this.id
            return Promise.resolve(e)
                .bind(this)
                .then(this['on' + e.event])
                .then(function(){
                    e.revision = ++this.revision
                    return e
                })
                .bind(this.events)
                .then(this.events.push)
        }
    })
    .enclose(function(){
        if(!this.id) {
            throw new Error('id is required')
        }
        //App itself is evented: @todo clean this up
        if(App && App.register) {
            if(!this.id) {
                throw new Error('id has not been assigned')
            }
            App.register(this)
        }
    })

commandable = stampit()
    .enclose(function(){
        if(!this.commands) {
            return
        }
        if(!this.id) {
            warn('id is not provider for ', this)
        }
        this.commands.forEach(function(cmd){
            App.bus.subscribe(this.id, cmd, this)
        },this)
    })

renderable = stampit()
    .methods({
        render: function() {
            return this.raise({
                event: 'rendered'
                ,id: this.id
            })
        }
        ,view: function(){
            throw new Error('not implemented')
        }
        ,el: function(){
            throw new Error('not implemented')
        }
        ,onrendered: function(e) {
            return this.reactify(React.createElement(this.view(),{
                model: this
            }), this.el())
        }
    })
    .enclose(function(){
        stampit.mixIn(this,{
            reactify: Promise.promisify(React.render)
        })
    })

/*** APP ***/

App = stampit
    .compose(evented)
    .state({
        Models: {}
        ,Views: {}
        ,db: undefined
        ,uow: undefined
        ,id: 'app'
        ,printStorage: function(){
            if(!this.db) {
                return
            }
            return this.db.print()
        }
    })
    .methods({
        start: function(cmd) {
            //manually add this thing so the event gets added
            this.uow.add(this)
            return this.raise({
                id: this.id
                ,event: 'mainCreated'
                ,mainId: cuid()
            })
            .bind(this)
            .then(function(){
                return this.main.initialize()
            })
        }
        ,onmainCreated: function(e) {
            debug('creating main',e.mainId)
            this.main = this.Models.main({
                id: e.mainId
            })
        }
        ,register: function(eventProvider) {
            if(this.db.isStreaming()) {
                return this.db.register(eventProvider)
            }
            return this.uow.add(eventProvider)
        }
        ,reset: function(cmd){
            debug('fastforward to',cmd.revision)
        }
        ,refresh: function(revision){
            return App.Views.Revision.render(revision)
        }
        ,goToRevision: function(cmd){
            this.main = undefined
            return this.db.restore(this, cmd.revision)
        }
    })
    .enclose(function(){
        stampit.mixIn(this,{
            db: storage()
            ,bus: bus()
        })
        stampit.mixIn(this,{
            uow: uow({db: this.db})
        })
        this.uow.onFlush(this.refresh.bind(this))
        this.bus.subscribe(this.id,'start',this)
        this.bus.subscribe(this.id,'reset',this)
        this.bus.subscribe(this.id,'goToRevision',this)


        window.addEventListener('popstate',function(e) {
            log('popstate received : RESTORING REVISION',e.revision, e)
            this.goToRevision({
                revision: e.state.revision
            })
        }.bind(this))

    })
    .create()


App.Models.main = stampit
    .compose(evented, renderable, commandable)
    .methods({
        el: function(){
            return document.querySelector('.app')
        }
        ,view: function(){
            return App.Views.Main
        }
    })
    .state({
        commands: [
            'showGroups'
            ,'showIssues'
        ]
    })
    .state({
        groupable: false
        ,issueable: false
        ,groups: undefined
        ,issues: undefined
    })
    .methods({
        initialize: function() {
            return this.raise({
                event: 'initialized'
                ,name: 'main!'
            })
            .bind(this)
            .then(this.render)
        }
        ,oninitialized: function(e) {
            this.id = e.id
            //noop
        }
        ,showGroups: function(cmd) {
            return this.raise({
                event: 'showedGroups'
                ,groupsId: cuid()
            })
            .bind(this)
            .then(this.render)
            .then(function(){
                return this.groups.initialize()
            })
        }
        ,showIssues: function(cmd) {
            return this.raise({
                event: 'showedIssues'
                ,issuesId: cuid()
            })
            .bind(this)
            .then(this.render)
            .then(function(){
                return this.issues.initialize()
            })
        }
        ,onshowedGroups: function(e) {
            this.groupable = true
            //we want to initialize the 'groups' model
            //and have it render
            this.groups = App.Models.groups({
                id: e.groupsId
            })
        }
        ,onshowedIssues: function(e) {
            this.issueable = true
            //we want to initialize the 'groups' model
            //and have it render
            this.issues = App.Models.issues({
                id: e.issuesId
            })
        }
    })

App.Models.issues = stampit
    .compose(evented, renderable, commandable)
    .state({
        commands: ['addIssue']
    })
    .methods({
        el: function(){
            return document.querySelector('.issues-container')
        }
        ,view: function(){
            return App.Views.Issues
        }
    })
    .methods({
        initialize: function(name){
            return this.raise({
                event: 'initialized'
                ,name: name
            })
            .bind(this)
            .then(this.render)
        }
        ,oninitialized: function(e) {
            this.id = e.id
            this.issues = []
        }
        ,addIssue: function(cmd) {
            var name = cmd.name
            return this.raise({
                event: 'issueAdded'
                ,issueId: cuid()
                ,name: name
            })
            .bind(this)
            .then(this.render)
        }
        ,onissueAdded: function(e){
            this.issues.push(App.Models.issue({
                name: e.name
                ,id: e.issueId
            }))
            //window.history.pushState({},'Issue ' + e.name,'/issues/' + e.issueId)
        }

    })


App.Models.groups = stampit
    .compose(evented, renderable, commandable)
    .state({
        commands: ['addGroup']
    })
    .methods({
        el: function(){
            return document.querySelector('.groups-container')
        }
        ,view: function(){
            return App.Views.Groups
        }
    })
    .methods({
        initialize: function(name){
            return this.raise({
                event: 'initialized'
                ,name: name
            })
            .bind(this)
            .then(this.render)
        }
        ,oninitialized: function(e) {
            this.id = e.id
            this.groups = []
        }
        ,addGroup: function(cmd) {
            var groupName = cmd.name
            if(!groupName) {
                throw new Error('goupName is required')
            }
            var groupId = cuid()
            return this.raise({
                event: 'groupAdded'
                ,groupId: groupId
            })
            .bind(this)
            .then(function(){
                return this.raise({
                    event: 'groupRenamed'
                    ,groupId: groupId
                    ,name: groupName
                })
            })
            .then(this.render)
        }
        ,renameGroup: function(cmd) {
            var groupId = cmd.id
                ,groupName = cmd.name
                ;
            return this.raise({
                event: 'renameGroup'
                ,groupId: groupId
                ,name: groupName
            })
            .then(this.render)
        }
        ,ongroupAdded: function(e) {
            var grp = App.Models.group({
                id: e.groupId
            })
            this.groups.push(grp)
        }
        ,ongroupRenamed: function(e) {
            var grp = this.groups.filter(function(g){
                return g.id === e.groupId
            })[0]
            grp.rename(e.name)
        }
    })

App.Models.issue = stampit
    .compose(renderable)
    .methods({
        el: function(){
            return document.querySelector(this.id)
        }
        ,view: function(){
            return App.Views.Issue
        }
    })
    .state({
        id: undefined
        ,name: undefined
    })
    .methods({
        rename: function(newName) {
            this.name = newName
        }
    })

App.Models.group = stampit
    .compose(renderable)
    .methods({
        el: function(){
            return document.querySelector(this.id)
        }
        ,view: function(){
            return App.Views.Group
        }
    })
    .state({
        id: undefined
        ,name: undefined
    })
    .methods({
        rename: function(newName) {
            this.name = newName
        }
    })


function testStorage(){
    var eventStore = storage()
    var grps = Models.groups()
    grps.initialize('leftmain')
    grps.addGroup('grp1')
    grps.addGroup('grp2')
    grps.addGroup('grp3')
    eventStore.commit(grps)


    var grps2 = eventStore.restore(grps.id,Models.groups())
    console.log('grps',JSON.stringify(grps, null, 2));
    console.log('grps2',JSON.stringify(grps2, null, 2));
}

document.querySelector('.boot').addEventListener('click',function(e) {
    return App.bus.send({
        id: 'app'
        ,command: 'start'
    })
})
document.querySelector('.print').addEventListener('click', App.printStorage.bind(App))

