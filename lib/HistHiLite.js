// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/HistHiLite.htm
//
// Author: James Eady <jeady@berkeley.edu>
//
// container_id: the CSS ID of the container to create the histogram (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  // Show normal by default. Normal can still be toggled by the button.
//  - showNormal: false
//
//  // Whether or not to display the 'Show Normal' button.
//  - showNormalButton: true
//
//  // Default number of bins to display.
//  - bins: 10
//
//  // Whether the user can set the number of bins.
//  - changeNumBins: true
//
//  // Whether or not to display the 'Show Univariate Stats' button.
//  - showUnivariateStats: true
//
//  // Initial bounds for area from/to sliders.
//  - hiLiteHi: null
//  - hiLiteLo null
//
//  // There are three different ways to supply input to the histogram:
//  // 1) External JSON-encoded data file.
//  // 2) Manual specification of bin ends and counts.
//  // 3) Binomial distribution generated from given n and p.
//  //
//  // These input methods are all mutually exclusive - if the parameters for a
//  // particular input method are set, then the parameters for the other input
//  // methods should not be set.
//
//  // 1) External JSON-encoded data file
//
//  // Array of URLs (as strings) of json-encoded datasets.
//  - data: null
//
//  // Whether or not to display the 'List Data' button.
//  - listData: true
//
//  // 2) Manual specification of bin ends and counts.
//  //
//  // showNormal, showNormalButton, showUnivariateStats, changeNumBins, and
//  // listData will all automatically be set to false by default. The normal
//  // curve may be enabled, but mu and sd must be specified.
//
//  // Array of bin counts to use instead of parsing data.
//  - counts: null
//
//  // Array of bin ends. If counts is set, ends must also be set.
//  - ends: null
//
//  // Manually specify data mean.
//  - mu: null
//
//  // Manually specify data standard deviation.
//  - sd: null
//
//  // 3) Binomial distribution generated from given n and p.
//
//  // Number of trials.
//  - n: null
//
//  // Probability of success.
//  - p: null

