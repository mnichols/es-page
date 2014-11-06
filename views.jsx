App.Views.Main = React.createClass({
    displayName: 'Main'
    ,showGroups: function(e) {
        var cmd = {
            id: this.props.model.id
            ,command: 'showGroups'
        }
        debug('sending',cmd)
        App.bus.send(cmd)
    }
    ,render: function(){
        return (
            <div className="main">
                <h1>ES Page</h1>
                <button type="button" onClick={this.showGroups}>Show Groups</button>
                <div className="groups-container"></div>
                <div className="issues-container"></div>
            </div>
        )
    }
})

App.Views.Groups = React.createClass({
    displayName: 'Groups'
    ,render: function(){
        return (
            <h1>Groups</h1>
        )
    }
})

App.Views.Issues = React.createClass({
    displayName: 'Issues'
    ,render: function(){
        return (
            <h1>Issues</h1>
        )
    }
})

