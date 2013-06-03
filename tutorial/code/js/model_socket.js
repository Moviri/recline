var dataset = new recline.Model.SocketDataset({
    url:'localhost',
    port: 1337,
    queue: "tweet",
    resource: "socket.io",
    fields: [
        {id:'text', type:'string'},
        {id:'name', type:'string'}
    ]
});


var $el = $('#grid1');
var grid1 = new recline.View.SlickGridGraph({
    model:dataset,
    el:$el,
    state:{  fitColumns:true,
        useHoverStyle:true,
        useStripedStyle:true,
        useCondensedStyle:true
    }
});
grid1.visible = true;
grid1.render();


dataset.attach();
