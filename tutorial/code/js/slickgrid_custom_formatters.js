var dataset = new recline.Model.Dataset({ /*FOLD_ME*/
    url:'../data/Stipendi2.csv',
    backend:'csv',
    id: 'model_stipendi',
    fieldsType: [
            {id:'Operai',   type:'number'},
            {id:'Impiegati',   type:'number'},
            {id:'Quadri',   type:'number'},
            {id:'Dirigenti',   type:'number'},
            {id:'Freelance',   type:'number'},
            {id:'Media',   type:'number'},
            {id:'Delta Perc',   type:'number'}
           ]
});

dataset.fetch();

var customHtmlFormatters = [
    {
        id: "Sesso",
        formula: function (record) {
            var value = record.attributes.Sesso;
            if (value == "Maschio")
                return "<img src='../images/male.png'></img>&nbsp;"+value;
            else return "<img src='../images/female.png'></img>&nbsp;"+value;
        }
    },
    {
        id: "Delta Perc",
        formula: function (record) {
            var value = record.attributes.Media;
            var formattedValue = accounting.formatMoney(value, { symbol: "",  format: "%v %s", decimal : ".", thousand: ",", precision : 0 }) + "<small class='muted'>€</small>";
            var ratio = record.attributes["Delta Perc"];
            return   "<div style='width: 35%;float: left;margin-right: 5%;text-align: right;'>"+
                formattedValue + "</div>"+
                "<div class='percent-complete-bar-background' style='width:45%;float:left;'>"+
                "<span class='percent-complete-bar' style='width:" + ratio + "%'></span></div>";
        }
    }
    ];

var grid1 = new recline.View.SlickGridGraph({
    model:dataset,
    el: $('#grid1'),
    state:{  fitColumns:true,
        useHoverStyle:true,
        useStripedStyle:true,
        useCondensedStyle:true,
        visibleColumns: ["Regione", "Sesso", "Operai", "Impiegati", "Quadri", "Dirigenti", "Freelance", "Delta Perc"],
        customHtmlFormatters: customHtmlFormatters
    }
});
grid1.visible = true;
grid1.render();