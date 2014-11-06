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

var evented = stampit()
    .state({
        events: []
    })
    .methods({
        raise: function(e) {
            console.log('raised',e)
            this.events.push(e)
        }
        ,applyEvent: function(e) {
            console.log('applied',e)
            this['on' + e.event].call(this,e)
            this.events.push(e)
        }
        ,restore: function(events){
            return Promise.resolve(events)
                .bind(this)
                .each(function(e){
                    return this.applyEvent.call(this, e)
                })
        }
        ,replayQueue: function(upTo){
            //phony method that fetches certain events
            //and queues them up, then replays them
            var events = [
                { event: 'addChild', index: 0, revision: 1}
                ,{ event: 'addChild', index: 1, revision: 1}
                ,{ event: 'addChild', index: 2, revision: 1}
                ,{ event: 'addChild', index: 3, revision: 1}
                ,{ event: 'addChild', index: 4, revision: 2}
                ,{ event: 'addChild', index: 5, revision: 2}
                ,{ event: 'addChild', index: 6, revision: 2}
                ,{ event: 'addChild', index: 7, revision: 2}
                ,{ event: 'addChild', index: 8, revision: 3}
                ,{ event: 'addChild', index: 9, revision: 3}
                ,{ event: 'addChild', index: 10, revision: 3}
                ,{ event: 'addChild', index: 11, revision: 3}
                ,{ event: 'addChild', index: 12, revision: 4}
                ,{ event: 'addChild', index: 13, revision: 4}
                ,{ event: 'addChild', index: 14, revision: 4}
                ,{ event: 'addChild', index: 15, revision: 4}
            ]

            return this.restore(events.filter(function(e){
                return e.revision <= upTo
            }))

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
                self.applyEvent({ event: 'addChild', index: self.children.length})
                return self.rerender()
            }
            if(e.target.classList.contains('mount-others')) {
                self.children.length = 0
                return self.replayQueue(4)
                    .then(self.rerender)
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
                    '<button type="button" class="btn mount-others">Mount Others</button>' +
                    '<div class="children"></div>' +
                '</div>'
})
.methods({
    start: function(){
        return this.init()
    }
})



main.create().start()
