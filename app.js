var storage = stampit()
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

var evented = stampit()
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


var groups
    ,group

groups = stampit
    .compose(evented)
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
            var grp = group({
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

group = stampit
    .compose(evented)
    .state({
        id: undefined
        ,name: undefined
    })
    .methods({
        rename: function(newName) {
            this.name = newName
        }
    })


var eventStore = storage()
function boot(){
    var grps = groups()
    grps.initialize('leftmain')
    grps.addGroup('grp1')
    grps.addGroup('grp2')
    grps.addGroup('grp3')
    eventStore.commit(grps)


    var grps2 = eventStore.restore(grps.id,groups())
    console.log('grps',JSON.stringify(grps, null, 2));
    console.log('grps2',JSON.stringify(grps2, null, 2));

}

boot()

/*
var renderable = stampit()
    .methods({
        replaceEl: function(){
            var self = this
            return Promise.resolve(this.el())
                .then(document.querySelector.bind(document))
                .then(function(el){
                    var content = _.template(self.template,self.data)
                    el.innerHTML = content
                    return el
                })
        }
        ,appendEl: function(to){
            to = document.querySelector(to)
            return Promise.resolve('div')
                .bind(document)
                .then(document.createElement)
                .bind(this)
                .then(function(el){
                    el.classList.add(this.el())
                    var content = _.template(this.template,this.data)
                    console.log('content',content)
                    el.innerHTML = content
                    to.appendChild(el)
                    return el
                })
        }
        ,render: function(){
            return this.replaceEl()
        }
    })

var child = stampit.compose(renderable)
.state({
    template: '<p>Child #<%= index %></p>'
})
.state({
    index: undefined
    ,data: {}
})
.methods({
    el: function(){
        return '.child-' + this.index
    }
    ,render: function(){
        return this.appendEl('.children')
    }
})
.enclose(function(){
    stampit.mixIn(this.data,{
        name: 'child' + this.index
        ,index: this.index
    })
})

var main = stampit.compose(renderable,evented)
.state({
    children: []
})
.methods({
    el: function(){
        return '.app'
    }
})
.state({
    data: {
        name: 'main'
    }
    ,onaddChild: function(e) {
        this.children.push(child({ index: e.index}))
    }
    ,rerender: function(){
        return this.render()
            .bind(this)
            .then(this.renderChildren)
    }
    ,init: function(){
        var self = this
        document.body.addEventListener('click',function(e){
            if(e.target.classList.contains('add-child')) {
                self.applyEvent({ event: 'addChild', index: self.children.length, revision: self.revision + 1})
                return self.rerender()
            }
        })
        document.body.addEventListener('change',function(e){
            if(e.target.classList.contains('revision-number')) {
                self.children.length = 0
                return self.replayQueue(parseInt(e.target.value, 10))
                    .then(self.rerender)

            }
        })
        return this.rerender()
    }
    ,renderChildren: function(kid, index) {
        return Promise.resolve(this.children)
            .each(function(kid){
                console.log('kid',kid)
                return kid.render()
            })

    }
    ,template: '<div class="container">' +
                    '<h1>ES PAGE</h1>' +
                    '<p>This is <%= name %></p>' +
                    '<a class="add-child">Add Child</a>' +
                    '<div class="children"></div>' +
                '</div>'
})
.methods({
    start: function(){
        return this.init()
    }
})



main.create().start()
*/
