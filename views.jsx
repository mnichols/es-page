App.Views.Main = React.createClass({
    displayName: 'Main'
    ,render: function(){
        return (
            <div className="main">
                <h1>ES Page</h1>
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

