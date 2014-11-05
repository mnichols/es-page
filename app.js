var renderable = stampit()
    .methods({
        render: function(){
            var self = this
            return new Promise(function(resolve){
                var content = _.template(self.template,self.data)
                document.querySelector(self.el).innerHTML = content
                return resolve(self)
            })
        }
    })

var main = stampit.compose(renderable)
.state({
    el: '.app'
    ,data: {}
    ,template: '<div class="container">' +
                    '<h1>ES PAGE</h1>' +
                    '<a class="add-child">Add Child</a>' +
                    '<div class="children"></div>' +
                '</div>'
})
.methods({
    start: function(){
        return this.render()
    }
})



main.create().start()
