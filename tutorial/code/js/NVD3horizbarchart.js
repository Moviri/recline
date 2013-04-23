var dataset = new recline.Model.Dataset({ /*FOLD_ME*/
    url:'../data/Noleggi3.csv',
    backend:'csv',
    id: 'model_noleggi',
    fieldsType: [
            {id:'Noleggi auto',   type:'integer'},
            {id:'Noleggi moto',   type:'integer'},
            {id:'Noleggi bici',   type:'integer'}
           ]
});
dataset.fetch();

var $el = $('#chart1'); 
var graphNoleggi = new recline.View.NVD3Graph({
    model: dataset,
    state:{
        group: 'Regione',
        series: {
            type: "byFieldName", 
            valuesField: ['Noleggi auto', 'Noleggi moto', 'Noleggi bici']
        }, 
        graphType: 'multiBarHorizontalChart',
        width: 850,
        height: 700,
        xLabel: 'Giorno',
        options: {
            showControls:true,
            showLegend:true,
            margin: {top: 0, right: 0, bottom: 0, left: 120} // use left margin to ensure labels aren't clipped
        }
    }
});
$el.append(graphNoleggi.el); // this command is mandatory for NVD3
graphNoleggi.render();