function Stici_HistHiLite(container_id, params) {
  var self = this;

  if (!params instanceof Object) {
    console.error('Stici_HistHiLite params should be an object');
    return;
  }

  // Configuration option defaults.
  this.options = {
    showNormalButton: true,
    showNormal: false,
    bins: 10,
    changeNumBins: true,
    showUnivariateStats: true,
    hiLiteHi: null,
    hiLiteLo: null,
    data: null,
    listData: true,
    counts: null,
    ends: null,
    n: null,
    p: null
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
  this.nBins = self.options.bins;
  this.binEnds = null;
  this.binCounts = null;
  this.sd = 0;
  this.mu = 0;

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
  this.showNormalButton = null;
  this.showingNormal = false;

  if (self.options.n !== null || self.options.p !== null) {
    self.options.showUnivariateStats = false;
    self.options.listData = false;
    self.options.changeNumBins = false;
  } else if (self.options.counts !== null || self.options.ends !== null) {
    this.dataSource = null;
    if (!params.showNormal)
      self.options.showNormal = false;
    if (!params.showNormalButton)
      self.options.showNormalButton = false;
    self.options.showUnivariateStats = false;
    self.options.listData = false;
    self.options.changeNumBins = false;
  } else if (self.options.data instanceof Array) {
    this.dataSource = this.options.data[0];
  } else {
    console.error('Unknown data source.');
    return;
  }

  self.showingNormal = self.options.showNormal;

  // Reloads chart data from this.data_source
  this.reloadData = function() {
    var i = 0;
    self.dataFields = [];
    self.dataValues = [];

    if (self.options.data !== null) {
      self.dataSource = self.dataSelect.val();
      jQuery.getJSON(self.dataSource, function(data) {
        self.dataFields = data[0];
        self.dataValues = data.slice(1);
        self.variableSelect.children().remove();
        jQuery.each(self.dataFields, function(i, field) {
          if (field.indexOf('//') === 0)
            return;

          self.variableSelect.append(
            jQuery('<option/>').attr('value', i).text(field)
          );
        });
        self.variableSelect.val(2);  // TODO(jmeady): un-hardcode this.

        self.data = jQuery.map(self.dataValues, function(values) {
          return parseFloat(values[self.variableSelect.val()]);
        });
        self.binEnds = histMakeBins(self.nBins, self.data);
        self.binCounts = histMakeCounts(self.binEnds, self.data);
        self.sd = sd(self.data);
        self.mu = mean(self.data);

        self.reloadChart();
      });
    } else if (self.options.n === null || self.options.p === null) {
      self.data = [self.options.ends.min(), self.options.ends.max()];
      if (self.options.sd === null)
        self.sd = sd(self.data);
      else
        self.sd = self.options.sd;
      if (self.options.mu === null)
        self.mu = mean(self.data);
      else
        self.mu = self.options.mu;
      self.binEnds = self.options.ends;
      self.binCounts = self.options.counts;
      var total = self.binCounts.reduce(function(a, b) { return a + b; });
      for (i = 0; i < self.binCounts.length; i++) {
        self.binCounts[i] /= total * (self.binEnds[i + 1] - self.binEnds[i]);
      }
      self.reloadChart();
    } else {
      var p = self.options.p;
      var n = self.options.n;
      self.nBins = n + 1;
      self.binCounts = [Math.pow((1 - p), n)];
      self.binEnds = [-0.5];
      for (i = 1; i < self.nBins; i++) {
        if (p < 1) {
          self.binCounts.push(
            self.binCounts[i - 1] * p * (n - i + 1) / ((1 - p) * i));
        } else {
          self.binCounts.push(0);
        }
        self.binEnds.push(i - 0.5);
      }
      self.binEnds.push(n + 0.5);
      if (p == 1)
        self.binCounts[self.nBins - 1] = 1;
      self.sd = Math.sqrt(n * p * (1 - p));
      self.mu = n * p;
      self.reloadChart();
    }
  };

  this.reloadChart = function() {
    var i;
    self.chartDiv.children().remove();
    var normalChartDiv = jQuery('<div/>').addClass('chart_box');
    self.overlayDiv = normalChartDiv.clone().addClass('overlay');
    self.normalOverlayDiv = jQuery('<div/>').addClass('chart_box');
    self.chartDiv.append(normalChartDiv);
    self.chartDiv.append(self.overlayDiv);
    self.chartDiv.append(self.normalOverlayDiv);

    // Background calculations.
    var width = self.overlayDiv.width();
    var height = self.overlayDiv.height();
    var graphWidth = self.binEnds.max() - self.binEnds.min();

    // Calculate the scaling by taking the max of the histogram bar heights
    // and the y-coordinate of the points on the normal curve.
    var normalCurveY = function(d) {
      var x =
        self.binEnds[0] +
        d * (self.binEnds[self.nBins] - self.binEnds[0]) / (width - 1);
      var y = normPdf(self.mu, self.sd, x);
      return y;
    };
    var yScale = null;
    // TODO(jmeady): Include height in yScale.
    for (i = 0; i < width; i++) {
      if ((yScale === null || normalCurveY(i) > yScale) &&
          !isNaN(normalCurveY(i)))
        yScale = normalCurveY(i);
    }
    yScale = Math.max(self.binCounts.max(), yScale);
    yScale /= (height - 1);

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
        .attr('x', function(d, i) {
          return (width * (self.binEnds[i] - self.binEnds.min()) / graphWidth);
        })
        .attr('width', function(d, i) {
          return width * (self.binEnds[i + 1] - self.binEnds[i]) / graphWidth;
        });
    }
    appendSvg(normalChartDiv);
    appendSvg(self.overlayDiv);
    self.overlayDiv.css('clip', 'rect(0px, 0px, ' + height + 'px, 0px)');

    // Draw the axis
    var axisSvg = d3.select(normalChartDiv.get(0))
                .append('svg')
                .attr('class', 'axis');
    var axisScale = d3.scale.linear()
                            .domain([self.binEnds.min(), self.binEnds.max()])
                            .range([0, width]);
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

    self.areaFromSlider.slider('option', 'min', self.binEnds.min());
    self.areaFromSlider.slider('option', 'max', self.binEnds.max());
    if (self.options.hiLiteLo === null) {
      self.areaFromSlider.slider('option', 'value', self.binEnds.min());
      self.areaFromInput.val(self.binEnds.min());
    } else {
      self.areaFromSlider.slider('option', 'value', self.options.hiLiteLo);
      self.areaFromInput.val(self.options.hiLiteLo);
    }
    self.areaToSlider.slider('option', 'min', self.binEnds.min());
    self.areaToSlider.slider('option', 'max', self.binEnds.max());
    if (self.options.hiLiteHi === null) {
      self.areaToSlider.slider('option', 'value', self.binEnds.min());
      self.areaToInput.val(self.binEnds.min());
    } else {
      self.areaToSlider.slider('option', 'value', self.options.hiLiteHi);
      self.areaToInput.val(self.options.hiLiteHi);
    }

    self.showingNormal = self.options.showNormal;
    if (self.options.showNormal) {
      self.showNormalButton.text('Hide Normal Curve');
    } else {
      self.showNormalButton.text('Show Normal Curve');
      self.normalOverlayDiv.hide();
    }
  };

  // Initializes the chart controls. Adds the sliders, input fields, etc.
  function initControls() {
    var o = jQuery('<div/>').addClass('stici').addClass('stici_histogram');
    self.container.append(o);

    // Top controls
    if (self.dataSource !== null) {
      self.urlInput = jQuery('<input type="text" />');
      self.dataSelect = jQuery('<select/>').change(self.reloadData);
      self.variableSelect = jQuery('<select/>').change(self.reloadChart);

      var top = jQuery('<div/>').addClass('top_controls');
      top.append('Data: ').append(self.dataSelect);
      jQuery.each(self.options.data, function(i, dataUrl) {
        self.dataSelect.append(jQuery('<option/>')
                       .attr('value', dataUrl)
                       .text(dataUrl));
      });
      top.append('Variable: ').append(self.variableSelect);
      o.append(top);
    }

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
    var row1 = jQuery('<div/>');
    var row2 = jQuery('<div/>');
    bottom.append(row1).append(row2);
    self.binsInput = jQuery('<input type="text" />')
                       .val(self.options.bins);
    self.binsInput.change(function() {
      self.nBins = parseInt(self.binsInput.val(), 10);
      self.reloadChart();
    });
    if (!self.options.changeNumBins)
      self.binsInput.attr('readonly', '');

    // Helper function that is called whenever any of the area overlay sliders
    // or inputs are changed.
    function refreshSelectedAreaOverlay() {
      var lower = parseFloat(self.areaFromSlider.slider('value'));
      var upper = parseFloat(self.areaToSlider.slider('value'));
      var scale = self.chartDiv.width() /
        (self.binEnds.max() - self.binEnds.min());
      var left = (lower - self.binEnds.min()) * scale;
      var right = (upper - self.binEnds.min()) * scale;
      self.overlayDiv.css('clip',
                          'rect(0px,' +
                                right + 'px,' +
                                self.chartDiv.height() + 'px,' +
                                left + 'px)');
      var p = histHiLitArea(lower, upper, self.binEnds, self.binCounts) * 100;
      var text = 'Selected area: ' + p.fix(2) + '%';
      if (self.showingNormal) {
        var m = self.mu;
        var s = self.sd;
        p = Math.max(
          0,
          (normCdf((upper - m) / s) - normCdf((lower - m) / s)) * 100
        );
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
    row1.append('Area from: ').append(self.areaFromInput)
                              .append(self.areaFromSlider);

    // Area to input/slider.
    self.areaToInput = jQuery('<input type="text" />').change(function() {
      self.areaToSlider.slider('value', self.areaToInput.val());
    });
    var updateAreaToInput = function() {
      self.areaToInput.val(self.areaToSlider.slider('value'));
      refreshSelectedAreaOverlay();
    };
    self.areaToSlider = jQuery('<span/>').addClass('slider').slider({
      change: updateAreaToInput,
      slide: updateAreaToInput,
      step: 0.001
    });
    row1.append(' to: ').append(self.areaToInput).append(self.areaToSlider);

    row1.append('Bins: ').append(self.binsInput);

    // Extra info buttons
    // TODO(jmeady): Move this into a more general file
    function createPopBox() {
      var parent = jQuery('<div/>').addClass('popbox');
      var open = jQuery('<button/>').addClass('open').text('Click Here!');
      var collapse = jQuery('<div/>').addClass('collapse');
      collapse.html(
        '<div class="box">' +
        '  <div class="arrow"></div>' +
        '  <div class="arrow-border"></div>' +
        '  <div class="popbox-content">' +
        '  </div>' +
        '  <a href="#" class="close">close</a>' +
        '</div>');
      parent.append(open).append(collapse);

      var content = collapse.find('.popbox-content');
      content.text('Content Here :)');

      parent.data('onPopBox', function() {
        parent.find('.viewport').parent().width(content.width() + 20);
      });

      return {
        parent: parent,
        button: open,
        content: content
      };
    }
    var lastListDataHeader = null;
    var listDataButton = createPopBox();
    listDataButton.button.text('List Data');
    listDataButton.button.click(function(e) {
      e.preventDefault();
      // Thank you Ken
      var dataFields  = self.dataFields,
          dataValues  = self.dataValues,
          numDataFields = dataFields.length,
          tempDataRow,
          tempDataCell,
          tempConcatData,
          html;

      html = '<div class="table-container">'+
          '<div class="table-header">' +
            '<table class="data-fields">' +
              '<thead>' +
                '<tr>';
      for (var i = 0; i < dataFields.length; i++) {
        html += '<td>' + dataFields[i] + '</td>';
      }
      html += '</tr>' +
          '</thead>' +
        '</table>' +
      '</div>';

      html += '<div class="table-body">' +
        '<table class="data-values">' +
          '<tbody>';
      for (var j = 0; j < dataValues.length; j++) {
        tempDataRow = dataValues[j];
        if (tempDataRow.length > dataFields.length) {
          // concat last elements
          tempConcatData = tempDataRow.slice(dataFields.length - 1).join(' ').replace(/[\/]/g, '');
          tempDataRow = tempDataRow.slice(0, dataFields.length - 1);
          tempDataRow.push(tempConcatData);
        }
        html += '<tr data-index="' + j + '">';
        for (var k = 0; k < tempDataRow.length; k++) {
          tempDataCell = tempDataRow[k];
          html += '<td>' + tempDataCell + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
      listDataButton.content.html(html);
    });
    if (self.options.listData) {
      row2.append(listDataButton.parent);
    }

    var statsButton = createPopBox();
    statsButton.button.text('Univariate Stats');
    statsButton.button.click(function(e) {
      e.preventDefault();
      /*var text = '';
      jQuery.each(self.dataFields, function(i) {
        text += '<b>' + self.dataFields[i] + '</b><br />';
        var data = jQuery.map(self.dataValues, function(values) {
          return parseFloat(values[i]);
        });
        text += 'Cases: ' + data.length + '<br />';
        text += 'Mean: ' + mean(data).fix(2) + '<br />';
        text += 'SD: ' + sd(data).fix(2) + '<br />';
        text += 'Min: ' + data.min().fix(2) + '<br />';
        text += 'LQ: ' + percentile(data, 25).fix(2) + '<br />';
        text += 'Median: ' + percentile(data, 50).fix(2) + '<br />';
        text += 'UQ: ' + percentile(data, 75).fix(2) + '<br />';
        text += 'Max: ' + data.max().fix(2) + '<br />';
        text += '<br />';
      });*/
      // Thank you Ken
      var html = '<div class="univariate-stats-container">';
      $.each(self.dataFields, function(index) {
        html += '<div class="univariate-stat-wrapper">' + 
                  '<h3>' + self.dataFields[index] + '</h3>';
        var data = $.map(self.dataValues, function(values) {
          return parseFloat(values[index]);
        });
        html += '<ul class="stat-list">' +
          '<li class="stat-item">Cases: ' + data.length + '</li>' +
          '<li class="stat-item">Mean: ' + mean(data).toFixed(2) + '</li>' +
          '<li class="stat-item">SD: ' + sd(data).toFixed(2) + '</li>' +
          '<li class="stat-item">Min: ' + data.min().toFixed(2) + '</li>' +
          '<li class="stat-item">LQ: ' + percentile(data, 25).toFixed(2) + '</li>' +
          '<li class="stat-item">Median: ' + percentile(data, 50).toFixed(2) + '</li>' +
          '<li class="stat-item">UQ: ' + percentile(data, 75).toFixed(2) + '</li>' +
          '<li class="stat-item">Max: ' + data.max().toFixed(2) + '</li>' +
          '</ul>';
        html += '</div>';
      });
      html += '</div>';
      statsButton.content.html(html);
    });
    if (self.options.showUnivariateStats)
      row2.append(statsButton.parent);

    self.showNormalButton = jQuery('<button/>')
                         .addClass('open');
    if (self.options.showNormal)
      self.showNormalButton.text('Hide Normal Curve');
    else
      self.showNormalButton.text('Show Normal Curve');
    self.showNormalButton.click(function(e) {
      e.preventDefault();
      self.normalOverlayDiv.toggle();
      if (!self.showingNormal)
        self.showNormalButton
            .text(self.showNormalButton.text().replace('Show', 'Hide'));
      else
        self.showNormalButton
            .text(self.showNormalButton.text().replace('Hide', 'Show'));
      self.showingNormal = !self.showingNormal;
      refreshSelectedAreaOverlay();
    });
    if (self.options.showNormalButton)
      row2.append(self.showNormalButton);

    jQuery('.popbox').popbox();
  }

  initControls();
  this.reloadData();
}
