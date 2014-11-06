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
    ,createGroup: function(e) {
        e.preventDefault()
        App.bus.send({
            command: 'createGroup'
            ,id: this.props.model.id
            ,name: this.refs.groupName.getDOMNode().value
        })
    }
    ,render: function(){
        return (
            <div className="groups">
                <h1>Groups</h1>
                <form onSubmit={this.createGroup}>
                    <input type="text" className="groupName" refs="groupName"/>
                    <button type="submit">Create Group</button>
                </form>
            </div>
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

