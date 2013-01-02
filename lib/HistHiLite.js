// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/HistHiLite.htm
//
// Author: James Eady <jeady@berkeley.edu>
//
// container_id: the CSS ID of the container to create the histogram (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  // Array of URLs (as strings) of json-encoded datasets.
//  - data: null
//
//  // Whether or not to display the 'Show Normal' button.
//  - showNormalButton: true
//
//  // NOT IMPLEMENTED BELOWE THIS LINE //
//  // -------------------------------- //
//
//  // Array of bin counts to use instead of parsing data. If set, data cannot
//  // be set.
//  - counts: null
//
//  // Array of bin ends. If counts is set, ends must also be set.
//  - ends: null
//
//  // Show normal by default. Normal can still be toggled by the button.
//  - showNormal: false
//
//  // Default number of bins to display.
//  - bins: 10
//
//  // Whether the user can set the number of bins.
//  - changeNumBins: true
//
//  // Wether or not to display the 'Show Univariate Stats' button.
//  - showUnivariateStats: true
function Stici_HistHiLite(container_id, params) {
  var self = this;

  if (!params instanceof Object) {
    console.error('Stici_HistHiLite params should be an object');
    return;
  }

  // Configuration option defaults.
  this.options = {
    data: null,
    showNormalButton: false
  };

  // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

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

  // Histogram information calculated via stat_utils.js. Cached here.
  this.binEnds = null;
  this.binCounts = null;

  // Various handles to important jQuery objects.
  this.urlInput = null;
  this.dataSelect = null;
  this.variableSelect = null;
  this.chartDiv = null;
  this.overlayDiv = null;  // Used for the area selection feature.
  this.normalOverlayDiv = null;
  this.areaFromInput = null;
  this.areaFromSlider = null;
  this.areaToInput = null;
  this.areaToSlider = null;
  this.binsInput = null;
  this.areaInfoDiv = null;
  this.showingNormal = false;

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
    self.normalOverlayDiv = jQuery('<div/>').addClass('chart_box').hide();
    self.chartDiv.append(normalChartDiv);
    self.chartDiv.append(self.overlayDiv);
    self.chartDiv.append(self.normalOverlayDiv);

    // Background calculations about the data.
    var data = jQuery.map(self.dataValues, function(values) {
      return values[self.variableSelect.val()];
    });
    self.data = data;
    var nBins = parseInt(self.binsInput.val(), 10);
    var width = self.overlayDiv.width();
    var height = self.overlayDiv.height();
    self.binEnds = histMakeBins(nBins, data);
    self.binCounts = histMakeCounts(self.binEnds, data);
    var dataMu = mean(self.data);
    var dataSd = sd(self.data);

    // Calculate the scaling by taking the max of the histogram bar heights
    // and the y-coordinate of the points on the normal curve.
    var normalCurveY = function(d) {
      var x =
        self.binEnds[0] +
        d * (self.binEnds[nBins] - self.binEnds[0]) / (width - 1);
      var y = normPdf(dataMu, dataSd, x);
      return y;
    };
    var yScale = null;
    var i;
    // TODO(jmeady): Include height in yScale.
    for (i = 0; i < width; i++) {
      if (yScale === null || normalCurveY(i) > yScale)
        yScale = normalCurveY(i);
      console.log('yScale = ' + yScale);
    }
    console.log('yScale = ' + yScale);
    yScale = Math.max(self.binCounts.max(), yScale);
    yScale /= (height - 1);
    console.log('binCount = ' + self.binCounts.max());
    console.log('yScale = ' + yScale);

    // Draw the histogram as an SVG. We draw a second copy to use as the
    // area overlay and use absolute positioning to put them on top of each
    // other.
    function appendSvg(div) {
      return d3.select(div.get(0)).append('svg')
        .selectAll('div')
        .data(self.binCounts)
        .enter()
        .append('rect')
        .attr('y', function(d) { return height - d / yScale; })
        .attr('height', function(d) { return d / yScale; })
        .attr('x', function(d, i) { return (i * width / nBins); })
        .attr('width', width / nBins);
    }
    appendSvg(normalChartDiv);
    appendSvg(self.overlayDiv);
    self.overlayDiv.css('clip', 'rect(0px, 0px, ' + height + 'px, 0px)');

    // Draw the axis
    var axisSvg = d3.select(normalChartDiv.get(0))
                .append('svg')
                .attr('class', 'axis');
    var axisScale = d3.scale.linear().domain([data.min(), data.max()]).range([0, width]);
    var axis = d3.svg.axis().scale(axisScale).orient('bottom');
    axisSvg.append('g').call(axis);

    // Draw the normal curve and then hide it. We can show it by toggling
    // its css.
    var normalCurve =
      d3.svg.line()
        .x(function(d) {return d;})
        .y(function(d) {
          return height - (normalCurveY(d) / yScale);
        });
    d3.select(self.normalOverlayDiv.get(0)).append('svg')
      .append('path')
      .data([d3.range(0, width)])
      .attr('d', normalCurve)
      .style('fill', 'none')
      .style('stroke', '#000000');

    self.areaFromSlider.slider('option', 'min', data.min());
    self.areaFromSlider.slider('option', 'value', data.min());
    self.areaFromSlider.slider('option', 'max', data.max());
    self.areaFromInput.val(data.min());
    self.areaToSlider.slider('option', 'min', data.min());
    self.areaToSlider.slider('option', 'value', data.min());
    self.areaToSlider.slider('option', 'max', data.max());
    self.areaToInput.val(data.min());
    self.showingNormal = false;
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

    // Area info overlay
    self.areaInfoDiv = jQuery('<div/>')
                         .addClass('area_info');
    o.append(self.areaInfoDiv);

    // Bottom controls
    var bottom = jQuery('<div/>').addClass('bottom_controls');
    o.append(bottom);
    var row1 = jQuery('<span/>');
    var row2 = jQuery('<span/>');
    bottom.append(row1).append(row2);
    self.binsInput = jQuery('<input type="text" />')
                       .val(10)
                       .change(self.reloadChart);

    // Helper function that is called whenever any of the area overlay sliders
    // or inputs are changed.
    function refreshSelectedAreaOverlay() {
      var lower = parseFloat(self.areaFromSlider.slider('value'));
      var upper = parseFloat(self.areaToSlider.slider('value'));
      var scale = self.chartDiv.width() / (self.data.max() - self.data.min());
      var left = (lower - self.data.min()) * scale;
      var right = (upper - self.data.min()) * scale;
      self.overlayDiv.css('clip',
                          'rect(0px,' +
                                right + 'px,' +
                                self.chartDiv.height() + 'px,' +
                                left + 'px)');
      var p = histHiLitArea(lower, upper, self.binEnds, self.binCounts) * 100;
      var text = 'Selected area: ' + p.fix(2) + '%';
      if (self.showingNormal) {
        var m = mean(self.data);
        var s = sd(self.data);
        p = (normCdf((upper - m) / s) - normCdf((lower - m) / s)) * 100;
        text += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
        text += 'Normal approx: ' + p.fix(2) + '%';
      }

      self.areaInfoDiv.html(text);
    }

    // Area from input/slider.
    self.areaFromInput = jQuery('<input type="text" />').change(function() {
      self.areaFromSlider.slider('value', self.areaFromInput.val());
    });
    var updateAreaFromInput = function() {
      self.areaFromInput.val(self.areaFromSlider.slider('value'));
      refreshSelectedAreaOverlay();
    };
    self.areaFromSlider = jQuery('<span/>').addClass('slider').slider({
      change: updateAreaFromInput,
      slide: updateAreaFromInput,
      step: 0.001
    });
    row1.append('Area From: ').append(areaFromInput).append(areaFromSlider);
    self.areaToInput = jQuery('<input type="text" />').change(function() {
      self.areaToSlider.slider('value', self.areaToInput.val());
    });

    // Area to input/slider.
    var updateAreaToInput = function() {
      self.areaToInput.val(self.areaToSlider.slider('value'));
      refreshSelectedAreaOverlay();
    };
    self.areaToSlider = jQuery('<span/>').addClass('slider').slider({
      change: updateAreaToInput,
      slide: updateAreaToInput,
      step: 0.001
    });
    row1.append('Area To: ').append(areaToInput).append(areaToSlider);

    row1.append('Bins: ').append(self.binsInput);

    // Extra info buttons
    // TODO(jmeady): Move this into a more general file
    function createPopBox() {
      var parent = jQuery('<div/>').addClass('popbox');
      var open = jQuery('<button/>').addClass('open').text('Click Here!');
      var collapse = jQuery('<div/>').addClass('collapse');
      var box = jQuery('<div/>').addClass('box');
      var content = jQuery('<p/>').text('Content Here :)');

      parent.append(open).append(collapse);
      collapse.append(box);
      box.append(jQuery('<div/>').addClass('arrow'))
         .append(jQuery('<div/>').addClass('arrow-border'))
         .append(content)
         .append(jQuery('<a/>').addClass('close')
                               .attr('href', '#')
                               .text('close'));

      return {
        parent: parent,
        button: open,
        content: content
      };
    }
    var listDataButton = createPopBox();
    listDataButton.button.text('List Data');
    listDataButton.content.css('max-height', '200px')
                          .css('overflow-y', 'auto');
    listDataButton.button.click(function() {
      var data = '<table><tr>';
      var i = 0;
      for (i = 0; i < self.dataFields.length; i++)
        data += '<th>' + self.dataFields[i] + '</th>';
      data += '</tr>';
      for (i = 0; i < self.dataValues.length; i++) {
        data += '<tr>';
        for (var j = 0; j < self.dataValues[i].length; j++)
          data += '<td>' + self.dataValues[i][j] + '</td>';
        data += '</tr>';
      }
      data += '</table>';
      listDataButton.content.html(data);
    });
    row2.append(listDataButton.parent);

    var statsButton = createPopBox();
    statsButton.button.text('Univariate Stats');
    statsButton.button.click(function() {
      var text = '';
      text += 'Cases: ' + self.data.length + '<br />';
      text += 'Mean: ' + mean(self.data).fix(2) + '<br />';
      text += 'SD: ' + sd(self.data).fix(2) + '<br />';
      text += 'Min: ' + self.data.min().fix(2) + '<br />';
      text += 'LQ: ' + percentile(self.data, 25).fix(2) + '<br />';
      text += 'Median: ' + percentile(self.data, 50).fix(2) + '<br />';
      text += 'UQ: ' + percentile(self.data, 75).fix(2) + '<br />';
      text += 'Max: ' + self.data.max().fix(2) + '<br />';
      statsButton.content.html(text);
    });
    row2.append(statsButton.parent);

    var normalButton = jQuery('<button/>')
                         .addClass('open')
                         .text('Show Normal Curve');
    normalButton.click(function() {
      self.normalOverlayDiv.toggle();
      if (!self.showingNormal)
        normalButton.text(normalButton.text().replace('Show', 'Hide'));
      else
        normalButton.text(normalButton.text().replace('Hide', 'Show'));
      self.showingNormal = !self.showingNormal;
      refreshSelectedAreaOverlay();
    });
    if (self.options.showNormalButton)
      row2.append(normalButton);

    jQuery('.popbox').popbox();
  }

  initControls();
  this.reloadData();
}
