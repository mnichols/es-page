App.Views.Main = React.createClass({
    displayName: 'Main'
    ,showGroups: function(e) {
        var cmd = {
            id: this.props.model.id
            ,command: 'showGroups'
        }
        App.bus.send(cmd)
    }
    ,showIssues: function(e) {
        var cmd = {
            id: this.props.model.id
            ,command: 'showIssues'
        }
        App.bus.send(cmd)
    }
    ,render: function(){
        var groupsContainer
            ,issuesContainer
        if(this.props.model.groupable) {
            groupsContainer = (
                <div className="groups-container well"></div>
            )
        }
        if(this.props.model.issueable) {
            issuesContainer = (
                <div className="issues-container well"></div>
            )
        }

        return (
            <div className="main">
                <h1>ES Page</h1>
                <button type="button" onClick={this.showGroups}>Show Groups</button>
                <button type="button" onClick={this.showIssues}>Show Issues</button>
                <div className="containers">
                    {groupsContainer}
                    {issuesContainer}
                </div>
            </div>
        )
    }
})

App.Views.Issues = React.createClass({
    displayName: 'Issues'
    ,createIssue: function(e) {
        e.preventDefault()
        App.bus.send({
            command: 'addIssue'
            ,id: this.props.model.id
            ,name: this.refs.issueName.getDOMNode().value
        })
    }
    ,renderIssues: function(model) {
        return model.issues.map(function(iss,idx){
            return <li key={idx}>{iss.name}</li>
        })
    }
    ,render: function(){
        var model = this.props.model
            ,issues = this.renderIssues(model)
        return (
            <div className="issues">
                <h1>Issues</h1>
                <form onSubmit={this.createIssue}>
                    <input type="text" className="issueName" ref="issueName"/>
                    <button type="submit">Create Issue</button>
                </form>
                <h2>Current Issues</h2>
                <ul>
                    {issues}
                </ul>
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
    ,renderGroups: function(model){
        return model.groups.map(function(grp,idx){
            return <li key={idx}>{grp.name}</li>
        })
    }
    ,render: function(){
        var model = this.props.model
        var groups = this.renderGroups(model)
        return (
            <div className="groups">
                <h1>Groups</h1>
                <form onSubmit={this.createGroup}>
                    <input type="text" className="groupName" ref="groupName"/>
                    <button type="submit">Create Group</button>
                </form>
                <h2>Current Groups</h2>
                <ul>
                    {groups}
                </ul>
            </div>
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

