
function randomData(timeInterval) {

    var addData;
    timeInterval = timeInterval || 1;

    var lastRandomValue = 200;

    var timeBase = Math.floor(new Date().getTime() / 1000);

    this.addData = function(data) {

        var randomValue = Math.random() * 100 + 15 + lastRandomValue;
        var index = data[0].length;

        var counter = 1;

        data.forEach( function(series) {
            var randomVariance = Math.random() * 20;
            var v = randomValue / 25  + counter++
                + (Math.cos((index * counter * 11) / 960) + 2) * 15
                + (Math.cos(index / 7) + 2) * 7
                + (Math.cos(index / 17) + 2) * 1;

            series.push( { x: (index * timeInterval) + timeBase, y: v + randomVariance } );
        } );

        lastRandomValue = randomValue * .85;
    }
};

var seriesData = [ [] ];
var random = new randomData(150);

for (var i = 0; i < 150; i++) {
    random.addData(seriesData);
}

var dataset = new recline.Model.Dataset({
    records:seriesData[0],
    fields:[
        {id:'x', type:"date"},
        {id:'y', type:"float"}
    ],
    fieldLabels: [{id: "x", label: "Date"}]
});

var colorSchema = new recline.Data.ColorSchema({
    type:"scaleWithDataMinMax",
    colors:["#0000FF", "#FFF000"],
    dataset: {dataset: dataset, field: "y", type: "filtered"}
});

colorSchema.setDataset(dataset, "y");
