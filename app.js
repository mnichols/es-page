/*** infrastructure ***/
var storage
    ,evented
    ,renderable
    ;


storage = stampit()
    .state({
        events: []
    })
    .methods({
        commit: function(eventProvider) {
            var pending = eventProvider.events
            this.events = this.events.concat(pending.splice(0,pending.length))
            return eventProvider
        }
        ,restore: function(id, model) {
            var events = this.events.filter(function(e){
                return e.id === id
            })
            .forEach(function(e){
                model['on' + e.event].call(model,e)
                model.revision = e.revision
            })
            return model
        }
    })

evented = stampit()
    .state({
        events: []
        ,revision: 0
    })
    .methods({
        raise: function(e) {
            this['on' + e.event].call(this,e)
            e.revision = ++this.revision
            this.events.push(e)
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

renderable = stampit()
    .methods({
        render: function() {
            var promisifyRender = Promise.promisify(React.render)
            return promisifyRender(React.createElement(this.view(),this), this.el())
        }
        ,view: function(){
            throw new Error('not implemented')
        }
        ,el: function(){
            throw new Error('not implemented')
        }
    })

/*** APP ***/

var App = stampit()
    .state({
        Models: {}
        ,Views: {}
        ,db: undefined
    })
    .methods({
        start: function(){
            this.db = storage()
            var main = this.Models.main()
            main.initialize()
            this.db.commit(main)
            return main.render()
        }
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
    .methods({
        initialize: function() {
            this.raise({
                event: 'initialize'
                ,id: cuid()
            })
        }
        ,oninitialize: function(e) {
            this.id = e.id
            this.groups = []
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
            this.raise({
                event: 'initialize'
                ,id: cuid()
                ,name: name
            })
        }
        ,oninitialize: function(e) {
            this.id = e.id
            this.groups = []
        }
        ,addGroup: function(groupName) {
            if(!groupName) {
                throw new Error('goupName is required')
            }
            var groupId = cuid()
            this.raise({
                event: 'addGroup'
                ,id: this.id
                ,groupId: groupId
            })
            this.raise({
                event: 'renameGroup'
                ,groupId: groupId
                ,id: this.id
                ,name: groupName
            })
        }
        ,renameGroup: function(groupId, groupName) {
            this.raise({
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

document.body.addEventListener('click', App.start.bind(App))

