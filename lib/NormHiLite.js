// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/NormHiLite.htm
//
// Author: James Eady <jeady@berkeley.edu>
//
// container_id: the CSS ID of the container to create the histogram (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  // Default distributions. Options are 'normal', 'chi-square', and
//  // 'Student-t'.
//  - distribution: 'normal'
//
//  // Distribution mean.
//  - mean: 0
//
//  // Distribution standard deviation.
//  - SD: 1
//
//  // Chi-square degrees of freedom
//  - df: 2
//
//  // Default hi-lit area.
//  - hiLiteLo: 0
//  - hiLiteHi: 0

function Stici_NormHiLite(container_id, params) {
  var self = this;

  if (!params instanceof Object) {
    console.error('Stici_NormHiLite params should be an object');
    return;
  }

  // Configuration option defaults.
  this.options = {
    distribution: 'normal',
    mean: 0,
    SD: 1,
    df: 2,
    hiLiteLo: 0,
    hiLiteHi: 0
  };

  // For debugging: Warn of user params that are unknown.
  jQuery.each(params, function(key) {
    if (typeof(self.options[key]) == 'undefined')
      console.warn('Stici_NormHiLite: Unknown key \'' + key + '\'');
  });

  // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

  // jQuery object containing the entire chart.
  this.container = jQuery('#' + container_id);

  this.df = self.options.df;

  // Object that contains the parameters for the selected distribution.
  this.distribution = null;
  if (this.options.distribution == 'normal') {
    this.distribution = {
      lo: function() { return -5; },
      hi: function() { return 5; },
      y: function(x) {
        return normPdf(self.options.mean, self.options.SD, x);
      }
    };
  } else if (this.options.distribution == 'Student-t') {
    this.distribution = {
      lo: function() { return -6; },
      hi: function() { return 6; },
      y: function(x) {
        return tPdf(self.df, x);
      }
    };
  } else if (this.options.distribution == 'chi-square') {
    this.distribution = {
      lo: function() { return 0; },
      hi: function() { return 6 * self.df; },
      y: function(x) {
        return chi2Pdf(self.df, x);
      }
    };
  } else {
    console.error('Stici_NormHiLite: Unknown distribution specified.');
    this.container.text('Unknown distributions specified.');
    return;
  }

  // Various handles to important jQuery objects.
  this.chartDiv = null;
  this.overlayDiv = null;  // Used for the area selection feature.
  this.normalOverlayDiv = null;
  this.areaFromInput = null;
  this.areaFromSlider = null;
  this.areaToInput = null;
  this.areaToSlider = null;
  this.areaInfoDiv = null;
  this.additionalInfo = null;

  this.reloadChart = function() {
    redrawChart();

    if (self.options.hiLiteLo === null) {
      self.areaFromSlider.slider('option', 'value', self.distribution.lo());
      self.areaFromInput.val(self.distribution.lo());
    } else {
      self.areaFromSlider.slider('option', 'value', self.options.hiLiteLo);
      self.areaFromInput.val(self.options.hiLiteLo);
    }
    if (self.options.hiLiteHi === null) {
      self.areaToSlider.slider('option', 'value', self.distribution.lo());
      self.areaToInput.val(self.distribution.lo());
    } else {
      self.areaToSlider.slider('option', 'value', self.options.hiLiteHi);
      self.areaToInput.val(self.options.hiLiteHi);
    }
  };
  function redrawChart() {
    self.areaFromSlider.slider('option', 'min', self.distribution.lo());
    self.areaFromSlider.slider('option', 'max', self.distribution.hi());
    self.areaToSlider.slider('option', 'min', self.distribution.lo());
    self.areaToSlider.slider('option', 'max', self.distribution.hi());

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
    var graphWidth = self.distribution.hi() - self.distribution.lo();

    function remappedY(d) {
      var remappedD = (d / width) * graphWidth + self.distribution.lo();
      return self.distribution.y(remappedD);
    }
    var yScale = 0;
    for(i = 0; i < width; i++)
      yScale = Math.max(yScale, remappedY(i));
    yScale /= (height - 1);

    var curve =
      d3.svg.line()
        .x(function(d) {return d;})
        .y(function(d) {
          return height - (remappedY(d) / yScale);
        });
    d3.select(normalChartDiv.get(0)).append('svg')
      .append('path')
      .data([d3.range(0, width)])
      .attr('d', curve);

    var overlayCurve =
      d3.svg.line()
        .x(function(d, i) {
          return d;
        })
        .y(function(d, i) {
          return height - (remappedY(d) / yScale);
        });
    var overlayDat = d3.range(0, width);
    d3.select(self.overlayDiv.get(0)).append('svg')
      .append('path')
      .data([overlayDat])
      .attr('d', overlayCurve);
    self.overlayDiv.css('clip', 'rect(0px, 0px, ' + height + 'px, 0px)');

    // Draw the axis
    var axisSvg = d3.select(normalChartDiv.get(0))
                .append('svg')
                .attr('class', 'axis');
    var axisScale =
      d3.scale.linear()
              .domain([self.distribution.lo(), self.distribution.hi()])
              .range([0, width]);
    var axis = d3.svg.axis().scale(axisScale).orient('bottom');
    axisSvg.append('g').call(axis);

    refreshSelectedAreaOverlay();
  }

  // Initializes the chart controls. Adds the sliders, input fields, etc.
  function initControls() {
    // Create html for basic structure:
    // top_controls -> stici_chart -> area_info -> botom_controls.
    var o = jQuery('<div/>').addClass('stici').addClass('stici_histogram');
    self.container.append(o);
    var top = jQuery('<div/>').addClass('top_controls');
    o.append(top);
    self.chartDiv = jQuery('<div/>')
                      .addClass('stici_chart')
                      .addClass('chart_box');
    o.append(self.chartDiv);
    self.areaInfoDiv = jQuery('<div/>')
                         .addClass('area_info');
    o.append(self.areaInfoDiv);
    var bottom = jQuery('<div/>').addClass('bottom_controls');
    o.append(bottom);

    var rowHeight = 30;  // px
    var topOffset = 0;
    var bottomOffset = 0;
    function appendHeaderRow(o) {
      top.append(o);
      topOffset += rowHeight;
    }
    function appendFooterRow(o) {
      bottom.append(o);
      bottomOffset += rowHeight;
    }
    function createAreaSelectControls() {
      var row = jQuery('<div/>');

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
      row.append('Lower endpoint: ').append(self.areaFromInput)
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
      row.append(' Upper endpoint: ').append(self.areaToInput).append(self.areaToSlider);

      appendFooterRow(row);
    }

    function createDegreesOfFreedom() {
      var row = jQuery('<div/>');

      dfInput = jQuery('<input type="text" />').change(function() {
        dfSlider.slider('value', dfInput.val());
      });
      var updateDfInput = function() {
        self.df = dfSlider.slider('value');
        dfInput.val(dfSlider.slider('value'));
        redrawChart();
        refreshSelectedAreaOverlay();
      };
      dfSlider = jQuery('<span/>').addClass('slider').slider({
        change: updateDfInput,
        slide: updateDfInput,
        step: 0.001,
        min: 1,
        max: 350
      });
      row.append(' Degrees of Freedom: ').append(dfInput).append(dfSlider);
      dfSlider.slider('value', self.df);

      appendFooterRow(row);
    }

    createAreaSelectControls();
    if (self.options.distribution != 'normal')
      createDegreesOfFreedom();
    var additionalInfoDiv = jQuery('<div/>').addClass('additional_info');
    self.additionalInfo = jQuery('<p/>');
    additionalInfoDiv.append(self.additionalInfo);
    appendFooterRow(additionalInfoDiv);

    // Set vertical positions based upon available controls.
    self.areaInfoDiv.css('bottom', bottomOffset + 'px');
    top.css('height', topOffset + 'px');
    bottom.css('height', bottomOffset + 'px');
    self.chartDiv.css('margin-bottom', (bottomOffset + 15) + 'px');
    self.chartDiv.css('margin-top', (topOffset) + 'px');
  }
  // Helper function that is called whenever any of the area overlay
  // sliders or inputs are changed.
  function refreshSelectedAreaOverlay() {
    var lower = parseFloat(self.areaFromSlider.slider('value'));
    var upper = parseFloat(self.areaToSlider.slider('value'));
    var scale = self.chartDiv.width() /
      (self.distribution.hi() - self.distribution.lo());
    var left = (lower - self.distribution.lo()) * scale;
    var right = (upper - self.distribution.lo()) * scale;
    self.overlayDiv.css('clip',
                        'rect(0px,' +
                              right + 'px,' +
                              self.chartDiv.height() + 'px,' +
                              left + 'px)');
    var p = 7;
    p *= 100;
    var text = 'Selected area: ' + p.fix(2) + '%';

    self.areaInfoDiv.html(text);
  }

  initControls();
  this.reloadChart();
}
