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
        var groupsContainer
            ,issuesContainer
        if(this.props.model.groupable) {
            groupsContainer = (
                <div className="groups-container"></div>
            )
        }
        if(this.props.model.issueable) {
            issuesContainer = (
                <div className="issues-container"></div>
            )
        }

        return (
            <div className="main">
                <h1>ES Page</h1>
                <button type="button" onClick={this.showGroups}>Show Groups</button>
                {groupsContainer}
                {issuesContainer}
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

