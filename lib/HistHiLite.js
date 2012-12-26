// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/HistHiLite.htm
//
// container_id: the CSS ID of the container to create the histogram (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  - data: Array of URLs (as strings) of json-encoded datasets
function Stici_HistHiLite(container_id, params) {
  var self = this;

  if (!params instanceof Object) {
    console.error('Stici_HistHiLite params should be an object');
    return;
  }

  // Configuration options.
  this.options = params;

  // jQuery object containing the entire chart.
  this.container = jQuery('#' + container_id);

  // Labels for the data.
  this.dataFields = null;

  // The data itself.
  this.dataValues = null;

  // The URL we got the JSON-encoded data from.
  this.dataSource = null;

  // Various handles to important jQuery objects.
  this.urlInput = null;
  this.dataSelect = null;
  this.variableSelect = null;
  this.chartDiv = null;
  this.areaFromInput = null;
  this.areaToInput = null;
  this.binsInput = null;

  if (!params.data instanceof Array) {
    this.dataSource = null;
    this.options.data = [];
  } else {
    this.dataSource = this.options.data[0];
  }

  // Reloads chart data from this.data_source
  this.reloadData = function() {
    self.options.data = [];
    self.dataFields = [];
    self.dataValues = [];

    jQuery.getJSON(self.dataSource, function(data) {
      self.dataFields = data[0];
      self.dataValues = data.slice(1);
      self.variableSelect.children().remove();
      jQuery.each(self.dataFields, function(i, field) {
        self.variableSelect.append(
          jQuery('<option/>').attr('value', i).text(field)
        );
      });
      self.variableSelect.val(2);  // TODO(jmeady): un-hardcode this.

      self.reloadChart();
    });
  };

  this.reloadChart = function() {
    self.chartDiv.children().remove();
    var data = jQuery.map(self.dataValues, function(values) {
      return values[self.variableSelect.val()];
    });
    var nBins = parseInt(self.binsInput.val(), 10);

    var histogramData = histMakeCounts(histMakeBins(nBins, data), data);
    var histMax = histogramData.max();
    d3.select(self.chartDiv.get(0))
      .selectAll('div')
      .data(histogramData)
      .enter()
      .append('div')
      .style('height', function(d) { return d / histMax * 100 + '%'; })
      .style('left', function(d, i) { return (i * 100 / nBins) + '%'; })
      .style('width', 100 / nBins + '%')
      .text(function(d) { return (d * 100).toFixed(2); });
  };

  // Initializes the chart controls. Adds the sliders, input fields, etc.
  function initControls() {
    var o = jQuery('<div/>').addClass('stici');
    self.container.append(o);

    // Top controls
    self.urlInput = jQuery('<input type="text" />');
    self.dataSelect = jQuery('<select/>').change(self.reloadData);
    self.variableSelect = jQuery('<select/>').change(self.reloadChart);

    var top = jQuery('<div/>').addClass('top_controls');
    top.append('Data: ').append(self.dataSelect);
    jQuery.each(this.options.data, function(i, dataUrl) {
      self.dataSelect.append(jQuery('<option/>')
                     .attr('value', dataUrl)
                     .text(dataUrl));
    });
    top.append('Variable: ').append(self.variableSelect);
    o.append(top);

    // Chart
    self.chartDiv = jQuery('<div/>').addClass('stici_chart');
    o.append(self.chartDiv);

    // Bottom controls
    var bottom = jQuery('<div/>').addClass('bottom_controls');
    o.append(bottom);
    self.binsInput = jQuery('<input type="text" />').val(10);
    bottom.append('Bins: ').append(self.binsInput);
  }

  initControls();
  this.reloadData();
}
