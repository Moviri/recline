/***
 * Contains basic SlickGrid formatters.
 * @module Formatters
 * @namespace Slick
 */

(function ($) {
  // register namespace
  $.extend(true, window, {
    "Slick": {
      "Formatters": {
        "PercentComplete": PercentCompleteFormatter,
        "PercentCompleteBar": PercentCompleteBarFormatter,
        "YesNo": YesNoFormatter,
        "Checkmark": CheckmarkFormatter,
        "TwinBarFormatter": TwinBarFormatter,
        "FixedCellFormatter": FixedCellFormatter,
        "DateFormatter": DateFormatter,
        "HtmlFormatter": HtmlFormatter,
        "HtmlExtFormatter": HtmlExtFormatter
      }
    }
  });
  
  function FixedCellFormatter(row, cell, value, columnDef, dataContext) {
	var text = value;
    if (value == null || value === "")
    	text = "-";

    return "<span class='dimmed'>"+text+"</span>";
  }  

  function PercentCompleteFormatter(row, cell, value, columnDef, dataContext) {
    if (value == null || value === "") {
      return "-";
    } else if (value < 50) {
      return "<span style='color:red;font-weight:bold;'>" + value + "%</span>";
    } else {
      return "<span style='color:green'>" + value + "%</span>";
    }
  }

  function PercentCompleteBarFormatter(row, cell, values, columnDef, dataContext) {
    if (values == null || values === "") {
      return "";
    }
    var value = 100 * values[0] / parseFloat(values[1]);
    var color;
    var colors = dataContext.schema_colors;
    if (colors)
    	color = colors[0]
    else
	{
        if (value < 30) {
            color = "red";
          } else if (value < 70) {
            color = "silver";
          } else {
            color = "green";
          }
	}
    return "<span class='percent-complete-bar' style='background:" + color + ";width:" + value + "%'></span>";
  }
  function TwinBarFormatter(row, cell, values, columnDef, dataContext) {
    if (values == null || values.length < 3) {
      return "";
    }
	
    var colors = dataContext.schema_colors;
	var max = parseFloat(values[2]);
	var val1 = Math.abs(parseFloat(values[0]))/max*50;
	var val2 = Math.abs(parseFloat(values[1]))/max*50;
	
	var bar0 = "<span class='percent-complete-bar' style='background:transparent;width:" + (50 - val1) + "%'></span>";
	var bar1 = "<span class='percent-complete-bar' style='background:" + colors[0] + ";width:" + val1 + "%'></span>";
	var bar2 = "<span class='percent-complete-bar' style='background:" + colors[1] + ";width:" + val2 + "%'></span>";

    return bar0+bar1+bar2;
  }

  function DateFormatter(row, cell, value, columnDef, dataContext) {
    return new Date(value);
  }
  
  function YesNoFormatter(row, cell, value, columnDef, dataContext) {
    return value ? "Yes" : "No";
  }

  function CheckmarkFormatter(row, cell, value, columnDef, dataContext) {
    return value ? "<img src='../images/tick.png'>" : "";
  }
  
  function HtmlFormatter(row, cell, values, columnDef, dataContext) {
	    if (values == null || values.length < 2)
	        return "";
	    
	    var record = values[0] // must hold the record JSON attributes (record.attributes)
	    var template = values[1]
	    if (template)
	    	return Mustache.render(template, record);
	    else return "";
  }
  
  function HtmlExtFormatter(row, cell, values, columnDef, dataContext) {
	    if (values == null || values.length < 2)
	        return "";
	    
	    var record = values[0]  // must be a record class instance
	    var extFormula = values[1]
	    
      return extFormula(record);
}
  
})(jQuery);