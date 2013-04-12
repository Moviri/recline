    var agebin = function (value, field, record) {
        var v = record.attributes["age"];
        if (v < 10)
            return " 1-10";
        else if (v < 20)
            return "11-20";

        return v;
    }

    var dataset = new recline.Model.Dataset({
        records:[
            {id:0, country:'Italy', gender:"Female", age:5,  visits: 10},
            {id:1, country:'Italy', gender:"Female", age:5,  visits: 20},
            {id:2, country:'Italy', gender:"Female", age:12, visits: 30},
            {id:3, country:'Italy', gender:"Male",   age:13, visits: 40},
            {id:4, country:'Italy', gender:"Male",   age:14, visits: 50}
        ],

        fields:[
            {id:'id'},
            {id:'country', type:'string'},
            {id:'gender', type:'string'},
            {id:'age', type:'integer' },
            {id:'agebin', type:'integer', deriver:agebin},
            {id:'visits', type:'integer' }
        ]
    });

   var virtual = new recline.Model.VirtualDataset(
            {
                dataset: dataset,
                aggregation: {
                    dimensions:             ["country", "gender"],
                    measures:               ["visits"],
                    aggregationFunctions:   ["sum"],
                    partitions:             ["agebin"]
                },
                totals: {
                    measures:               ["visits_sum"],
                    aggregationFunctions:   ["sum"]
                }
    });