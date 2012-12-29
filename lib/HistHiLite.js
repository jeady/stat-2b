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

  // Currently rendered data.
  this.data = null;

  // Various handles to important jQuery objects.
  this.urlInput = null;
  this.dataSelect = null;
  this.variableSelect = null;
  this.chartDiv = null;
  this.overlayDiv = null;  // Used for the area selection feature.
  this.areaFromInput = null;
  this.areaFromSlider = null;
  this.areaToInput = null;
  this.areaToSlider = null;
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
    var normalChartDiv = jQuery('<div/>').addClass('chart_box');
    self.overlayDiv = normalChartDiv.clone().addClass('overlay');
    self.chartDiv.append(normalChartDiv);
    self.chartDiv.append(self.overlayDiv);
    var data = jQuery.map(self.dataValues, function(values) {
      return values[self.variableSelect.val()];
    });
    self.data = data;
    var nBins = parseInt(self.binsInput.val(), 10);

    var width = self.overlayDiv.width();
    var height = self.overlayDiv.height();
    var histogramData = histMakeCounts(histMakeBins(nBins, data), data);
    var histMax = histogramData.max();
    function appendSvg(div) {
      return d3.select(div.get(0)).append('svg')
        .selectAll('div')
        .data(histogramData)
        .enter()
        .append('rect')
        .attr('y', function(d) { return height - d / histMax * height; })
        .attr('height', function(d) { return d / histMax * height; })
        .attr('x', function(d, i) { return (i * width / nBins); })
        .attr('width', width / nBins);
    }
    appendSvg(normalChartDiv);
    appendSvg(self.overlayDiv);
    self.overlayDiv.css('clip', 'rect(0px, 0px, ' + height + 'px, 0px)');

    var axisSvg = d3.select(normalChartDiv.get(0))
                .append('svg')
                .attr('class', 'axis');
    var axisScale = d3.scale.linear().domain([data.min(), data.max()]).range([0, width]);
    var axis = d3.svg.axis().scale(axisScale).orient('bottom');
    axisSvg.append('g').call(axis);

    self.areaFromSlider.slider('option', 'min', data.min());
    self.areaFromSlider.slider('option', 'value', data.min());
    self.areaFromSlider.slider('option', 'max', data.max());
    self.areaFromInput.val(data.min());
    self.areaToSlider.slider('option', 'min', data.min());
    self.areaToSlider.slider('option', 'value', data.min());
    self.areaToSlider.slider('option', 'max', data.max());
    self.areaToInput.val(data.min());
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
    self.chartDiv = jQuery('<div/>')
                      .addClass('stici_chart')
                      .addClass('chart_box');
    o.append(self.chartDiv);

    // Bottom controls
    var bottom = jQuery('<div/>').addClass('bottom_controls');
    o.append(bottom);
    self.binsInput = jQuery('<input type="text" />')
                       .val(10)
                       .change(self.reloadChart);
    self.areaFromInput = jQuery('<input type="text" />').change(function() {
      self.areaFromSlider.slider('value', self.areaFromInput.val());
    });
    var updateAreaFromInput = function() {
      self.areaFromInput.val(self.areaFromSlider.slider('value'));
      // TODO(jmeady): DRY this out.
      var left = (self.areaFromSlider.slider('value') - self.data.min()) /
                 ((self.data.max() - self.data.min())) * self.chartDiv.width();
      var right = (self.areaToSlider.slider('value') - self.data.min()) /
                  ((self.data.max() - self.data.min())) * self.chartDiv.width();
      self.overlayDiv.css('clip',
                          'rect(0px,' +
                                right + 'px,' +
                                self.chartDiv.height() + 'px,' +
                                left + 'px)');
    };
    self.areaFromSlider = jQuery('<span/>').addClass('slider').slider({
      change: updateAreaFromInput,
      slide: updateAreaFromInput,
      step: 0.01
    });
    bottom.append('Area From: ').append(areaFromInput).append(areaFromSlider);
    self.areaToInput = jQuery('<input type="text" />').change(function() {
      self.areaToSlider.slider('value', self.areaToInput.val());
    });
    var updateAreaToInput = function() {
      self.areaToInput.val(self.areaToSlider.slider('value'));
      var left = (self.areaFromSlider.slider('value') - self.data.min()) /
                 ((self.data.max() - self.data.min())) * self.chartDiv.width();
      var right = (self.areaToSlider.slider('value') - self.data.min()) /
                  ((self.data.max() - self.data.min())) * self.chartDiv.width();
      self.overlayDiv.css('clip',
                          'rect(0px,' +
                                right + 'px,' +
                                self.chartDiv.height() + 'px,' +
                                left + 'px)');
    };
    self.areaToSlider = jQuery('<span/>').addClass('slider').slider({
      change: updateAreaToInput,
      slide: updateAreaToInput,
      step: 0.01
    });
    bottom.append('Area To: ').append(areaToInput).append(areaToSlider);
    bottom.append('Bins: ').append(self.binsInput);
  }

  initControls();
  this.reloadData();
}
