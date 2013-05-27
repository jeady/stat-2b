// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/NormHiLite.htm
//
// Authors: James Eady <jeady@berkeley.edu>
//          Philip B. Stark <stark@stat.berkeley.edu>
//
// container_id: the CSS ID of the container to create the curve (and
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
      },
      area: function(lo, hi) {
        return normCdf(hi) - normCdf(lo);
      }
    };
  } else if (this.options.distribution == 'Student-t') {
    this.distribution = {
      lo: function() { return -6; },
      hi: function() { return 6; },
      y: function(x) {
        return tPdf(self.df, x);
      },
      area: function(lo, hi) {
        return tCdf(self.df, hi) - tCdf(self.df, lo);
      }
    };
  } else if (this.options.distribution == 'chi-square') {
    this.distribution = {
      lo: function() { return 0; },
      hi: function() { return 6 * self.df; },
      y: function(x) {
        return chi2Pdf(self.df, x);
      },
      area: function(lo, hi) {
        return chi2Cdf(self.df, hi) - chi2Cdf(self.df, lo);
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
  this.areaFrom = null;
  this.areaTo = null;
  this.areaInfoDiv = null;

  this.reloadChart = function() {
    redrawChart();

    if (self.options.hiLiteLo === null)
      self.areaFrom.val(self.distribution.lo());
    else
      self.areaFrom.val(self.options.hiLiteLo);
    if (self.options.hiLiteHi === null)
      self.areaTo.val(self.distribution.lo());
    else
      self.areaTo.val(self.options.hiLiteHi);
  };
  function redrawChart() {
    self.areaFrom.min(self.distribution.lo());
    self.areaFrom.max(self.distribution.hi());
    self.areaTo.min(self.distribution.lo());
    self.areaTo.max(self.distribution.hi());

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
      .attr('height', '100%')
      .append('path')
      .data([d3.range(0, width)])
      .attr('d', curve);

    var overlayCurve =
      d3.svg.line()
        .x(function(d, i) {
          return d;
        })
        .y(function(d, i) {
          if (i === 0 || i == width + 1)
            return height;
          return height - (remappedY(d) / yScale);
        });
    var overlayDat = [0].concat(d3.range(0, width), [width]);
    d3.select(self.overlayDiv.get(0)).append('svg')
      .attr('height', '100%')
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
    var o = jQuery('<div/>').addClass('stici').addClass('stici_normhilite');
    self.container.append(o);
    self.chartDiv = jQuery('<div/>')
                      .addClass('stici_chart')
                      .addClass('chart_box');
    o.append(self.chartDiv);
    self.areaInfoDiv = jQuery('<div/>')
                         .addClass('area_info');
    o.append(self.areaInfoDiv);
    var bottom = jQuery('<div/>').addClass('bottom_controls');
    o.append(bottom);

    // Area from input/slider.
    self.areaFrom = new SticiTextBar({
      label: 'Lower endpoint: ',
      step: 0.001,
      change: refreshSelectedAreaOverlay
    });

    // Area to input/slider.
    self.areaTo = new SticiTextBar({
      label: ' Upper endpoint: ',
      step: 0.001,
      change: refreshSelectedAreaOverlay
    });

    bottom.append(self.areaFrom, self.areaTo);

    if (self.options.distribution != 'normal') {
      var df = new SticiTextBar({
        label: ' Degrees of Freedom: ',
        step: 1,
        min: 1,
        max: 350,
        value: self.df,
        change: function(e, value) {
          self.df = value;
          redrawChart();
          refreshSelectedAreaOverlay();
        }
      });
      bottom.append(df);
    }
    // Set vertical positions based upon available controls.
    self.areaInfoDiv.css('bottom', (bottom.height() + 10) + 'px');
    self.chartDiv.css('margin-bottom', (bottom.height() + self.areaInfoDiv.height() + 15) + 'px');
  }
  // Helper function that is called whenever any of the area overlay
  // sliders or inputs are changed.
  function refreshSelectedAreaOverlay() {
    var lower = parseFloat(self.areaFrom.val());
    var upper = parseFloat(self.areaTo.val());
    var scale = self.chartDiv.width() /
      (self.distribution.hi() - self.distribution.lo());
    var left = (lower - self.distribution.lo()) * scale;
    var right = (upper - self.distribution.lo()) * scale;
    self.overlayDiv.css('clip',
                        'rect(0px,' +
                              right + 'px,' +
                              self.chartDiv.height() + 'px,' +
                              left + 'px)');
    var p = self.distribution.area(lower, upper);
    p *= 100;
    var text = 'Selected area: ' + p.fix(2) + '%';

    self.areaInfoDiv.html(text);
  }

  doWhileVisible(self.container, function() {
    initControls();
    self.reloadChart();
    refreshSelectedAreaOverlay();
  });
}
