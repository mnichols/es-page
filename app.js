/*** infrastructure ***/
var storage
    ,evented
    ,renderable
    ,bus
    ,log = console.log.bind(console)
    ,warn = console.warn.bind(console)
    ,debug = console.debug.bind(console)
    ;

transaction = stampit()
    .state({
        eventProviders: []
    })
    .methods({
        add: function(eventProvider){
            this.eventProviders.push(eventProvider)
        }
        ,commit: function(db){
            this.eventProviders.forEach(db.commit.bind(db),this)
            return Promise.resolve(this.eventProviders)
        }
    })
uow = stampit()
    .state({
        transaction: undefined
        ,db: undefined
    })
    .methods({
        start: function(){
            this.current = transaction()
            return this
        }
        ,flush: function(){
            debug('flushing uow',this.current.eventProviders)
            this.current.commit(this.db)
            this.current = undefined
            return this
        }
        //if the storage is fastforwarding,
        //then this will include the eventProvider
        //to recieve events.
        //if a unit of work is in process, then this will
        //cause the event provider to contribute its events
        //to the event store.
        ,add: function(eventProvider) {
            debug('adding',eventProvider.id,'to uow')
            this.current.add(eventProvider)
            return this
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
            var handler = this.subscriptions[cmd.id] && this.subscriptions[cmd.id][cmd.command]
            if(!handler) {
                warn('NO HANDLERS',cmd)
                return
            }
            debug('handling',cmd)
            return handler(cmd)
                .bind(App.uow)
                .then(App.uow.flush)
        }
        ,subscribe: function(id,action,context) {
            var subs
            this.subscriptions[id] = subs = (this.subscriptions[id] || {})
            subs[action] = context[action].bind(context)
        }
        ,unsubscribe: function(id) {
            ;(delete this.subscriptions[id])
        }
    })

storage = stampit()
    .state({
        events: []
        ,eventProviders: {}
    })
    .methods({
        commit: function(eventProvider) {
            var pending = eventProvider.events
            debug('eventProvider',eventProvider.id,'has',eventProvider.events.length)
            this.events = this.events.concat(pending.splice(0,pending.length))
            return eventProvider
        }
        ,restore: function(id, model) {
            var events = this.events.filter(function(e){
                return e.id === id
            })
            //make this async
            .forEach(function(e){
                model['on' + e.event].call(model,e)
                model.revision = e.revision
            })
            return model
        }
        ,print: function(){
            console.log(JSON.stringify(this.events, null, 2))
        }
        ,isStreaming: function(){
            return false
        }
        ,register: function(eventProvider) {
            //this registers the provider to receive events during a stream
            this.eventProviders[eventProvider.id] = eventProvider.id
        }
    })

evented = stampit()
    .state({
        events: []
        ,revision: 0
        ,id: undefined
    })
    .methods({
        raise: function(e) {
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
        ,restore: function(events){
            return Promise.resolve(events)
                .bind(this)
                .each(function(e){
                    return this['on' + e.event].call(this, e)
                    this.revision = e.revision
                })
        }
    })
    .enclose(function(){
        //register this instance for streaming activity
        //or, register it in the current uow
        App.register(this)
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

var App = stampit()
    .state({
        Models: {}
        ,Views: {}
        ,db: undefined
        ,uow: undefined
        ,printStorage: function(){
            if(!this.db) {
                return
            }
            return this.db.print()
        }
    })
    .methods({
        start: function(cmd) {
            var main = this.Models.main({
                id: cuid()
            })
            return main.initialize()
        }
        ,register: function(eventProvider) {
            if(this.db.isStreaming()) {
                return this.db.register(eventProvider)
            }
            return this.uow.add(eventProvider)
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
        this.bus.subscribe('app','start',this)

    })
    .create()


App.Models.main = stampit
    .compose(evented, renderable)
    .methods({
        el: function(){
            return document.querySelector('.app')
        }
        ,view: function(){
            return App.Views.Main
        }
    })
    .state({
        groupable: false
    })
    .methods({
        initialize: function() {
            return this.raise({
                event: 'initialized'
                ,name: 'main!'
                ,id: cuid()
            })
            .bind(this)
            .then(this.render)
        }
        ,oninitialized: function(e) {
            this.id = e.id
            App.bus.subscribe(this.id,'showGroups',this)
        }
        ,showGroups: function(cmd) {
            return this.raise({
                event: 'showedGroups'
                ,id: this.id
                ,groupsId: cuid()
            })
            .bind(this)
            .then(this.render)
            .then(function(){
                return this.groups.initialize()
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
    })
App.Models.groups = stampit
    .compose(evented, renderable)
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
                ,id: cuid()
                ,name: name
            })
            .bind(this)
            .then(this.render)
        }
        ,oninitialized: function(e) {
            this.id = e.id
            this.groups = []
        }
        ,addGroup: function(groupName) {
            if(!groupName) {
                throw new Error('goupName is required')
            }
            var groupId = cuid()
            return this.raise({
                event: 'addGroup'
                ,id: this.id
                ,groupId: groupId
            })
            .then(function(){
                return this.raise({
                    event: 'renameGroup'
                    ,groupId: groupId
                    ,id: this.id
                    ,name: groupName
                })
            })
        }
        ,renameGroup: function(groupId, groupName) {
            return this.raise({
                event: 'renameGroup'
                ,groupId: groupId
                ,id: this.id
                ,name: groupName
            })
        }
        ,onaddGroup: function(e) {
            var grp = Models.group({
                id: e.groupId
            })
            this.groups.push(grp)
        }
        ,onrenameGroup: function(e) {
            var grp = this.groups.filter(function(g){
                return g.id === e.groupId
            })[0]
            grp.rename(e.name)
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

