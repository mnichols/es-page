App.Views.Main = React.createClass({
    displayName: 'Main'
    ,showGroups: function(e) {
        var cmd = {
            id: this.props.model.id
            ,command: 'showGroups'
        }
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
                <div className="containers">
                    {groupsContainer}
                    {issuesContainer}
                </div>
            </div>
        )
    }
})

App.Views.Groups = React.createClass({
    displayName: 'Groups'
    ,createGroup: function(e) {
        e.preventDefault()
        App.bus.send({
            command: 'addGroup'
            ,id: this.props.model.id
            ,name: this.refs.groupName.getDOMNode().value
        })
    }
    ,render: function(){
        return (
            <div className="groups">
                <h1>Groups</h1>
                <form onSubmit={this.createGroup}>
                    <input type="text" className="groupName" ref="groupName"/>
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

App.Views.Revision = React.createClass({
    displayName: 'Revision'
    ,goToRevision: function(e) {
        e.preventDefault()
        var value = this.refs.revision.getDOMNode().value
        App.bus.send({
            command: 'goToRevision'
            ,id: 'app'
            ,revision: parseInt(value, 10)
        })
    }
    ,render: function(){
        var rev = this.props.revision
        return (
            <div className="revision">
                <form onSubmit={this.goToRevision}>
                    <label>Revision</label>
                    <p>Max revision:<span> {rev} </span> </p>
                    <input type="number" ref="revision" />
                    <button type="submit">Go To Revision</button>
                </form>
            </div>
        )
    }
    ,statics: {
        render: function(revision){
            var el = document.querySelector('.revision-container')
            return React.render(<App.Views.Revision revision={revision}/>,
                                el)

        }
    }
})

