(function ($) {

    recline.Model.Dataset = recline.Model.Dataset.extend({
            addCustomFilterLogic: function(f) {
            if(this.attributes.customFilterLogic)
                this.attributes.customFilterLogic.push(f);
            else
                this.attributes.customFilterLogic = [f];
        }
    });


}(jQuery));