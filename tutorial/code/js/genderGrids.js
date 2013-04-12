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

    $el = $('#grid2');
    var grid2 = new recline.View.SlickGridGraph({
        model:virtual,
        el:$el,
        state:{
            fitColumns:true,
            useHoverStyle:true,
            useStripedStyle:true,
            useCondensedStyle:true,
            showTotals: [ {field: "visits_sum", aggregation: "sum" } ]
        }

    });
    grid2.visible = true;
    grid2.render();