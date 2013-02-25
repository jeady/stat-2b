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
//  // Whether or not the user can select restricted subsets of the data.
//  - restrict: false
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
    restrict: false,
    counts: null,
    ends: null,
    n: null,
    p: null
  };

  // For debugging: Warn of user params that are unknown.
  jQuery.each(params, function(key) {
    if (typeof(self.options[key]) == 'undefined')
      console.warn('Stici_HistHiLite: Unknown key \'' + key + '\'');
  });

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
  this.restrictedData = null;

  // Histogram information calculated via stat_utils.js. Cached here.
  this.nBins = self.options.bins;
  this.binEnds = null;
  this.binCounts = null;
  this.restrictedCounts = null;
  this.sd = 0;
  this.mu = 0;
  this.restrictedSd = 0;
  this.restrictedMu = 0;

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
  this.areaInfoDiv = null;
  this.showNormalButton = null;
  this.showingOriginal = null;
  this.showingRestricted = null;
  this.additionalInfo = null;

  // Restricted variable handles.
  this.restrictedVariable = null;
  this.restrictLowerEnable = null;
  this.restrictLower = null;
  this.restrictUpperEnable = null;
  this.restrictUpper = null;
  this.restrictedStates = {};

  // This method will be set according to which data source we are using.
  this.reloadData = null;

  if (self.options.n !== null || self.options.p !== null) {
    // Binomial data source.
    self.options.showUnivariateStats = false;
    self.options.listData = false;
    self.options.changeNumBins = false;
    self.reloadData = loadBinomialData;
  } else if (self.options.counts !== null || self.options.ends !== null) {
    // Manually specified data source.
    self.dataSource = null;
    if (!params.showNormal)
      self.options.showNormal = false;
    if (!params.showNormalButton)
      self.options.showNormalButton = false;
    self.options.showUnivariateStats = false;
    self.options.listData = false;
    self.options.changeNumBins = false;
    self.reloadData = loadManualData;
  } else if (self.options.data instanceof Array) {
    // External data source.
    self.dataSource = self.options.data[0];
    if (self.options.restrict) {
      self.reloadData = function() {
        loadExternalData(function() {
          self.restrictedVariable.html('');
          self.restrictedStates = {};
          jQuery.each(self.dataFields, function(i, field) {
            if (field.indexOf('//') === 0)
              return;

            var dat = jQuery.map(self.dataValues, function(values) {
              return parseFloat(values[i]);
            });
            self.restrictedStates[i] = {
              lower: dat.min(),
              lowerEnable: false,
              upper: dat.max(),
              upperEnable: false
            };
          });
          self.restrictedVariable.html(self.variableSelect.html());
          self.restrictedVariable.val(
            (parseInt(self.variableSelect.val(), 10) + 1) %
            self.variableSelect.children().length);

          updateVariableRestrictionControls();
          updateRestrictedData();
        });
      };
    } else {
      self.reloadData = loadExternalData;
    }
  } else {
    console.error('Unknown data source.');
    return;
  }

  this.showingNormal = self.options.showNormal;

  this.reloadChart = function() {
    redrawChart();

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
  };
  function redrawChart() {
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
    for (i = 0; i < width; i++) {
      if ((yScale === null || normalCurveY(i) > yScale) &&
          !isNaN(normalCurveY(i)))
        yScale = normalCurveY(i);
    }
    yScale = Math.max(self.binCounts.max(), yScale);
    var restrictedNormalCurveY = null;
    if (null !== self.restrictedCounts) {
      restrictedNormalCurveY = function(d) {
        var x =
          self.binEnds[0] +
          d * (self.binEnds[self.nBins] - self.binEnds[0]) / (width - 1);
        var y = normPdf(self.restrictedMu, self.restrictedSd, x);
        return y;
      };
      for (i = 0; i < width; i++) {
        if ((yScale === null || restrictedNormalCurveY(i) > yScale) &&
            !isNaN(restrictedNormalCurveY(i)))
          yScale = restrictedNormalCurveY(i);
      }
      yScale = Math.max(self.restrictedCounts.max(), yScale);
    }
    yScale /= (height - 1);

    // Draw the histogram as an SVG. We draw a second copy to use as the
    // area overlay and use absolute positioning to put them on top of each
    // other.
    function appendSvg(div) {
      if (null === self.restrictedCounts ||
          !self.showingRestricted.is(':checked')) {
        return d3.select(div.get(0)).append('svg')
          .attr('height', '100%')
          .selectAll('div')
          .data(self.binCounts)
          .enter()
          .append('rect')
          .attr('y', function(d) { return height - d / yScale; })
          .attr('height', function(d) { return d / yScale; })
          .attr('x', function(d, i) {
            return (width * (self.binEnds[i] - self.binEnds.min()) /
                    graphWidth);
          })
          .attr('width', function(d, i) {
            return width * (self.binEnds[i + 1] - self.binEnds[i]) /
              graphWidth;
          });
      } else {
        var svg = d3.select(div.get(0))
                    .append('svg')
                    .attr('height', '100%')
                    .selectAll('div');
        var dat = jQuery.map(self.binCounts, function(o, i) {
          // Need double array because jQuery auto-flattens result.
          if (!self.showingOriginal.is(':checked'))
            return [[null, self.restrictedCounts[i]]];
          else
            return [[self.binCounts[i], self.restrictedCounts[i]]];
        });
        svg.data(dat)
          .enter()
          .append('rect')
          .attr('y', function(d) { return height - d.max() / yScale; })
          .attr('height', function(d) { return d.max() / yScale; })
          .attr('x', function(d, i) {
            return (width * (self.binEnds[i] - self.binEnds.min()) /
                    graphWidth);
          })
          .attr('width', function(d, i) {
            return width * (self.binEnds[i + 1] - self.binEnds[i]) /
              graphWidth;
          })
          .attr('class', function(d) {
            if (d[0] == d[1])
              return 'restricted';
            else if (d[1] > d[0])
              return 'restricted';
            else
              return '';
          });
        svg.data(dat)
          .enter()
          .append('rect')
          .attr('y', function(d) { return height - d.min() / yScale; })
          .attr('height', function(d) { return d.min() / yScale; })
          .attr('x', function(d, i) {
            return (width * (self.binEnds[i] - self.binEnds.min()) /
                    graphWidth);
          })
          .attr('width', function(d, i) {
            return width * (self.binEnds[i + 1] - self.binEnds[i]) /
              graphWidth;
          })
          .attr('class', function(d) {
            if (d[0] == d[1])
              return '';
            else if (d[1] < d[0])
              return 'restricted';
            else
              return '';
          });
        return svg;
      }
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
    if (self.options.showNormalButton || self.options.showNormal) {
      var normalCurve =
        d3.svg.line()
          .x(function(d) {return d;})
          .y(function(d) {
            return height - (normalCurveY(d) / yScale);
          });
      var normSvg = d3.select(self.normalOverlayDiv.get(0))
                      .append('svg')
                      .attr('height', '100%');
      if (null === self.restrictedCounts ||
          self.showingOriginal.is(':checked') ||
          !self.showingRestricted.is(':checked')) {
        var normPath = normSvg.append('path');
        if (null !== self.restrictedCounts)
          normPath.attr('class', 'nrestricted');
        normPath.data([d3.range(0, width)])
          .attr('d', normalCurve);
      }
      if (null !== self.restrictedCounts &&
          self.showingRestricted.is(':checked')) {
        var restrictedCurve =
          d3.svg.line()
            .x(function(d) {return d;})
            .y(function(d) {
              return height - (restrictedNormalCurveY(d) / yScale);
            });
        normSvg.append('path')
          .attr('class', 'restricted')
          .data([d3.range(0, width)])
          .attr('d', restrictedCurve);
      }

      if (self.showingNormal) {
        self.showNormalButton.text('Hide Normal Curve');
      } else {
        self.showNormalButton.text('Show Normal Curve');
        self.normalOverlayDiv.hide();
      }
    }

    refreshSelectedAreaOverlay();
  }

  function loadExternalData(cb) {
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

      refreshFromExternalData();
      self.reloadChart();

      if (cb)
        cb();
    });
  }
  function refreshFromExternalData() {
    self.data = jQuery.map(self.dataValues, function(values) {
      return parseFloat(values[self.variableSelect.val()]);
    });
    self.binEnds = histMakeBins(self.nBins, self.data);
    self.binCounts = histMakeCounts(self.binEnds, self.data);
    self.sd = sd(self.data);
    self.mu = mean(self.data);

    var info = 'n=' + self.data.length;
    info += '&nbsp;&nbsp;&nbsp;';
    info += 'Mean=' + self.mu.toFixed(3);
    info += '&nbsp;&nbsp;&nbsp;';
    info += 'SD=' + self.sd.toFixed(3);
    self.additionalInfo.html(info);
  }
  function loadManualData() {
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
    for (var i = 0; i < self.binCounts.length; i++) {
      self.binCounts[i] /= total * (self.binEnds[i + 1] - self.binEnds[i]);
    }
    self.reloadChart();
  }
  function loadBinomialData() {
    var p = self.options.p;
    var n = self.options.n;
    self.nBins = n + 1;
    self.binCounts = [Math.pow((1 - p), n)];
    self.binEnds = [-0.5];
    for (var i = 1; i < self.nBins; i++) {
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
    self.additionalInfo.html('n=' + n + '&nbsp;&nbsp;&nbsp;p=' + p);
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
    function createSelectDataSourceControls() {
      // TODO(jmeady): It should not be necessary to keep these controls as
      // member variables.
      self.urlInput = jQuery('<input type="text" />');
      self.dataSelect = jQuery('<select/>').change(self.reloadData);
      self.variableSelect = jQuery('<select/>').change(function() {
        refreshFromExternalData();
        if (self.options.restrict)
          updateRestrictedData();
        self.reloadChart();
      });

      var dataSelectControls = jQuery('<div/>');
      dataSelectControls.append('Data: ');
      if (self.options.data.length > 1) {
        dataSelectControls.append(self.dataSelect);
      } else {
        dataSelectControls.append(
          self.options.data[0].replace(/^.*[\\\/]/, ''));
        dataSelectControls.append('&nbsp;&nbsp;&nbsp;');
      }
      jQuery.each(self.options.data, function(i, dataUrl) {
        self.dataSelect.append(jQuery('<option/>')
                       .attr('value', dataUrl)
                       .text(dataUrl.replace(/^.*[\\\/]/, '')));
      });
      dataSelectControls.append('Variable: ').append(self.variableSelect);

      if (self.options.restrict) {
        self.showingOriginal = jQuery('<input type="checkbox" />');
        self.showingOriginal.prop('checked', true);
        self.showingOriginal.change(function() {
          redrawChart();
        });
        dataSelectControls.append(self.showingOriginal)
                          .append('Show original data');
        self.showingRestricted = jQuery('<input type="checkbox" />');
        self.showingRestricted.prop('checked', true);
        self.showingRestricted.change(function() {
          redrawChart();
        });
        dataSelectControls.append(self.showingRestricted)
                          .append('Show restricted data');
      }

      appendHeaderRow(dataSelectControls);
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
      row.append('Area from: ').append(self.areaFromInput)
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
      row.append(' to: ').append(self.areaToInput).append(self.areaToSlider);

      if (self.options.changeNumBins) {
        var binsInput = jQuery('<input type="text" />')
                           .val(self.options.bins);
        binsInput.change(function() {
          self.nBins = parseInt(binsInput.val(), 10);
          self.binEnds = histMakeBins(self.nBins, self.data);
          self.binCounts = histMakeCounts(self.binEnds, self.data);
          if (self.options.restrict)
            updateRestrictedData();
          redrawChart();
        });
        row.append('Bins: ').append(binsInput);
      } else {
        row.append('Bins: ' + self.options.bins);
      }
      appendFooterRow(row);
    }
    function createRestrictionControls() {
      var row = jQuery('<div/>');
      self.restrictedVariable = self.variableSelect.clone();
      self.restrictedVariable.change(function() {
        updateVariableRestrictionControls();
        updateRestrictedData();
      });
      row.append('Restrict to ').append(self.restrictedVariable);
      self.restrictLowerEnable = jQuery('<input type="checkbox" />');
      row.append(self.restrictLowerEnable).append('>= ');
      self.restrictLower = jQuery('<input type="text" />');
      row.append(self.restrictLower);
      self.restrictUpperEnable = jQuery('<input type="checkbox" />');
      row.append(self.restrictUpperEnable).append('and <= ');
      self.restrictUpper = jQuery('<input type="text" />');
      row.append(self.restrictUpper);

      jQuery.each([self.restrictLowerEnable,
                   self.restrictLower,
                   self.restrictUpperEnable,
                   self.restrictUpper],
                   function(i, o) {
        o.change(updateRestrictedData);
      });

      var clearAll = jQuery('<button/>').text('Clear Restrictions');
      clearAll.click(function(e) {
        e.preventDefault();
        self.restrictUpperEnable.prop('checked', false);
        self.restrictUpper.val(self.binEnds.max());
        self.restrictLowerEnable.prop('checked', false);
        self.restrictLower.val(self.binEnds.min());
        updateRestrictedData();
      });
      row.append(' ').append(clearAll);
      appendFooterRow(row);
    }
    function createExtraInfoControls() {
      var row = jQuery('<div/>');

      // Extra info buttons
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
            tempConcatData = tempDataRow.slice(dataFields.length - 1)
                                        .join(' ')
                                        .replace(/[\/]/g, '');
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
        listDataButton.content
                      .find('table')
                      .css('width', self.dataFields.length * 120 + 'px');
      });
      if (self.options.listData) {
        row.append(listDataButton.parent);
      }

      var statsButton = createPopBox();
      statsButton.button.text('Univariate Stats');
      statsButton.button.click(function(e) {
        e.preventDefault();

        // Thank you Ken
        var html = '<div class="univariate-stats-container">';
        $.each(self.dataFields, function(index) {
          if (self.dataFields[index].indexOf('//') === 0)
            return;
          html += '<div class="univariate-stat-wrapper">' + 
                    '<h3>' + self.dataFields[index] + '</h3>';
          var data = $.map(self.dataValues, function(values) {
            return parseFloat(values[index]);
          });
          html += '<ul class="stat-list">' +
            '<li class="stat-item">Cases: ' +
              data.length + '</li>' +
            '<li class="stat-item">Mean: ' +
              mean(data).toFixed(2) + '</li>' +
            '<li class="stat-item">SD: ' +
              sd(data).toFixed(2) + '</li>' +
            '<li class="stat-item">Min: ' +
              data.min().toFixed(2) + '</li>' +
            '<li class="stat-item">LQ: ' +
              percentile(data, 25).toFixed(2) + '</li>' +
            '<li class="stat-item">Median: ' +
              percentile(data, 50).toFixed(2) + '</li>' +
            '<li class="stat-item">UQ: ' +
              percentile(data, 75).toFixed(2) + '</li>' +
            '<li class="stat-item">Max: ' +
              data.max().toFixed(2) + '</li>' +
            '</ul>';
          html += '</div>';
        });
        html += '</div>';
        statsButton.content.html(html);
      });
      if (self.options.showUnivariateStats)
        row.append(statsButton.parent);

      self.showNormalButton = jQuery('<button/>')
                           .addClass('open');
      if (self.showingNormal)
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
        row.append(self.showNormalButton);

      if (row.children().length > 0)
        appendFooterRow(row);
    }

    // Top controls only show if the file/variable can be changed.
    if (self.dataSource !== null)
      createSelectDataSourceControls();
    createAreaSelectControls();
    if (self.options.restrict)
      createRestrictionControls();
    createExtraInfoControls();
    var additionalInfoDiv = jQuery('<div/>').addClass('additional_info');
    self.additionalInfo = jQuery('<p/>');
    additionalInfoDiv.append(self.additionalInfo);
    appendFooterRow(additionalInfoDiv);

    jQuery('.popbox').popbox();

    // Set vertical positions based upon available controls.
    self.areaInfoDiv.css('bottom', bottomOffset + 'px');
    top.css('height', topOffset + 'px');
    bottom.css('height', bottomOffset + 'px');
    self.chartDiv.css('margin-bottom', (bottomOffset + 15) + 'px');
    self.chartDiv.css('margin-top', (topOffset) + 'px');
  }
  function updateVariableRestrictionControls() {
    if (!self.options.restrict)
      return;
    var state = self.restrictedStates[self.restrictedVariable.val()];
    self.restrictUpperEnable.prop('checked', state.upperEnable);
    self.restrictUpper.val(state.upper);
    self.restrictLowerEnable.prop('checked', state.lowerEnable);
    self.restrictLower.val(state.lower);
  }
  function updateRestrictedData() {
    var state = self.restrictedStates[self.restrictedVariable.val()];
    state.upperEnable = self.restrictUpperEnable.prop('checked');
    state.upper = self.restrictUpper.val();
    state.lowerEnable = self.restrictLowerEnable.prop('checked');
    state.lower = self.restrictLower.val();
    self.restrictedStates[self.restrictedVariable.val()] = state;

    var info = 'n=' + self.data.length;
    info += '&nbsp;&nbsp;&nbsp;';
    info += 'Mean=' + self.mu.toFixed(3);
    info += '&nbsp;&nbsp;&nbsp;';
    info += 'SD=' + self.sd.toFixed(3);
    self.restrictedData = jQuery.map(self.dataValues, function(values) {
      return [[
        parseFloat(values[self.variableSelect.val()]),
        parseFloat(values[self.restrictedVariable.val()])]];
    });
    if (self.restrictUpperEnable.is(':checked')) {
      self.restrictedData = jQuery.grep(self.restrictedData, function(o) {
        if (o[1] <= self.restrictUpper.val())
          return true;
        else
          return false;
      });
    }
    if (self.restrictLowerEnable.is(':checked')) {
      self.restrictedData = jQuery.grep(self.restrictedData, function(o) {
        if (o[1] >= self.restrictLower.val())
          return true;
        else
          return false;
      });
    }
    self.restrictedData = jQuery.map(self.restrictedData, function(o) {
      return o[0];
    });
    if (!self.restrictUpperEnable.is(':checked') &&
        !self.restrictLowerEnable.is(':checked')) {
      self.restrictedCounts = null;
    } else {
      self.restrictedCounts = histMakeCounts(self.binEnds, self.restrictedData);
      if (isNaN(self.restrictedCounts[0]))
        self.restrictedCounts = null;
      self.restrictedMu = mean(self.restrictedData);
      self.restrictedSd = sd(self.restrictedData);
      info += '&nbsp;&nbsp;&nbsp;';
      info += 'Subset: n=' + self.restrictedData.length;
      info += '&nbsp;&nbsp;&nbsp;';
      info += 'Mean=' + self.restrictedMu.toFixed(3);
      info += '&nbsp;&nbsp;&nbsp;';
      info += 'SD=' + self.restrictedSd.toFixed(3);
    }
    self.additionalInfo.html(info);
    redrawChart();
  }
  // Helper function that is called whenever any of the area overlay
  // sliders or inputs are changed.
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
    var p = histHiLitArea(lower, upper, self.binEnds, self.binCounts);
    p *= 100;
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

    if (self.restrictedCounts !== null) {
      text += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
      p = histHiLitArea(lower, upper, self.binEnds, self.restrictedCounts);
      p *= 100;
      text += 'Subset data: ' + p.fix(2) + '%';
      if (self.showingNormal) {
        rm = self.restrictedMu;
        rs = self.restrictedSd;
        p = Math.max(
          0,
          (normCdf((upper - rm) / rs) - normCdf((lower - rm) / rs)) * 100
        );
        text += '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
        text += 'Normal approx: ' + p.fix(2) + '%';
      }
    }

    self.areaInfoDiv.html(text);
  }

  initControls();
  this.reloadData();
}

// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/NormHiLite.htm
//
// Author: James Eady <jeady@berkeley.edu>
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
        step: 1,
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
    var p = self.distribution.area(lower, upper);
    p *= 100;
    var text = 'Selected area: ' + p.fix(2) + '%';

    self.areaInfoDiv.html(text);
  }

  initControls();
  this.reloadChart();
}

// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/ScatterPlot.htm
//
// Author: Ken Yu <kenniyu@gmail.com>
//
// container_id: the CSS ID of the container to create the scatterplot (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  // title
//  - title: null
//
//  // Whether or not to show the 'Graph of Ave' button.
//  - graphAveButton: true
//
//  // Number of points in Graph of Ave.
//  - graphOfAvePoints: 9
//
//  // Boolean, true if user is allowed to add points to the chart.
//  - addPoints: true
//
//  // Whether or not to show the 'Regression Line' button.
//  - regressButton: true
//
//  // Whether or not to show the 'Plot Residuals' button.
//  - residualsButton: true
//
//  // Whether or not to show the 'SDs' button.
//  - sdButton: true
//
//  // Whether or not to show the 'SD Line' button.
//  - sdLineButton: true
//
//  // Whether or not to show the 'R=' info.
//  - showR: true
//
//  // Whether or not to show the 'R=' and 'N=' slider bars.
//  - showRBar: true
//
//  // Whether or not to show the SD Lines by default.
//  - showSDs: false
//
//  // Whether or not to show the SD Line by default.
//  - showSdLine: false
//
//  // Whether or not to show the Graph of Ave by default.
//  - showGraphOfAve: false
//
//  // Whether or not to show the Regression Line by default.
//  - showRegress: false
//
//  // Whether or not to show the residuals by default.
//  - showResiduals: false
//
//  // There are three different ways to supply input to the scatterplot:
//  // 1) External JSON-encoded data file.
//  // 2) Manual specification of data x and y values.
//  // 3) Normal bivariate with specified realized correlation coefficient.
//  //
//  // These input methods are all mutually exclusive - if the parameters for a
//  // particular input method are set, then the parameters for the other input
//  // methods should not be set.
//
//  // 1) External JSON-encoded data file
//
//  // Array of URLs (as strings) of json-encoded datasets
//  - files: null
//
//  // Variable name to display on the X-axis by default.
//  - Xinit: null
//
//  // Variable name to display on the Y-axis by default.
//  - Yinit: null
//
//  // 2) Manual specification of data x and y values.
//
//  // Data points. x and y should be arrays of the same length.
//  - x: null
//  - y: null
//
//  // 3) Normal bivariate with specified realized correlation coefficient.
//
//  // Correlation coefficient of generated data
//  - r: null
//
//  // Number of generated data points
//  - n: null
function Stici_Scatterplot(container_id, params) {
  var self = this;

  if (!params instanceof Object) {
    console.error('Stici_ScatterPlot params should be an object');
    return;
  }

  // Configuration option defaults.
  this.options = {
    title: null,
    graphAveButton: true,
    graphOfAvePoints: 9,
    addPoints: true,
    regressButton: true,
    residualsButton: true,
    sdButton: true,
    sdLineButton: true,
    showR: true,
    showRBar: true,
    showSDs: false,
    showSdLine: false,
    showGraphOfAve: false,
    showRegress: false,
    showResiduals: false,
    files: null,
    Xinit: null,
    Yinit: null,
    r: null,
    n: null,
    x: null,
    y: null
  };

  // For debugging: Warn of user params that are unknown.
  jQuery.each(params, function(key) {
    if (typeof(self.options[key]) == 'undefined')
      console.warn('Stici_Scatterplot: Unknown key \'' + key + '\'');
  });

  // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

  if (!this.options.showRBar || !this.options.showR) {
    this.options.showRBar = false;
    this.options.showR = false;
  }

  // jQuery object containing the entire chart.
  this.container = $('#' + container_id);

  // Check to make sure we know where the data is coming from before we do
  // anything else.
  if (!dataIsGenerated() && !dataIsFromExternalFile() && !dataIsManual()) {
    console.error('Unknown scatterplot data source.');
    self.container.html('Unable to load scatterplot: unknown data source.');
    return;
  }

  // Labels for the data.
  this.dataFields = null;

  // The data itself.
  this.dataValues = null;

  // The URL we got the JSON-encoded data from.
  this.dataSource = null;

  // Used so that some options are only triggered when the chart is initially
  // loaded (e.g. showSDs) - the user can change them afterwards and the chart
  // can reload without resetting the user preferences.
  this.inited = false;

  // Various handles to important jQuery objects.
  this.urlInput = null;
  this.dataSelect = null;
  this.xVariableSelect = null;
  this.yVariableSelect = null;
  this.currentData = null;
  this.xScale = null;
  this.yScale = null;
  this.chartWidth   = this.container.width() - 20;
  this.chartHeight  = this.container.height() - 100;
  this.chartDiv = null;
  this.r = null;
  this.n = null;
  this.rInput = null;
  // TODO(jmeady): Put this in the css file.
  this.chartMargins    = { 'top': '10', 'right': '10', 'bottom': '25', 'left': '40' };
  this.bottomControls = {
    'sds': false,
    'sd-line': false,
    'avg-graph': false,
    'reg-line': false,
    'res-plot': false,
    'use-points': false,
    'plot-mean': true,
    'r-hat': true
  };

  // Select which function to use for reloading the data.
  this.reloadData = null;
  if (dataIsFromExternalFile()) {
    if (!params.files instanceof Array) {
      this.dataSource = null;
      this.options.files = [];
    } else {
      this.dataSource = this.options.files[0];
    }

    this.reloadData = loadExternalData;
  } else if (dataIsGenerated()) {
    this.n = self.options.n;
    this.r = self.options.r;
    this.reloadData = loadGeneratedData;
  } else if (dataIsManual()) {
    if (self.options.x.length != self.options.y.length) {
      console.error('Data has been manually specified, but x and y options ' +
                    'have different numbers of data points.');
      self.container.html('Invalid data supplied.');
      return;
    }
    this.reloadData = loadManualData;
  }

  // Reloads chart data from this.dataSource
  // upon new data set selection
  function loadExternalData() {
    var $bottomControls = self.container.find('.bottom_controls'),
        $popboxControls = self.container.find('.popbox-controls');

    self.options.files = [];
    self.dataFields = [];
    self.dataValues = [];
    self.dataSource = self.dataSelect.val();

    // TODO unhardcode this
    var Xinit = 3;
    var Yinit = 2;

    jQuery.getJSON(self.dataSource, function(data) {
      self.dataFields = data[0];
      self.dataValues = data.slice(1);


      // remove all data chilren
      self.xVariableSelect.empty();
      self.yVariableSelect.empty();

      // append all options for x and y variables
      $.each(self.dataFields, function(i, field) {
        // don't have option to graph ordinal or comments...
        if (field.indexOf('//') > -1) {
          return true;
        }
        if (!self.inited &&
            null !== self.options.Xinit &&
            field == self.options.Xinit)
        Xinit = i;
        if (!self.inited &&
            null !== self.options.Yinit &&
            field == self.options.Yinit)
        Yinit = i;
        self.xVariableSelect.append(
          $('<option/>').attr('value', i).text(field)
        );
        self.yVariableSelect.append(
          $('<option/>').attr('value', i).text(field)
        );
      });

      self.xVariableSelect.val(Xinit);
      self.yVariableSelect.val(Yinit);

      // create popbox controls
      self.container.find('.popbox-controls').empty();
      self.createPopbox('list-data');
      self.createPopbox('univar-stats');
      self.container.find('.popbox').popbox({'toggler': ['list-data', 'univar-stats']});
      self.container.find('.popbox-content table').css('width', self.dataFields.length * 120 + 'px');
      self.container.find('.popbox').on('mouseover mouseout click', function(e) {
        e.preventDefault();
        handlePopboxMouseEvents(e);
      });

      // reload the chart after new data set
      self.prepareData();
      self.reloadChart();

    });
  }

  // Generates and loads data according to the specified r/n options.
  function loadGeneratedData() {
    var raw = cNormPoints(self.n, self.r);
    var xVals = raw[0];
    var yVals = raw[1];
    if (self.n == 1) {
      xVals = [5.5];
      yVals = [5.5];
    }
    // get array of x and y points
    self.currentData = $.map(xVals, function(xVal, index) {
      return { 'x': xVals[index],
               'y': yVals[index],
               'index': index,
               'added': false,
               'selected': false
      };
    });
    self.reloadChart();
  }

  // Loads data that has been manually specified in the chart x and y options.
  function loadManualData() {
    self.currentData = $.map(self.options.x, function(xVal, index) {
      return { 'x': self.options.x[index],
               'y': self.options.y[index],
               'index': index,
               'added': false,
               'selected': false
      };
    });
    self.reloadChart();
  }

  this.prepareData = function() {
    // get array of x and y points
    self.currentData = $.map(self.dataValues, function(values, index) {
      return { 'x': parseFloat(values[self.xVariableSelect.val()]),
               'y': parseFloat(values[self.yVariableSelect.val()]),
               'index': index,
               'added': false,
               'selected': self.container.find('.popbox.list-data tr[data-index="' + index + '"]').hasClass('selected') };
    });
  };

  this.setScale = function(data) {
    // x scale. range from 0 to width
    var chartWidth    = self.chartWidth,
        chartMargins  = self.chartMargins,
        xMin = d3.min(data, function(d) { return d.x; }),
        xMax = d3.max(data, function(d) { return d.x; }),
        xScale,
        yMin = d3.min(data, function(d) { return d.y; }),
        yMax = d3.max(data, function(d) { return d.y; }),
        yScale;
    if (xMin == xMax) {
      xMin -= 4.5;
      xMax += 4.5;
    }
    if (yMin == yMax) {
      yMin -= 4.5;
      yMax += 4.5;
    }

    xScale = d3.scale.linear()
                     .domain([xMin, xMax])
                     .range([0, chartWidth - chartMargins.left - chartMargins.right])
                     .nice();

    if (yMax < 0.001 && yMin > -0.001) {
      yMax = 1;
      yMin = -1;
    }

    yScale = d3.scale.linear()
              .domain([yMin, yMax])
              .range([self.chartHeight - self.chartMargins.top - self.chartMargins.bottom, 0])
              .nice();

    self.xScale = xScale;
    self.yScale = yScale;
  };

  this.initCanvas = function() {
    // empty canvas
    self.chartDiv.empty();

    var chartWidth  = self.chartWidth,
        chartHeight = self.chartHeight,
        svg         = d3.select(self.chartDiv.get(0))
                        .append('svg')
                        .attr('width', self.chartWidth)
                        .attr('height', self.chartHeight);
  };

  this.drawDataPlot = function() {
    var data          = self.currentData;

    // initialize blank canvas
    self.initCanvas();

    // set scale
    self.setScale(data);

    // plot axes
    self.plotAxes('data');

    // add points
    self.plotPoints(data, 'data');

    // draw mouse rectangle
    self.drawMouseRect();

    // update r-hat
    self.updateRHat();
  };

  this.plotAxes = function(plotType) {
    // function generating x axis, passed to another function later
    var xScale        = self.xScale,
        yScale        = self.yScale,
        chartMargins  = self.chartMargins,
        chartWidth    = self.chartWidth,
        chartHeight   = self.chartHeight,
        xAxis         = d3.svg.axis()
                          .scale(xScale)
                          .orient('bottom'),
        yAxis         = d3.svg.axis()
                          .scale(yScale)
                          .orient('left'),
        svg           = d3.select(self.chartDiv.get(0)).select('svg');

    // add axes
    if (plotType === 'data') {
      svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(' + chartMargins.left + ', ' + (chartHeight - chartMargins.bottom) + ')')
        .call(xAxis);
    } else {
      svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(' + chartMargins.left + ', ' + (yScale(0) + 1*chartMargins.top) + ')')
        .call(xAxis);
    }

    svg.append('g')
      .attr('class', 'y axis')
      .attr('transform', 'translate(' + chartMargins.left + ', ' + chartMargins.top + ')')
      .call(yAxis);
    svg.select('g.x.axis')
      .append('line')
      .attr('class', 'line x-axis')
      .attr('x1', 0)
      .attr('x2', chartWidth - chartMargins.left)
      .attr('y1', 0)
      .attr('y2', 0);
    svg.select('g.y.axis')
      .append('line')
      .attr('class', 'line y-axis')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', chartHeight - chartMargins.bottom - chartMargins.top);
  };

  this.reloadChart = function() {
    if (self.bottomControls['res-plot'] === true) {
      self.toggleResPlot(true);
    } else {
      self.drawDataPlot();
      self.plotSelectedOptions(['res-plot']);
    }

    if (!self.inited) {
      if (self.options.showSdLine)
        simulateBtnPress('sd-line');
      if (self.options.showSDs)
        simulateBtnPress('sds');
      if (self.options.showGraphOfAve)
        simulateBtnPress('graph-of-ave');
      if (self.options.showRegress)
        simulateBtnPress('reg-line');
      if (self.options.showResiduals)
        simulateBtnPress('res-plot');
    }
    self.inited = true;
  };

  this.updateRHat = function() {
    var data  = self.filterData(),
        xData = $.map(data, function(d) { return d.x; }),
        yData = $.map(data, function(d) { return d.y; }),
        cc    = corr(xData, yData).toFixed(2);

    if (dataIsGenerated())
      self.rInput.val(cc);
    self.container.find('.bottom_controls').children().filter(function() {
      return $(this).data('btnId') == 'r-hat';
    }).text('r: ' + cc);
  };

  /***
   * plotSelectedOptions: called when chart redrawn
   * params: Array discardOptions - options to ignore plotting
   ***/
  this.plotSelectedOptions = function(discardOptions) {
    var tempSelected;
    discardOptions = (discardOptions || []);
    for (var option in self.bottomControls) {
      if (discardOptions.indexOf(option) > -1) {
        continue;
      }
      tempSelected = self.bottomControls[option];
      self.toggleOption(option, tempSelected);
    }
  };

  /***
   * toggleOption:  toggles an option in bottom controls
   * params:      String option - the option to plot, 
   *              Boolean show
   ***/
  this.toggleOption = function(option, show) {
    switch (option) {
      case 'sds':
        self.toggleSds(show);
        break;
      case 'sd-line':
        self.toggleSdLine(show);
        break;
      case 'graph-of-ave':
        self.toggleGraphOfAve(show);
        break;
      case 'reg-line':
        self.toggleRegLine(show);
        break;
      case 'res-plot':
        self.toggleResPlot(show);
        break;
      case 'use-points':
        self.toggleUsePoints();
        break;
      case 'clear-points':
        self.toggleClearPoints();
        break;
      case 'plot-mean':
        self.plotMean();
        break;
      case 'r-hat':
        self.updateRHat();
        break;
      default:
        break;
    }
  };

  /***
   * createListDataHtml - creates html for list data button
   ***/
  this.createPopbox = function(popboxClass) {
    var content,
        btnTitle,
        btnId,
        popboxHtml;
    if (popboxClass === 'list-data') {
      btnTitle  = 'List Data';
      content   = self.createListDataHtml();
      btnId     = 'list-data';
    } else if (popboxClass === 'univar-stats') {
      btnTitle  = 'Univariate Stats';
      content   = self.createUnivarStatsHtml();
      btnId     = 'univar-stats';
    }
    popboxHtml = '' +
      '<div class="popbox ' + popboxClass + '">' +
        '<button class="open" id="' + btnId + '">' + btnTitle + '</button>' +
        '<div class="collapse">' +
          '<div class="box">' +
            '<div class="arrow"></div>' +
            '<div class="arrow-border"></div>' +
            '<div class="popbox-content">' + content + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    self.container.find('.bottom_controls .popbox-controls').append(popboxHtml);
  };

  this.createUnivarStatsHtml = function() {
    var html = '<div class="univariate-stats-container">';
    $.each(self.dataFields, function(index) {
      if (self.dataFields[index].indexOf('//') === 0)
        return;
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
    return html;
  };

  /***
   * createListDataHtml - creates html for list data button
   ***/
  this.createListDataHtml = function() {
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
    return html;
  };


  /***
   * toggleClearPoints: toggles when clear added points is clicked
   ***/
  this.toggleClearPoints = function() {
    self.currentData = $.grep( self.currentData, function(data, index) {
      return data.added === false;
    });
    d3.select(self.chartDiv.get(0)).selectAll('.data-point[data-added="true"]').remove();
    self.plotSelectedOptions(['res-plot', 'use-points']);
  };

  /***
   * toggleUsePoints: toggles when use added points is clicked
   ***/
  this.toggleUsePoints = function() {
    self.plotSelectedOptions(['res-plot', 'use-points']);
    if (self.bottomControls['res-plot']) {
      self.toggleResPlot(true);
    }
  };

  /***
   * toggleResPlot: toggles residual plot
   * params:  boolean show - true or false
   ***/
  this.toggleResPlot = function(show) {
    var filteredData = self.filterData(),
        xData = $.map(filteredData, function(d) { return d.x; }),
        yData = $.map(filteredData, function(d) { return d.y; }),
        xMean = mean(xData),
        yMean = mean(yData),
        xSd   = sd(xData),
        ySd   = sd(yData),
        cc    = corr(xData, yData),
        slope = cc * ySd / xSd,
        expectedY,
        tempData,
        tempRes,
        tempAdded,
        numPoints = self.currentData.length;

    if (show) {
      // initialize blank canvas
      self.initCanvas();

      // empty residual data, and recalculate for each point
      self.residualData = [];
      for (var i = 0; i < numPoints; i++) {
        tempData    = self.currentData[i];
        expectedY   = yMean - slope * (xMean - tempData.x);
        tempRes     = tempData.y - expectedY;
        self.residualData.push({  'x': tempData.x,
                                  'y': tempRes,
                                  'added': tempData.added,
                                  'index': tempData.index });
      }

      // recalculate scales
      self.setScale(self.residualData);

      // plot axes
      self.plotAxes('residual');

      // add points
      self.plotPoints(self.residualData, 'residual');

      // draw rectangle to detect mouse position
      self.drawMouseRect();

      // plot selected options but ignore residual plot and use points
      self.plotSelectedOptions(['res-plot', 'use-points']);
    } else {
      // draw data plot, and plot selected options, but ignore residual plot
      self.drawDataPlot();
      self.plotSelectedOptions(['res-plot']);
    }
  };

  /***
   * plotPoints: plots data points
   * params:  Array data - array of data points
   *          String plotType - identifies intent of chart to plot (residual or data)
   ***/
  this.plotPoints = function(data, plotType) {
    var chartMargins  = self.chartMargins,
        xScale        = self.xScale,
        yScale        = self.yScale,
        plotClass     = plotType === 'data' ? 'plot-data' : 'plot-residual',
        pointPlot     = d3.select(self.chartDiv.get(0)).select('svg').append('g')
                      .attr('class', plotClass + ' plot')
                      .attr('transform', 'translate(' + chartMargins.left + ',' + chartMargins.top + ')'),
        selectedDataPoints;

    pointPlot.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', function(d) {
          var className   = 'data-point',
              selectedMod = d.selected ? 'selected' : '',
              addedMod    = d.added ? 'added' : '';
          return className + ' ' + selectedMod + ' ' + addedMod;
        })
        .attr('cx', function(d) { return xScale(d.x); })
        .attr('cy', function(d) { return yScale(d.y); })
        .attr('stroke', '#333')
        .attr('stroke-width', '1')
        .attr('data-index', function(d) { return d.index; })
        .attr('data-added', function(d) { return d.added; })
        .attr('data-x', function(d) { return d.x; })
        .attr('data-y', function(d) { return d.y; })
        .attr('r', function(d) {
          return (d.selected ? 3.5 : 2);
        })
        .attr('fill', function(d) {
          return 'rgba(0, 0, 255, 1)';
        });

    d3.select(self.chartDiv.get(0)).selectAll('.data-point')
      .sort(function(d) {
        if (d && d.selected === true) {
          return 1;
        } else {
          return -1;
        }
      });
  };

  this.drawMouseRect = function() {
    var chartMargins  = self.chartMargins,
        chartWidth    = self.chartWidth,
        chartHeight   = self.chartHeight,
        xScale        = self.xScale,
        yScale        = self.yScale,
        plotContainer = d3.select(self.chartDiv.get(0)).select('.plot');

    plotContainer.append('rect')
      .attr('class', 'mouse-event-handler')
      .attr('width', chartWidth - chartMargins.left - chartMargins.right)
      .attr('height', chartHeight - chartMargins.top - chartMargins.bottom)
      .attr('fill', 'rgba(0, 0, 0, 0)')
      .on('mousemove', function() {
        var pos = d3.mouse(this),
            xPos = pos[0],
            yPos = pos[1],
            xVal = (xScale.invert(xPos)).toFixed(2),
            yVal = (yScale.invert(yPos)).toFixed(2);
        self.container.find('.cursor-pos').text(' x = ' + xVal + '  y = ' + yVal);
      });

    d3.select(self.chartDiv.get(0)).select('.plot-data.plot .mouse-event-handler')
      .on('click', function() {
        if (!self.options.addPoints)
          return;

        var pos = d3.mouse(this),
            xPos      = pos[0],
            yPos      = pos[1],
            xVal      = (xScale.invert(xPos)).toFixed(2),
            yVal      = (yScale.invert(yPos)).toFixed(2),
            tempPoint = { 'x': parseFloat(xVal),
                          'y': parseFloat(yVal),
                          'added': true,
                          'index': self.currentData.length };
        self.currentData.push(tempPoint);

        // draw points again
        self.plotPoint(tempPoint);

        // update any existing plots, if using added points
        if (!self.bottomControls['res-plot'] && self.bottomControls['use-points']) {
          self.plotSelectedOptions(['res-plot', 'use-points']);
        }
      });
  };

  this.plotPoint = function(tempPoint) {
    var yScale = self.yScale,
        xScale = self.xScale;
        pointPlot = d3.select(self.chartDiv.get(0)).select('.plot-data.plot');

    pointPlot.insert('circle', '.data-point')
          .attr('class', 'data-point added')
          .attr('cx', xScale(tempPoint.x))
          .attr('cy', yScale(tempPoint.y))
          .attr('stroke', '#333')
          .attr('stroke-width', '1')
          .attr('data-index', tempPoint.index)
          .attr('data-added', tempPoint.added)
          .attr('data-x', tempPoint.x)
          .attr('data-y', tempPoint.y)
          .attr('r', 2);
  };

  /***
   * toggleRegLine: toggles regression line
   * params:  boolean show - true or false
   ***/
  this.toggleRegLine = function(show) {
    var data = self.filterData(),
        xData,
        yData,
        xMean,
        yMean,
        xMin,
        xMax,
        xSd,
        ySd,
        slope,
        cc,
        regLine,
        pointMean,
        point1,
        point2;

    self.container.find('svg g.reg-line').remove();
    if (show) {
      xData = $.map(data, function(d) { return d.x; });
      yData = $.map(data, function(d) { return d.y; });
      xMin  = d3.min(xData);
      xMax  = d3.max(xData);
      xMean = mean(xData);
      yMean = mean(yData);
      xSd   = sd(xData);
      ySd   = sd(yData);
      cc    = corr(xData, yData);
      slope = cc * ySd / xSd;

      pointMean = { 'x': xMean, 'y': yMean };
      point1    = { 'x': xMin, 'y': pointMean.y - slope * (pointMean.x - xMin) };
      point2    = { 'x': xMax, 'y': pointMean.y - slope * (pointMean.x - xMax) };

      regLine = d3.select(self.chartDiv.get(0)).select('.plot-data')
        .append('g')
        .attr('class', 'reg-line');

      regLine.append('line')
        .attr('x1', self.xScale(point1.x))
        .attr('x2', self.xScale(point2.x))
        .attr('y1', self.yScale(point1.y))
        .attr('y2', self.yScale(point2.y));
    }
  };

  /***
   * toggleGraphOfAve: toggles graph of averages
   * params:  boolean show - true or false
   ***/
  this.toggleGraphOfAve = function(show) {
    var plotType = self.bottomControls['res-plot'] === true ? 'plot-residual' : 'plot-data',
        data = self.filterData(),
        xData,
        yData,
        xMax,
        xMin,
        xMean,
        yMean,
        xSd,
        ySd,
        cc,
        slope,
        expectedY,
        tempRes,
        tempXMin,
        tempXMax,
        numPointsInBin,
        tempPointOfAve,
        xRangeIncrement,
        cumY,
        avgY,
        graphOfAve;

    self.container.find('svg g.graph-of-ave').remove();
    if (show) {
      xData = $.map(data, function(d) { return d.x; });
      yData = $.map(data, function(d) { return d.y; });
      xMax  = d3.max(xData);
      xMin  = d3.min(xData);
      xRangeIncrement = (xMax - xMin) / self.options.graphOfAvePoints;

      xMean = mean(xData);
      yMean = mean(yData);
      xSd   = sd(xData);
      ySd   = sd(yData);
      cc    = corr(xData, yData);
      slope = cc * ySd / xSd;

      graphOfAve = d3.select(self.chartDiv.get(0)).select('.' + plotType)
        .append('g')
        .attr('class', 'graph-of-ave');

      for (var i = 0; i < self.options.graphOfAvePoints; i++) {
        cumY            = 0;
        numPointsInBin  = 0;
        tempXMin        = xMin + i*xRangeIncrement;
        tempXMax        = xMin + (i+1)*xRangeIncrement;
        for (var j = 0; j < data.length; j++) {
          if (i === self.options.graphOfAvePoints - 1) {
            // fix to include largest endpoint in range
            if (data[j].x >= tempXMin && data[j].x <= tempXMax) {
              numPointsInBin += 1;
              cumY += data[j].y;
            }
          } else {
            if (data[j].x >= tempXMin && data[j].x < tempXMax) {
              numPointsInBin += 1;
              cumY += data[j].y;
            }
          }
        }

        if (numPointsInBin > 0) {
          // calculate average, create point
          avgY = cumY/numPointsInBin;
          tempPointOfAve  = { 'x': (tempXMin + tempXMax)/2, 'y': avgY };

          if (plotType === 'plot-residual') {
            // residual plot, plot on residual scale
            expectedY   = yMean - slope * (xMean - tempPointOfAve.x);
            tempRes     = avgY - expectedY;
            tempPointOfAve  = { 'x': (tempXMin + tempXMax)/2, 'y': avgY - expectedY };
          }

          // plot the point
          graphOfAve.append('rect')
            .attr('x', self.xScale(tempPointOfAve.x) - 2.5)
            .attr('y', self.yScale(tempPointOfAve.y) - 2.5)
            .attr('height', 5)
            .attr('width', 5);
        }
      }
    }
  };

  /***
   * toggleSdLine: toggles SD line
   * params:  boolean show - true or false
   ***/
  this.toggleSdLine = function(show) {
    var data = self.filterData(),
        xData,
        yData,
        xMean,
        yMean,
        xMax,
        xMin,
        xSd,
        ySd,
        cc,
        slope,
        pointMean,
        point1,
        point2,
        sdLine;

    self.container.find('svg g.sd-line').remove();
    if (show) {
      xData = $.map(data, function(d) { return d.x; });
      yData = $.map(data, function(d) { return d.y; });
      xMean = mean(xData);
      yMean = mean(yData);
      xSd   = sd(xData);
      ySd   = sd(yData);
      cc    = corr(xData, yData);
      xMax  = d3.max(xData);
      xMin  = d3.min(xData);
      yMin  = d3.min(yData);
      yMax  = d3.max(yData);
      slope = (cc >= 0 ? 1 : -1 ) * ySd/xSd;

      pointMean = { 'x': xMean, 'y': yMean };
      point1    = { 'x': xMin, 'y': pointMean.y - slope * (pointMean.x - xMin) };
      point2    = { 'x': xMax, 'y': pointMean.y - slope * (pointMean.x - xMax) };

      if (point1.y < yMin) {
        // y is below axes, get x "intercept" (y = yMin)
        point1.x = pointMean.x - (pointMean.y - yMin)/slope;
        point1.y = yMin;
      }
      if (point2.y < yMin) {
        point2.x = (yMin - pointMean.y)/slope + xMean;
        point2.y = yMin;
      }

      sdLine = d3.select(self.chartDiv.get(0)).select('.plot-data')
        .append('g')
        .attr('class', 'sd-line');

      sdLine.append('line')
        .attr('x1', self.xScale(point1.x))
        .attr('x2', self.xScale(point2.x))
        .attr('y1', self.yScale(point1.y))
        .attr('y2', self.yScale(point2.y));
    }

  };

  this.filterData = function() {
    var useAddedPoints  = self.bottomControls['use-points'],
        allData         = self.currentData,
        numData         = allData.length,
        tempDataPoints;
    if (useAddedPoints) {
      return allData;
    } else {
      // if not using added points, filter points that have added = false
      tempDataPoints = $.grep( allData, function(data, index) {
        return data.added === false;
      });
      return tempDataPoints;
    }
  };

  /***
   * highlightDataPoint: highlights and unhighlights data point
   * params:  dataIndex: index of data point to highlight
   ***/
  this.highlightDataPoint = function(dataIndex, eventType) {
    var selectedDataPoint = d3.select(self.chartDiv.get(0)).select('.data-point[data-index="' + dataIndex + '"]'),
        dataSticky        = selectedDataPoint.classed('selected'),
        newStickyState;

    if (eventType === 'mouseover') {
      // reorders the elements such that the one to be highlighted is on top
      selectedDataPoint.node().parentNode.appendChild(selectedDataPoint.node());
      // apply the active class, emphasize data point
      selectedDataPoint.classed('active', true)
        .transition()
        .duration(200)
        .attr('r', 5);
    } else if (eventType === 'mouseout') {
      // revert circle back to looks of regular data point, unless sticky
      selectedDataPoint.classed('active', false)
        .transition()
        .duration(200)
        .attr('r', function() { return (dataSticky ? 3.5 : 2); });
    } else if (eventType === 'click') {
      // remove other sticky data points
      /*
      d3.select(self.chartDiv.get(0)).select('.data-point.selected:not([data-index="' + dataIndex + '"])')
        .classed('selected', false)
        .classed('highlight', false)
        .transition()
        .duration(200)
        .attr('r', 2);
       */

      newStickyState = !dataSticky;
      // toggle sticky on data point
      selectedDataPoint.classed('selected', newStickyState);

      // new sticky state
      self.currentData[dataIndex].selected = newStickyState;

      // update class for corresponding data in data-list
      // self.container.find('.popbox.list-data tr:not([data-index="' + dataIndex + '"])').removeClass('selected');
      self.container.find('.popbox.list-data tr[data-index="' + dataIndex + '"]').toggleClass('selected');
    }
  };


  /***
   * plotMean: plots mean
   ***/
  this.plotMean = function() {
    // called whenever data changes
    var data  = self.filterData(),
        xData = $.map(data, function(d) { return d.x; }),
        yData = $.map(data, function(d) { return d.y; }),
        xMean = mean(xData),
        yMean = (self.bottomControls['res-plot'] === true ? 0 : mean(yData)),
        xScale = self.xScale,
        yScale = self.yScale,
        rectSize = 5;

    d3.select(self.chartDiv.get(0)).select('.mean-point').remove();

    d3.select(self.chartDiv.get(0)).select('svg .plot')
        .append('rect')
        .attr('x', xScale(xMean) - rectSize/2)
        .attr('y', yScale(yMean) - rectSize/2)
        .attr('class', 'mean-point')
        .attr('width', rectSize)
        .attr('height', rectSize)
        .attr('fill', 'rgba(255, 0, 0, 1)')
        .attr('stroke', '#000');
  };

  /***
   * toggleSds: toggles SDs
   * params:  boolean show - true or false
   ***/
  this.toggleSds = function(show) {
    var data = self.filterData(),
        xMean,
        yMean,
        xSd,
        ySd,
        xData,
        yData,
        xSdPlots,
        ySdPlots,
        sds;

    self.container.find('svg g.sds').remove();
    if (show) {
      // compute lines
      xData     = $.map(data, function(d) { return d.x; });
      yData     = $.map(data, function(d) { return d.y; });
      xMean     = mean(xData);
      yMean     = mean(yData);
      xSd       = sd(xData);
      ySd       = sd(yData);
      xSdPlots  = [(xMean - xSd), (xMean + xSd)];
      ySdPlots  = [(yMean - ySd), (yMean + ySd)];

      // plot lines
      sds = d3.select(self.chartDiv.get(0)).select('.plot-data')
        .append('g')
        .attr('class', 'sds');
      sds.append('line')
        .attr('x1', self.xScale(xSdPlots[0]))
        .attr('x2', self.xScale(xSdPlots[0]))
        .attr('y1', 0)
        .attr('y2', self.chartHeight - self.chartMargins.bottom - self.chartMargins.top);
      sds.append('line')
        .attr('x1', self.xScale(xSdPlots[1]))
        .attr('x2', self.xScale(xSdPlots[1]))
        .attr('y1', 0)
        .attr('y2', self.chartHeight - self.chartMargins.bottom - self.chartMargins.top);
      sds.append('line')
        .attr('x1', 0)
        .attr('x2', self.chartWidth - self.chartMargins.left - self.chartMargins.right)
        .attr('y1', self.yScale(ySdPlots[0]))
        .attr('y2', self.yScale(ySdPlots[0]));
      sds.append('line')
        .attr('x1', 0)
        .attr('x2', self.chartWidth - self.chartMargins.left - self.chartMargins.right)
        .attr('y1', self.yScale(ySdPlots[1]))
        .attr('y2', self.yScale(ySdPlots[1]));
    }
  };


  // Initializes the chart controls (top, data, and bottom)
  function initControls() {
    var $stici = $('<div/>').addClass('stici').addClass( 'stici_scatterplot'),
        $topControls = $('<div/>').addClass('top_controls');

    self.container.append($stici);
    $stici.append($topControls);

    if (typeof(self.options.title) == "string") {
      $topControls.append(self.options.title);
    }

    // Chart (for svg container)
    self.chartDiv = $('<div/>').addClass('stici_chart').addClass('chart_box');
    $stici.append(self.chartDiv);

    // Top controls
    if (dataIsFromExternalFile()) {
      self.urlInput = $('<input type="text" />');
      self.dataSelect = $('<select class="data_select"/>').change(self.reloadData);
      self.xVariableSelect = $('<select class="variable_select"/>').change(function() {
        self.prepareData();
        self.reloadChart();
      });
      self.yVariableSelect = $('<select class="variable_select"/>').change(function() {
        self.prepareData();
        self.reloadChart();
      });

      $topControls.append('Data: ');
      if (self.options.files.length > 1) {
        $topControls.append(self.dataSelect);
      } else {
        $topControls.append(self.options.files[0].replace(/^.*[\\\/]/, ''));
        $topControls.append('&nbsp;&nbsp;&nbsp;');
      }

      // for each data set, append option to option select
      $.each(self.options.files, function(i, dataUrl) {
        self.dataSelect.append($('<option/>')
                       .attr('value', dataUrl)
                       .text(dataUrl.replace(/^.*[\\\/]/, '')));
      });

      // append x and y variable selects
      $topControls.append(self.yVariableSelect);
      $topControls.append(' vs ');
      $topControls.append(self.xVariableSelect);
    } else if (dataIsGenerated()) {
      // r controls
      self.rInput = jQuery('<input type="text" />').change(function() {
        if (!self.inited)
          return;
        rSlider.slider('value', self.rInput.val());
        self.r = self.rInput.val();
        loadGeneratedData();
      });
      var updateRInput = function() {
        if (!self.inited)
          return;
        self.rInput.val(rSlider.slider('value'));
        self.r = rSlider.slider('value');
        loadGeneratedData();
      };
      var rSlider = jQuery('<span/>').addClass('slider').slider({
        change: updateRInput,
        slide: updateRInput,
        step: 0.001,
        max: 1,
        min: -1
      });
      self.rInput.val(self.r);
      rSlider.slider('value', self.rInput.val());
      if (self.options.showRBar) {
        $topControls.append('r: ').append(self.rInput).append(rSlider);
      }

      // n controls
      var nInput = jQuery('<input type="text" />').change(function() {
        if (!self.inited)
          return;
        nSlider.slider('value', nInput.val());
        self.n = nInput.val();
        loadGeneratedData();
      });
      var updateNInput = function() {
        if (!self.inited)
          return;
        nInput.val(nSlider.slider('value'));
        self.n = nSlider.slider('value');
        loadGeneratedData();
      };
      var nSlider = jQuery('<span/>').addClass('slider').slider({
        change: updateNInput,
        slide: updateNInput,
        step: 1,
        max: 200,
        min: 3
      });
      if (self.options.showRBar) {
        nInput.val(self.n);
        nSlider.slider('value', nInput.val());
        $topControls.append('n: ').append(nInput).append(nSlider);
      }
    }

    // Bottom controls
    var $bottom = $('<div/>').addClass('bottom_controls').addClass('extended'),
        $rHat = $('<span/>').data('btnId', 'r-hat').text('r: 0.16'),
        $toggleSd = $('<button/>').data('btnId', 'sds').text('SDs'),
        $toggleSdLine = $('<button/>').data('btnId', 'sd-line').text('SD Line'),
        $toggleGraphOfAve = $('<button/>').data('btnId', 'graph-of-ave').text('Graph of Ave'),
        $toggleRegLine  = $('<button/>').data('btnId', 'reg-line').text('Regression Line'),
        $toggleResPlot  = $('<button/>').data('btnId', 'res-plot').text('Plot Residuals'),
        $popboxControls = $('<div/>').attr('class', 'popbox-controls'),
        $toggleUsePoints  = $('<button/>').data('btnId', 'use-points').text('Use Added Points'),
        $toggleClearPoints = $('<button/>').data('btnId', 'clear-points').text('Clear Added Points'),
        $cursorPos  = $('<span/>').addClass('cursor-pos').text('');

    $stici.append($bottom);

    if (self.options.showR && !dataIsGenerated())
      $bottom.append($rHat);
    if (self.options.sdButton)
      $bottom.append($toggleSd);
    if (self.options.sdLineButton)
      $bottom.append($toggleSdLine);
    if (self.options.graphAveButton)
      $bottom.append($toggleGraphOfAve);
    if (self.options.regressButton)
      $bottom.append($toggleRegLine);
    if (self.options.residualsButton)
      $bottom.append($toggleResPlot);
    $bottom.append('<br/>').append($popboxControls);
    if (self.options.addPoints)
      $bottom.append($toggleUsePoints).append($toggleClearPoints);
    $bottom.append($cursorPos);

    $stici.find('button').on('click', function(e) {
      e.preventDefault();
      handleBtnToggle(e);
    });
  }


  /***
   * handleBtnToggle: Handles button toggle
   * params: Event e
   ***/
  function handleBtnToggle(e) {
    var $target = self.container.find(e.target),
        btnId   = $target.data('btnId');
    if (btnId === 'clear-points' || btnId === 'list-data' || btnId === 'univar-stats') {
    } else {
      $target.toggleClass('selected');
      self.bottomControls[btnId] = (self.bottomControls[btnId] === true ? false : true);
    }
    self.toggleOption(btnId, $target.hasClass('selected'));
  }

  /***
   * handleMouseOver: event handler for mouse over data
   * params: Event e
   ***/
  function handlePopboxMouseEvents(e) {
    var eventType     = e.type,
        $target       = self.container.find(e.target),
        $closestTable = $target.closest('table'),
        $closestRow,
        dataIndex;
    if ($closestTable.hasClass('data-values')) {
      $closestRow = $target.closest('tr');
      dataIndex   = $closestRow.attr('data-index');
      self.highlightDataPoint(dataIndex, eventType);
    }
  }

  /***
   * Simulates a click on one of the bottom buttons given its btnId,
   * e.g. 'sd-line'. Used during initialization to set the buttons to the
   * state defined in the initialization parameters.
   */
  function simulateBtnPress(btnId) {
    self.container.find('.bottom_controls').children().filter(function() {
      return $(this).data('btnId') == btnId;
    }).click();
  }

  /***
   * Returns true if data source is an external json-encoded file, false
   * otherwise.
   */
  function dataIsFromExternalFile() {
    if (self.options.files !== null)
      return true;
    else
      return false;
  }

  /***
   * Returns true if data is generated according to a normal bivariate with
   * specified realized correlation coefficient.
   */
  function dataIsGenerated() {
    if (self.options.r !== null || self.options.n !== null)
      return true;
    else
      return false;
  }

  /***
   * Returns true if the data points have been manually specified.
   */
  function dataIsManual() {
    if (self.options.x !== null || self.options.y !== null)
      return true;
    else
      return false;
  }

  // document ready
  $().ready(function() {
  });

  initControls();
  this.reloadData();
}

/* script stat_utils: statistical functions, vector functions, linear algebra

   copyright (c) 1997-2013. P.B. Stark, statistics.berkeley.edu/~stark
   Version 1.0

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    See <http://www.gnu.org/licenses/>
*/

// !!!!Beginning of the code!!!!

Array.prototype.max = function() { // beware: do not use for long arrays
  return Math.max.apply(null, this);
};

Array.prototype.min = function() { // beware: do not use for long arrays
  return Math.min.apply(null, this);
};
Number.prototype.fix = function(n) { // beware: do not use for long arrays
  return parseFloat(this.toFixed(n));
};

var rmin = 2.3e-308;
var eps = 2.3e-16;

// ============================================================================
// ========================= STATISTICAL SUBROUTINES ==========================

function mean(list) { // computes the mean of the list
    return(vSum(list)/list.length);
}

function vMult(a, list) { // multiply a vector times a scalar
    var list2 = new Array(list.length);
    for (var i=0; i < list.length; i++) {
        list2[i] = a*list[i];
    }
    return(list2);
}

function vScalarSum(list, scalar) { // adds the scalar to every component of the list
    var vs = new Array(list.length);
    for (var i =0; i < list.length; i++) {
        vs[i] = list[i] + scalar;
    }
    return(vs);
}

function vVectorSum(list1, list2) { // vector addition
    if (list1.length != list2.length) {
        alert('Error #1 in irGrade.vVectorSum: vector lengths are not equal');
        return(Math.NaN);
    } else {
        var vs = new Array(length(list1));
        for (var i =0; i < list1.length; i++) {
            vs[i] = list1[i] + list2[i];
        }
        return(vs);
    }
}

function vPointwiseMult(list1, list2) { // componentwise multiplication of two vectors
    var list3 = Math.NaN;
    if (list1.length != list2.length) {
        alert('Error #1 in irGrade.vPointwiseMult: vector lengths do not match!');
    } else {
        list3 = new Array(list1.length);
        for (var i=0; i < list1.length; i++) {
            list3[i] = list1[i]*list2[i];
        }
    }
    return(list3);
}

function vFloor(list) { // takes floor of all components
    var list2 = new Array(list.length);
    for (var i = 0; i < list.length; i++) {
        list2[i] = Math.floor(list[i]);
    }
    return(list2);
}

function vCeil(list) { // takes ceil of all components
    var list2 = new Array(list.length);
    for (var i = 0; i < list.length; i++) {
        list2[i] = Math.ceil(list[i]);
    }
    return(list2);
}

function vRoundToInts(list) { // round all components to the nearest int
    var list2 = new Array(list.length);
    var tmp;
    for (var i = 0; i < list.length; i++) {
        list2[i] = Math.floor(list[i]);
        if (list[i] - list2[i] >= 0.5) {
            list2[i]++;
        }
    }
    return(list2);
}

function vSum(list) { // computes the sum of the elements of list
    var tot = 0.0;
    for (var i = 0; i < list.length; i++) {
        tot += list[i];
    }
    return(tot);
}

function vProd(list) { // computes the product of the elements of list
    var p = 1.0;
    for (var i = 0; i < list.length; i++) {
        p *= list[i];
    }
    return(p);
}

function vCum(list) { // vector of cumulative sum
    var list2 = list;
    for (var i = 1; i < list.length; i++ ) {
        list2[i] += list2[i-1];
    }
    return(list2);
}

function vDiff(list) { // vector of differences; 1st element unchanged
    var list2 = new Array(list.length);
    for (var i = list.length-1; i > 0; i-- ) {
        list2[i] = list[i] - list[i-1];
    }
    list2[0] = list[0];
    return(list2);
}


function vInterval(list) { // vector of differences between successive elements; 0 subtracted from first element
    var list2 = [];
    list2[0] = list[0];
    for (var i = 1; i < list.length; i++) {
        list2[i] = list[i] - list[i-1];
    }
    return(list2);
}

function vZero(n) { // returns a vector of zeros of length n
    var list = new Array(n);
    for (var i=0; i < n; i++) {
        list[i] = 0.0;
    }
    return(list);
}

function vOne(n) { // returns a vector of ones of length n
    var list = new Array(n);
    for (var i=0; i < n; i++) {
        list[i] = 1.0;
    }
    return(list);
}

function twoNorm(list) { // two norm of a vector
    var tn = 0.0;
    for (var i=0; i < list.length; i++) {
        tn += list[i]*list[i];
    }
    return(Math.sqrt(tn));
}

function convolve(a,b) { // convolve two lists
    var c = new Array(a.length + b.length - 1);
    var left; var right;
    for (var i=0; i < a.length + b.length - 1; i++) {
        c[i] = 0;
        right = Math.min(i+1, a.length);
        left = Math.max(0, i - b.length + 1);
        for (var j=left; j < right; j++) {
            c[i] += a[j]*b[b.length - i - 1 + j];
        }
    }
    return(c);
}

function nFoldConvolve(a,n) {
    var b = a;
    for (var i=0; i < n; i++ ) {
        b = convolve(b,a);
    }
    return(b);
}

function numberLessThan(a,b) { // numerical ordering for javascript sort function
    var diff = parseFloat(a)-parseFloat(b);
    if (diff < 0) {
        return(-1);
    } else if (diff === 0) {
        return(0);
    } else {
        return(1);
    }
}

function numberGreaterThan(a,b) { // numerical ordering for javascript sort function
    var diff = parseFloat(a)-parseFloat(b);
    if (diff < 0) {
        return(1);
    } else if (diff === 0) {
        return(0);
    } else {
        return(-1);
    }
}

function sd(list) { // computes the SD of the list
    ave = mean(list);
    ssq = 0;
    for (var i = 0; i < list.length; i++) {
        ssq += (list[i] - ave)*(list[i] - ave);
    }
    ssq = Math.sqrt(ssq/list.length);
    return(ssq);
}

function sampleSd(list) { // computes the sample SD of the list
    ave = mean(list);
    ssq = 0;
    for (var i = 0; i < list.length; i++) {
        ssq += (list[i] - ave)*(list[i] - ave);
    }
    ssq = Math.sqrt(ssq/(list.length - 1.0));
    return(ssq);
}

function corr(list1, list2) {
// computes the correlation coefficient of list1 and list2
    if (list1.length != list2.length) {
        alert('Error #1 in irGrade.corr(): lists have different lengths!');
        return(Math.NaN);
    } else {
        var ave1 = mean(list1);
        var ave2 = mean(list2);
        var sd1 = sd(list1);
        var sd2 = sd(list2);
        var cc = 0.0;
        for (var i=0; i < list1.length; i++) {
            cc += (list1[i] - ave1)*(list2[i] - ave2);
        }
        cc /= sd1*sd2*list1.length;
        return(cc);
    }
}

function percentile(list,p) { // finds the pth percentile of list
    var n = list.length;
    var sList = list.slice(0);
    sList.sort(numberLessThan);
    var ppt = Math.max(Math.ceil(p*n/100),1);
    return(sList[ppt-1]);
}

function histMakeCounts(binEnd, data) {  // makes vector of histogram heights
        var nBins = binEnd.length - 1;
        var counts = new Array(nBins);
        var i = 0;
        for (i=0; i < nBins; i++) {
            counts[i] = 0;
        }
        for (i=0; i < data.length; i++) {
           for (var k=0; k < nBins - 1; k++) {
              if (data[i] >= binEnd[k] && data[i] < binEnd[k+1] ) {
                  counts[k] += 1;
              }
           }
           if (data[i] >= binEnd[nBins - 1] ) {
              counts[nBins - 1] += 1;
           }
        }
        for (i=0; i < nBins; i++) {
           counts[i] /= data.length*(binEnd[i+1]-binEnd[i]);
        }
        return(counts);
}

function histMakeBins(nBins, data) { // makes equispaced histogram bins that span the range of data
        binEnd = new Array(nBins+1);
        dMnMx = vMinMax(data);
        for (var i=0; i < nBins+1; i++) {
           binEnd[i] = dMnMx[0] + i*(dMnMx[1] - dMnMx[0])/nBins;
        }
        return(binEnd);
}

function histEstimatedPercentile(pct, binEnd, counts) {  // estimates the pth percentile from a histogram
        var p = pct/100.0;
        var pctile;
        if (p > 1.0) {
            pctile = Math.NaN;
        } else if (p == 1.0) {
            pctile = binEnd[nBins];
        } else {
            var area = 0.0;
            var j = 0;
            while (area < p) {
               j++;
               area = histHiLitArea(binEnd[0], binEnd[j], binEnd, counts);
            }
            j--;
            area = p - histHiLitArea(binEnd[0], binEnd[j], binEnd, counts);
            var nextBinArea = histHiLitArea(binEnd[j], binEnd[j+1], binEnd, counts);
            pctile = binEnd[j] + (area/nextBinArea) * (binEnd[j+1] - binEnd[j]);
        }
        return(pctile);
}

function histHiLitArea(loEnd, hiEnd, binEnd, counts) { // area of counts from loEnd to hiEnd
          var nBins = binEnd.length - 1;
          var area = 0;
          if (loEnd < hiEnd) {
             for (var i=0; i < nBins; i++) {
                if( binEnd[i]  > hiEnd ||  binEnd[i+1] <= loEnd) {
                } else if (binEnd[i] >= loEnd && binEnd[i+1] <= hiEnd) {
                   area += counts[i]*(binEnd[i+1]-binEnd[i]);
                } else if (binEnd[i] >= loEnd && binEnd[i+1] > hiEnd) {
                   area += counts[i]*(hiEnd - binEnd[i]);
                } else if (binEnd[i] <= loEnd && binEnd[i+1] <= hiEnd) {
                   area += counts[i]*(binEnd[i+1]-loEnd);
                } else if (binEnd[i] < loEnd && binEnd[i+1] > hiEnd) {
                   area += counts[i]*(hiEnd - loEnd);
                }
            }
         }
      return(area);
}

function listOfRandSigns(n) { // random +-1 vector
    var list = new Array(n);
    for (var i=0; i < n; i++) {
        var rn = rand.next();
        if (rn < 0.5) {
            list[i] = -1;
        } else {
            list[i] = 1;
        }
    }
    return(list);
}

function listOfRandUniforms(n, lo, hi) { // n random variables uniform on (lo, hi)
    if ( (typeof(lo) == 'undefined') || (lo === null) ) {
        lo = 0.0;
    }
    if ( (typeof(hi) == 'undefined') || (hi === null) ) {
            hi = 1.0;
    }
    var list = new Array(n);
    for (var i=0; i < n; i++) {
        list[i] = lo + (hi-lo)*rand.next();
    }
    return(list);
}

function listOfRandInts(n, lo, hi) { // n random integers between lo and hi
    var list = new Array(n);
    for (var i=0; i < n; i++) {
        list[i] = Math.floor((hi+1 - lo)*rand.next()) + lo;
    }
    return(list);
}

function listOfDistinctRandInts(n, lo, hi) { // n dintinct random integers between lo and hi
    var list = new Array(n);
    var trial;
    var i=0;
    var unique;
    while (i < n) {
        trial = Math.floor((hi+1 - lo)*rand.next()) + lo;
        unique = true;
        for (var j = 0; j < i; j++) {
            if (trial == list[j]) unique = false;
        }
        if (unique) {
            list[i] = trial;
            i++;
        }
    }
    return(list);
}

function randomSample(list, ssize, replace) {
  // sample from list, size ssize w/ or w/o replacement.
  // default is without replacement
    var sample = [];
    var indices = [];
    if (replace !== null && replace ) {
        indices = listOfRandInts(ssize,0,list.length-1);
    } else {
        indices = listOfDistinctRandInts(ssize,0,list.length - 1);
    }
    for (var i=0; i < ssize; i++) {
        sample[i] = list[indices[i]];
    }
    return(sample) ;
}

function randomPartition(list, n) {
  // randomly partition list into n nonempty groups
    var bars = listOfDistinctRandInts(n-1, 1, list.length-1).sort(numberLessThan);
    bars[bars.length] = list.length;
    var parts = new Array(n);
    var i = 0;
    for (i = 0; i < parts.length; i++) {
        parts[i] = [];
    }
    for (i=0; i < bars[0]; i++) {
        parts[0][i] = list[i];
    }
    for (var j=1; j < n; j++) {
        for (i=0; i < bars[j]-bars[j-1]; i++) {
           parts[j][i] = list[bars[j-1]+i];
        }
    }
    return(parts);
}

function constrainedRandomPartition(list, n, mx) {
  // randomly partition list into n nonempty groups no bigger than mx
    if (n*mx < list.length) {
        alert('Error in irGrade.constrainedRandomPartition: mx too small!');
        return(false);
    } else {
        var bars = listOfDistinctRandInts(n-1, 1, list.length-1).sort(numberLessThan);
        bars[bars.length] = list.length;
        vm = vMinMax(vDiff(bars))[1];
        while (vm > mx) {
            bars = listOfDistinctRandInts(n-1, 1, list.length-1).sort(numberLessThan);
            bars[bars.length] = list.length;
            vm = vMinMax(vDiff(bars))[1];
        }
        var parts = new Array(n);
        var i = 0;
        for (i = 0; i < parts.length; i++) {
            parts[i] = [];
        }
        for (i=0; i < bars[0]; i++) {
            parts[0][i] = list[i];
        }
        for (var j=1; j < n; j++) {
            for (i=0; i < bars[j]-bars[j-1]; i++) {
               parts[j][i] = list[bars[j-1]+i];
            }
        }
        return(parts);
    }
}

function multinomialSample(pVec, n) { // multinomial sample of size n with probabilities pVec
    pVec = vMult(1.0/vSum(pVec), pVec); // renormalize in case
    var pCum = vCum(pVec);
    var counts = vZero(pVec.length);
    var rv;
    var inx;
    for (var i=0; i < n; i++) {
        rv = rand.next();
        inx = 0;
        while ( (rv > pCum[inx]) && (inx < n) ) {
            inx++;
        }
        counts[inx]++;
    }
    return(counts);
}

function normPoints(n, mu, s, dig) {   // n normals with expected value mu, sd s, rounded to dig
    var round = true;
    if ( (typeof(dig) == 'undefined') || (dig === null) ) {
        round = false;
    }
    var xVal = new Array(n);
    var i = 0;
    if (round) {
        for (i=0; i < n; i++) {
            xVal[i] = roundToDig(mu + s*rNorm(),dig);
        }
    } else {
        for (i=0; i < n; i++) {
            xVal[i] = mu + s*rNorm();
        }
    }
    return(xVal);
}

function cNormPoints(n, r) {
 // generate n pseudorandom normal bivariates w/ specified realized correlation coefficient r
 // if n = 1, this is impossible; if n=2, this is possible only if r \in {-1, 0, 1}
    var xVal = new Array(n);
    var yVal = new Array(n);
    var i;
    if (n == 2) {  // only three possible values of r
        if (r == -1) {
            xVal[0] = -10;
            xVal[1] = 10;
            yVal[0] = 10;
            yVal[1] = -10;
        } else if (r === 0) {
            xVal[0] = -10;
            xVal[1] = 10;
            yVal[0] = 0;
            yVal[1] = 0;
        } else if (r == 1) {
            xVal[0] = -10;
            xVal[1] = 10;
            yVal[0] = -10;
            yVal[1] = 10;
       } else {
            xVal[0] = Number.NaN;
            yVal[0] = Number.NaN;
       }
    } else if (n > 2) { // anything should be possible
        for (i=0; i<n ; i++ ) {
            xVal[i]= rNorm();
            yVal[i] = rNorm();
        }
        var rAtt = corr(xVal, yVal);
        var s = sgn(rAtt)*sgn(r);
        var xBarAtt = mean(xVal);
        var yBarAtt = mean(yVal);
        var xSdAtt = sd(xVal);
        var ySdAtt = sd(yVal);
        var pred = new Array(n);
        var resid = new Array(n);
        for (i=0; i < n; i++) {
            xVal[i] = (xVal[i] - xBarAtt)/xSdAtt;
            pred[i] = s*rAtt*xVal[i]*ySdAtt+ yBarAtt;
            resid[i] = s*yVal[i] - pred[i];
        }
        var resNrm = rms(resid);
        for (i = 0; i < n; i++) {
            yVal[i] = Math.sqrt(1.0-r*r)*resid[i]/resNrm + r*xVal[i];
        }
        var ymnmx = vMinMax(yVal);
        var xmnmx = vMinMax(xVal);
        var xscl = 8.5/(xmnmx[1] - xmnmx[0]);
        var yscl = 8.5/(ymnmx[1] - ymnmx[0]);
        for (i=0; i < n; i++) {
            xVal[i] = (xVal[i] - xmnmx[0]) * xscl  + 1.0;
            yVal[i] = (yVal[i] - ymnmx[0]) * yscl + 1.0;
        }
    } else { // n = 1 is nonsense
        xVal[0] = Number.NaN;
        yVal[0] = Number.NaN;
    }
    var lists = new Array(xVal,yVal);
    return(lists);
}// ends cNormPoints

function listOfRandReals(n,lo,hi) { // n-vector of uniforms on [lo, hi]
    var list = new Array(n);
    for (var i=0; i < n; i++) {
        list[i] = (hi - lo)*rand.next() + lo;
    }
    return(list);
}

function rNorm() {  // standard normal pseudorandom variable
    var y = normInv(rand.next());
    return(y);
} // ends rNorm()

function normCdf(y) { // normal distribution cumulative distribution function
   return(0.5*erfc(-y*0.7071067811865475));
}

function erfc(x) { // error function
     var xbreak = 0.46875;     // for normal cdf
// coefficients for |x| <= 0.46875
    var a = [3.16112374387056560e00, 1.13864154151050156e02,
             3.77485237685302021e02, 3.20937758913846947e03,
             1.85777706184603153e-1];
    var b = [2.36012909523441209e01, 2.44024637934444173e02,
            1.28261652607737228e03, 2.84423683343917062e03];
// coefficients for 0.46875 <= |x| <= 4.0
    var c = [5.64188496988670089e-1, 8.88314979438837594e00,
             6.61191906371416295e01, 2.98635138197400131e02,
             8.81952221241769090e02, 1.71204761263407058e03,
             2.05107837782607147e03, 1.23033935479799725e03,
             2.15311535474403846e-8];
    var d = [1.57449261107098347e01, 1.17693950891312499e02,
             5.37181101862009858e02, 1.62138957456669019e03,
             3.29079923573345963e03, 4.36261909014324716e03,
             3.43936767414372164e03, 1.23033935480374942e03];
// coefficients for |x| > 4.0
    var p = [3.05326634961232344e-1, 3.60344899949804439e-1,
             1.25781726111229246e-1, 1.60837851487422766e-2,
             6.58749161529837803e-4, 1.63153871373020978e-2];
    var q = [2.56852019228982242e00, 1.87295284992346047e00,
             5.27905102951428412e-1, 6.05183413124413191e-2,
             2.33520497626869185e-3];
    var y, z, xnum, xden, result, del;

/*
Translation of a FORTRAN program by W. J. Cody,
Argonne National Laboratory, NETLIB/SPECFUN, March 19, 1990.
The main computation evaluates near-minimax approximations
from "Rational Chebyshev approximations for the error function"
by W. J. Cody, Math. Comp., 1969, PP. 631-638.
*/

//  evaluate  erf  for  |x| <= 0.46875

    var i = 0;
    if(Math.abs(x) <= xbreak) {
        y = Math.abs(x);
        z = y * y;
        xnum = a[4]*z;
        xden = z;
        for (i = 0; i< 3; i++) {
            xnum = (xnum + a[i]) * z;
            xden = (xden + b[i]) * z;
        }
        result = 1.0 - x* (xnum + a[3])/ (xden + b[3]);
    } else if (Math.abs(x) <= 4.0) {
        y = Math.abs(x);
        xnum = c[8]*y;
        xden = y;
        for (i = 0; i < 7; i++) {
            xnum = (xnum + c[i])* y;
            xden = (xden + d[i])* y;
        }
        result = (xnum + c[7])/(xden + d[7]);
        if (y > 0.0) {
            z = Math.floor(y*16)/16.0;
        } else {
            z = Math.ceil(y*16)/16.0;
        }
        del = (y-z)*(y+z);
        result = Math.exp(-z*z) * Math.exp(-del)* result;
    } else {
        y = Math.abs(x);
        z = 1.0 / (y*y);
        xnum = p[5]*z;
        xden = z;
        for (i = 0; i < 4; i++) {
            xnum = (xnum + p[i])* z;
            xden = (xden + q[i])* z;
        }
        result = z * (xnum + p[4]) / (xden + q[4]);
        result = (1.0/Math.sqrt(Math.PI) -  result)/y;
        if (y > 0.0) {
            z = Math.floor(y*16)/16.0;
        } else {
            z = Math.ceil(y*16)/16.0;
        }
        del = (y-z)*(y+z);
        result = Math.exp(-z*z) * Math.exp(-del) * result;
    }
    if (x < -xbreak) {
        result = 2.0 - result;
    }
    return(result);
}

function normInv(p) {
    if ( p === 0.0 ) {
        return(Math.NEGATIVE_INFINITY);
    } else if ( p >= 1.0 ) {
        return(Math.POSITIVE_INFINITY);
    } else {
        return(Math.sqrt(2.0) * erfInv(2*p - 1));
    }
}

function erfInv(y) {
    var a = [ 0.886226899, -1.645349621, 0.914624893, -0.140543331];
    var b = [-2.118377725, 1.442710462, -0.329097515, 0.012229801];
    var c = [-1.970840454, -1.624906493, 3.429567803, 1.641345311];
    var d = [ 3.543889200, 1.637067800];
    var y0 = 0.7;
    var x = 0;
    var z = 0;
    if (Math.abs(y) <= y0) {
        z = y*y;
        x = y * (((a[3]*z+a[2])*z+a[1])*z+a[0])/
         ((((b[3]*z+b[2])*z+b[1])*z+b[0])*z+1.0);
    } else if (y > y0 && y < 1.0) {
        z = Math.sqrt(-Math.log((1-y)/2));
        x = (((c[3]*z+c[2])*z+c[1])*z+c[0]) / ((d[1]*z+d[0])*z+1);
    } else if (y < -y0 && y > -1) {
        z = Math.sqrt(-Math.log((1+y)/2));
        x = -(((c[3]*z+c[2])*z+c[1])*z+c[0])/ ((d[1]*z+d[0])*z+1);
    }
    x = x - (1.0 - erfc(x) - y) / (2/Math.sqrt(Math.PI) * Math.exp(-x*x));
    x = x - (1.0 - erfc(x) - y) / (2/Math.sqrt(Math.PI) * Math.exp(-x*x));

    return(x);
} // ends erfInv

function betaCdf( x,  a,  b) {
   if (a <= 0 || b <= 0) {
      return(Math.NaN);
   } else if (x >= 1) {
      return(1.0);
   } else if ( x > 0.0) {
      return(Math.min(incBeta(x ,a ,b),1.0));
   } else {
      return(0.0);
   }
}

function betaPdf( x,  a,  b) {
    if (a <= 0 || b <= 0 || x < 0 || x > 1) {
        return(Math.NaN);
    } else if ((x === 0 && a < 1) || (x == 2 && b < 1)) {
        return(Math.POSITIVE_INFINITY);
    } else if (!(a <= 0 || b <= 0 || x <= 0 || x >= 1)) {
        return(Math.exp((a - 1)*Math.log(x) + (b-1)*Math.log(1 - x) - lnBeta(a,b)));
    } else {
        return(0.0);
    }
}

function lnBeta( x, y) {
    return(lnGamma(x) + lnGamma(y) - lnGamma(x+y));
}

function betaInv( p,  a,  b) {
    if (p < 0 || p > 1 || a <= 0 || b <= 0) {
        return(Math.NaN);
    } else if ( p === 0 ) {
        return(Math.NEGATIVE_INFINITY);
    } else if ( p == 1) {
        return(Math.POSITIVE_INFINITY);
    } else {
        var maxIt = 100;
        var it = 0;
        var tol = Math.sqrt(eps);
        var work = 1.0;
        var next;
        var x;
        if (a === 0.0 ) {
            x = Math.sqrt(eps);
        } else if ( b === 0.0) {
            x = 1 - Math.sqrt(eps);
        } else {
            x = a/(a+b);
        }
        while (Math.abs(work) > tol*Math.abs(x) && Math.abs(work) > tol && it < maxIt) {
           it++;
           work = (betaCdf(x,a,b) - p)/betaPdf(x,a,b);
           next =  x - work;
           while (next < 0 || next > 1) {
               work = work/2;
               next = x - work;
           }
           x = next;
         }
         return(x);
     }
}

function gammaPdf(x, a, b) {
  var ans = Math.NaN;
  if (a <= 0 || b <= 0) {
    ans = Math.NaN;
  } else if (x > 0) {
    ans = Math.exp((a-1)*Math.log(x)-(x/b)-lnGamma(a)-a*Math.log(b));
  } else if (x === 0 && a < 1) {
    ans = Math.POSITIVE_INFINITY;
  } else if (x === 0 && a == 1) {
    ans = 1/b;
  }
  return(ans);
}

function lnGamma(x) {
/*  natural ln(gamma(x)) without computing gamma(x)
    P.B. Stark

      JavaScript subroutine is based on a MATLAB program by C. Moler,
      in turn based on a FORTRAN program by W. J. Cody,
      Argonne National Laboratory, NETLIB/SPECFUN, June 16, 1988.

      References:

      1) W. J. Cody and K. E. Hillstrom, 'Chebyshev Approximations for
         the Natural Logarithm of the Gamma Function,' Math. Comp. 21,
         1967, pp. 198-203.

      2) K. E. Hillstrom, ANL/AMD Program ANLC366S, DGAMMA/DLGAMA, May,
         1969.

      3) Hart, Et. Al., Computer Approximations, Wiley and sons, New
         York, 1968.
*/

     var d1 = -5.772156649015328605195174e-1;
     var p1 = [4.945235359296727046734888e0, 2.018112620856775083915565e2,
           2.290838373831346393026739e3, 1.131967205903380828685045e4,
           2.855724635671635335736389e4, 3.848496228443793359990269e4,
           2.637748787624195437963534e4, 7.225813979700288197698961e3];
     var q1 = [6.748212550303777196073036e1, 1.113332393857199323513008e3,
           7.738757056935398733233834e3, 2.763987074403340708898585e4,
           5.499310206226157329794414e4, 6.161122180066002127833352e4,
           3.635127591501940507276287e4, 8.785536302431013170870835e3];
     var d2 = 4.227843350984671393993777e-1;
     var p2 = [4.974607845568932035012064e0, 5.424138599891070494101986e2,
           1.550693864978364947665077e4, 1.847932904445632425417223e5,
           1.088204769468828767498470e6, 3.338152967987029735917223e6,
           5.106661678927352456275255e6, 3.074109054850539556250927e6];
     var q2 = [1.830328399370592604055942e2, 7.765049321445005871323047e3,
           1.331903827966074194402448e5, 1.136705821321969608938755e6,
           5.267964117437946917577538e6, 1.346701454311101692290052e7,
           1.782736530353274213975932e7, 9.533095591844353613395747e6];
     var d4 = 1.791759469228055000094023e0;
     var p4 = [1.474502166059939948905062e4, 2.426813369486704502836312e6,
           1.214755574045093227939592e8, 2.663432449630976949898078e9,
           2.940378956634553899906876e10, 1.702665737765398868392998e11,
           4.926125793377430887588120e11, 5.606251856223951465078242e11];
     var q4 = [2.690530175870899333379843e3, 6.393885654300092398984238e5,
           4.135599930241388052042842e7, 1.120872109616147941376570e9,
           1.488613728678813811542398e10, 1.016803586272438228077304e11,
           3.417476345507377132798597e11, 4.463158187419713286462081e11];
     var c = [-1.910444077728e-03, 8.4171387781295e-04,
          -5.952379913043012e-04, 7.93650793500350248e-04,
          -2.777777777777681622553e-03, 8.333333333333333331554247e-02,
           5.7083835261e-03];

     var lng = Math.NaN;
     var mach = 1.e-12;
     var den = 1.0;
     var num = 0;
     var xm1, xm2, xm4;
     var i = 0;

   if (x < 0) {
       return(lng);
   } else if (x <= mach) {
       return(-Math.log(x));
   } else if (x <= 0.5) {
      for (i = 0; i < 8; i++) {
            num = num * x + p1[i];
            den = den * x + q1[i];
      }
      lng = -Math.log(x) + (x * (d1 + x * (num/den)));
   } else if (x <= 0.6796875) {
      xm1 = x - 1.0;
      for (i = 0; i < 8; i++) {
         num = num * xm1 + p2[i];
         den = den * xm1 + q2[i];
      }
      lng = -Math.log(x) + xm1 * (d2 + xm1*(num/den));
   } else if (x <= 1.5) {
      xm1 = x - 1.0;
      for (i = 0; i < 8; i++) {
         num = num*xm1 + p1[i];
         den = den*xm1 + q1[i];
      }
      lng = xm1 * (d1 + xm1*(num/den));
   } else if (x <= 4.0) {
      xm2 = x - 2.0;
      for (i = 0; i<8; i++) {
         num = num*xm2 + p2[i];
         den = den*xm2 + q2[i];
      }
      lng = xm2 * (d2 + xm2 * (num/den));
   } else if (x <= 12) {
      xm4 = x - 4.0;
      den = -1.0;
      for (i = 0; i < 8; i++)  {
         num = num * xm4 + p4[i];
         den = den * xm4 + q4[i];
      }
      lng = d4 + xm4 * (num/den);
   } else {
      var r = c[6];
      var xsq = x * x;
      for (i = 0; i < 6; i++) {
         r = r / xsq + c[i];
      }
      r = r / x;
      var lnx = Math.log(x);
      var spi = 0.9189385332046727417803297;
      lng = r + spi - 0.5*lnx + x*(lnx-1);
    }
    return(lng);
} // ends lnGamma


function normPdf( mu,  sigma, x) {
     return(Math.exp(-(x-mu)*(x-mu)/(2*sigma*sigma))/
            (Math.sqrt(2*Math.PI)*sigma));
} // ends normPdf


function tCdf(df, x) { // cdf of Student's t distribution with df degrees of freedom
    var ans;
    if (df < 1) {
        ans = Math.NaN;
    } else if (x === 0.0) {
        ans = 0.5;
    } else if (df == 1) {
        ans = 0.5 + Math.atan(x) / Math.PI;
    } else if (x > 0) {
        ans = 1 - (incBeta(df/(df+x*x), df/2.0, 0.5))/2;
    } else if (x < 0) {
        ans = incBeta(df/(df+x*x), df/2.0, 0.5)/2;
    }
    return(ans);
}

function tPdf(df, x) {
  var d = Math.floor(df);
  return(Math.exp(lnGamma((d+1)/2) - lnGamma(d/2))/
         ( Math.sqrt(d*Math.PI)*Math.pow((1+x*x/d),(d+1)/2)) );
}

function tInv(p, df ) { // inverse Student-t distribution with
                                              // df degrees of freedom
    var z;
    if (df < 0 || p < 0) {
        return(Math.NaN);
    } else if (p === 0.0) {
        return(Math.NEGATIVE_INFINITY);
    } else if (p == 1) {
        return(Math.POSITIVE_INFINITY);
    } else if (df == 1) {
        return(Math.tan(Math.PI*(p-0.5)));
    } else if ( p >= 0.5) {
        z = betaInv(2.0*(1-p),df/2.0,0.5);
        return(Math.sqrt(df/z - df));
    } else {
        z = betaInv(2.0*p,df/2.0,0.5);
        return(-Math.sqrt(df/z - df));
    }
}

function incBeta(x, a, b) { // incomplete beta function
       // I_x(z,w) = 1/beta(z,w) * integral from 0 to x of t^(z-1) * (1-t)^(w-1) dt
       // Ref: Abramowitz & Stegun, Handbook of Mathemtical Functions, sec. 26.5.
    var res;
    if (x < 0 || x > 1) {
        res = Math.NaN;
    } else {
        res = 0;
        var bt = Math.exp(lnGamma(a+b) - lnGamma(a) - lnGamma(b) +
                    a*Math.log(x) + b*Math.log(1-x));
        if (x < (a+1)/(a+b+2)) {
            res = bt * betaGuts(x, a, b) / a;
        } else {
            res = 1 - bt*betaGuts(1-x, b, a) / b;
        }
    }
    return(res);
}

function betaGuts( x, a, b) { // guts of the incomplete beta function
    var ap1 = a + 1;
    var am1 = a - 1;
    var apb = a + b;
    var am = 1;
    var bm = am;
    var y = am;
    var bz = 1 - apb*x/ap1;
    var d = 0;
    var app = d;
    var ap = d;
    var bpp = d;
    var bp = d;
    var yold = d;
    var m = 1;
    var t;
    while (y-yold > 4*eps*Math.abs(y)) {
       t = 2 * m;
       d = m * (b - m) * x / ((am1 + t) * (a + t));
       ap = y + d * am;
       bp = bz + d * bm;
       d = -(a + m) * (apb + m) * x / ((a + t) * (ap1 + t));
       app = ap + d * y;
       bpp = bp + d * bz;
       yold = y;
       am = ap / bpp;
       bm = bp / bpp;
       y = app / bpp;
       if (m == 1) bz = 1;
       m++;
    }
    return(y);
}

function chi2Cdf(df,  x) {
    var p =  (df == Math.floor(df)) ? gammaCdf(x,df/2,2) : Number.NaN;
    return(p);
}

function chi2Pdf(df, x) {
  if (x <= 0) {
    return(0.0);
  } else {
    return(gammaPdf(x, Math.floor(df)/2, 2));
  }
}

function chi2Inv( p, df ) { // kluge for chi-square quantile function.
    var guess = Math.NaN;
    if (p === 0.0) {
        guess = 0.0;
    } else if ( p == 1.0 ) {
        guess = Math.POSITIVE_INFINITY;
    } else if ( p < 0.0 ) {
        guess = Math.NaN;
    } else {
        var tolAbs = 1.0e-8;
        var tolRel = 1.0e-3;
        guess = Math.max(0.0, df + Math.sqrt(2*df)*normInv(p)); // guess from normal approx
        var currP = chi2Cdf( guess, df);
        var loP = currP;
        var hiP = currP;
        var guessLo = guess;
        var guessHi = guess;
        while (loP > p) { // step down
            guessLo = 0.8*guessLo;
            loP = chi2Cdf( guessLo, df);
        }
        while (hiP < p) { // step up
            guessHi = 1.2*guessHi;
            hiP = chi2Cdf( guessHi, df);
        }
        guess = (guessLo + guessHi)/2.0;
        currP = chi2Cdf( guess, df);
        while ( (Math.abs(currP - p) > tolAbs) || (Math.abs(currP - p)/p > tolRel) ) { // bisect
            if ( currP < p ) {
                guessLo = guess;
            } else {
                guessHi = guess;
            }
            guess = (guessLo + guessHi)/2.0;
            currP = chi2Cdf(guess, df);
        }
    }
    return(guess);
}

function gammaCdf( x,  a,  b) { // gamma distribution CDF.
    var p = Math.NaN;
    if (a <= 0 || b <= 0) {
    } else if (x <= 0) {
        p = 0.0;
    } else {
        p = Math.min(incGamma(x/b, a), 1.0);
    }
    return(p);
}

function incGamma( x,  a) {
    var inc = 0;
    var gam = lnGamma(a+rmin);
    if (x === 0.0) {
        inc = 0;
    } else if (a === 0) {
        inc = 1;
    } else if (x < a+1) {
        var ap = a;
        var sum = 1.0/ap;
        var del = sum;
        while (Math.abs(del) >= 10*eps*Math.abs(sum)) {
            del *= x/(++ap);
            sum += del;
        }
        inc = sum * Math.exp(-x + a*Math.log(x) - gam);
    } else if (x >= a+1) {
       var a0 = 1;
       var a1 = x;
       var b0 = 0;
       var b1 = 1;
       var fac = 1;
       var n = 1;
       var g = 1;
       var gold = 0;
       var ana;
       var anf;
       while (Math.abs(g-gold) >= 10*eps*Math.abs(g)) {
            gold = g;
            ana = n - a;
            a0 = (a1 + a0 *ana) * fac;
            b0 = (b1 + b0 *ana) * fac;
            anf = n*fac;
            a1 = x * a0 + anf * a1;
            b1 = x * b0 + anf * b1;
            fac = 1.0 / a1;
            g = b1 * fac;
            n++;
       }
       inc = 1 - Math.exp(-x + a*Math.log(x) - gam) * g;
    }
    return(inc);
}

function poissonPmf( lambda, k) {  // Poisson probability mass function
    var p = 0.0;
    if (k != Math.floor(k)) {
      p = Number.NaN;
    } else {
        if (k >= 0) {
           p = Math.exp(-lambda)*Math.pow(lambda,k)/factorial(k);
        }
    }
    return(p);
}

function poissonCdf( lambda, k) {  // Poisson CDF
    var p = 0;
    var b = 0;
    var m = 0;
    if (k != Math.floor(k)) {
        p = Number.NaN;
    } else {
        while (m <= k) {
           b += Math.pow(lambda, m++)/factorial(k);
        }
        p += Math.exp(-lambda)*b;
    }
    return(p);
}

function poissonTail(lambda, k) {  // upper tail probability of the Poisson
    return(1.0-poissonCdf(lambda, k-1));
}

function expCdf(lambda, x) {   // exponential CDF
        return(1-Math.exp(-x/lambda));
    }

function expPdf(lambda, x) {  // exponential density
        return((1.0/lambda)*Math.exp(-x/lambda));
}


function factorial(n) { // computes n!
  var fac = Number.NaN;
    if (n != Math.floor(n)) {
      fac = Number.NaN;
    } else {
      fac=1;
      for (var i=n; i > 1; i--) {
        fac *= i;
      }
    }
    return(Math.round(fac));
}

function binomialCoef(n,k) { // computes n choose k
    if (n != Math.floor(n) || k != Math.floor(k)) {
        return(Number.NaN);
    } else if (n < k || n < 0) {
        return(0.0);
    } else if ( k === 0 || n === 0 || n == k) {
        return(1.0);
    } else {
        var minnk = Math.min(k, n-k);
        var coef = 1;
        for (var j = 0; j < minnk; j++) {
            coef *= (n-j)/(minnk-j);
        }
        return(Math.round(coef));
    }
}

function binomialPmf(n, p, k) {  // binomial pmf at k.
    var pmf = binomialCoef(n,k)*Math.pow(p,k)*Math.pow((1-p),(n-k));
    return(pmf);
}

function binomialCdf(n, p, k) {  // binomial CDF:  Pr(X <= k), X~B(n,p)
    if (k < 0) {
        return(0.0);
    } else if (k >= n) {
        return(1.0);
    } else {
        var cdf = 0.0;
        for (var i = 0; i <= k; i++) {
            cdf += binomialPmf(n, p, i);
        }
        return(cdf);
    }
}

function binomialTail(n,p,k) { // binomial tail probability Pr(X >= k), X~B(n,p)
    if (k < 0) {
        return(1.0);
    } else if (k >= n) {
        return(0.0);
    } else {
        var tailP = 0.0;
        for (var i = k; i <= n; i++) {
            tailP += binomialPmf(n, p, i);
        }
        return(tailP);
    }
}

function binomialInv(n, p, pt) { // binomial percentile function
    var t = 0;
    if (pt < 0 || pt > 1) {
        t = NaN;
    } else if (pt === 0.0) {
        t = 0;
    } else if (pt == 1.0) {
        t = n;
    } else {
        t = 0;
        var pc = 0.0;
        while ( pc < pt ) {
            pc += binomialPmf(n, p, t++);
        }
        t -= 1;
    }
    return(t);
}

function binomialLowerCL(n, x, cl, inc) {
    p = x/n;
    if (x > 0) {
        f = binomialTail(n, p, x-1);
        while (f >= 1-cl) {
            p = p - inc;
            f = binomialTail(n, p, x-1);
        }
    } else {
        p = 0;
    }
    return(p);
}

function multinomialCoef(list, n) { // multinomial coefficient.
// WARNING:  not very stable algorithm; avoid for large n.
    var val = 0;
    var lmn = vMinMax(list);
    if (typeof(n) == 'undefined' || n === null) {
        n = vSum(list);
    }
    if (lmn[0] < 0.0) {
        alert('Error #1 in irGrade.multinomialCoef: a number of outcomes is negative!');
    } else if (n == vSum(list)) {
        val = factorial(n);
        for (var i=0; i < list.length; i++) {
            val /= factorial(list[i]);
        }
    }
    return(val);
}

function multinomialPmf(olist, plist, n) { // multinomial pmf; not stable algorithm
    var val = 0.0;
    var pmn = vMinMax(plist);
    var omn = vMinMax(olist);
    if (typeof(n) == 'undefined' || n === null) {
        n = vSum(olist);
    }
    if (olist.length != plist.length) {
        alert('Error #1 in irGrade.multinomialPmf: length of outcome and probability vectors ' +
               'do not match!');
    } else if (pmn[0] < 0.0) {
        alert('Error #2 in irGrade.multinomialPmf: a probability is negative!');
    } else if (omn[0] < 0.0) {
        alert('Error #3 in irGrade.multinomialPmf: a number of outcomes is negative!');
    } else if (n == vSum(olist)) {
        var pl = vMult(1.0/vSum(plist), plist);  // just in case
        val = factorial(n);
        for (var i=0; i< olist.length; i++) {
            val *= Math.pow(pl[i], olist[i])/factorial(olist[i]);
        }
    }
    return(val);
}


function geoPmf( p,  k) {
  // chance it takes k trials to the first success in iid Bernoulli(p) trials
  // EX = 1/p; SD(X) = sqrt(1-p)/p
    var prob = 0.0;
    if (k != Math.floor(k)) {
        prob = Number.NaN;
    } else if (k < 1 || p === 0.0) {
        prob = 0.0;
    } else {
        prob = Math.pow((1-p),k-1)*p;
    }
    return(prob);
}

function geoCdf( p, k) {
  // chance it takes k or fewer trials to the first success in iid Bernoulli(p) trials
    var prob = 0.0;
    if (k != Math.floor(k)) {
        prob = Number.NaN;
    } else if (k < 1 || p === 0.0) {
        prob = 0.0;
    } else {
        prob = 1-Math.pow( 1-p, k);
    }
    return(prob);
}

function geoTail( p,  k) {
  // chance of k or more trials to the first success in iid Bernoulli(p) trials
    return(1 - geoCdf(p, k-1));
}

function geoInv(p, pt) { // geometric percentile function
    var t = 0;
    if (pt < 0 || pt > 1) {
        t = Math.NaN;
    } else if (pt === 0.0) {
        t = 0;
    } else if (pt == 1.0) {
        t = Math.POSITIVE_INFINITY;
    } else {
        t = 0;
        var pc = 0.0;
        while ( pc < pt ) {
            pc += geoPmf(p, t++);
        }
    }
    return(t);
}

function hyperGeoPmf( N,  M,  n,  m) {
  // chance of drawing m of M objects in a sample of size n from
  // N objects in all.  p = (M C m)*(N-M C n-m)/(N C n)
  // EX = n*M/N; SD(X)= sqrt((N-n)/(N-1))*sqrt(np(1-p));
    var p = 0.0;
    if (N != Math.floor(N) || M != Math.floor(M) || n != Math.floor(n) || m != Math.floor(m)) {
        p = Number.NaN;
    } else if ( n < m || N < M || M < m  || m < 0 || N < 0) {
        p = 0.0;
    } else {
        p = binomialCoef(M,m)*binomialCoef(N-M,n-m)/binomialCoef(N,n);
    }
    return(p);
}

function hyperGeoCdf( N,  M,  n,  m) {
  // chance of drawing m or fewer of M objects in a sample of size n from
  // N objects in all
    var p=0.0;
    if (N != Math.floor(N) || M != Math.floor(M) || n != Math.floor(n) || m != Math.floor(m)) {
        p = Number.NaN;
    } else {
        var mMax = Math.min(m,M);
        mMax = Math.min(mMax,n);
        for (var i = 0; i <= mMax; i++) {
            p += hyperGeoPmf(N, M, n, i);
        }
    }
    return(p);
}

function hyperGeoTail( N,  M,  n,  m) {
  // chance of drawing m or more of M objects in a sample of size n from
  // N objects in all
    var p=0.0;
    if (N != Math.floor(N) || M != Math.floor(M) || n != Math.floor(n) || m != Math.floor(m)) {
        p = Number.NaN;
    } else {
        for (var i = m; i <= Math.min(M,n); i++) {
            p += hyperGeoPmf(N, M, n, i);
        }
    }
    return(p);
}

function negBinomialPmf( p,  s,  t) {
  // chance that the sth success in iid Bernoulli trials is on the tth trial
  // EX = s/p; SD(X) = sqrt(s(1-p))/p
    var prob = 0.0;
    if (s != Math.floor(s) || t != Math.floor(t)) {
        prob = Number.NaN;
    } else if (s > t || s < 0) {
        prob = 0.0;
    } else {
        prob = p*binomialPmf(t-1,p,s-1);
    }
    return(prob);
}

function negBinomialCdf( p,  s,  t) {
  // chance the sth success in iid Bernoulli trials is on or before the tth trial
    var prob = 0.0;
    if (s != Math.floor(s) || t != Math.floor(t)) {
         prob = Number.NaN;
    } else {
         for (var i = s; i <= t; i++) {
             prob += negBinomialPmf(p, s, i);
         }
    }
    return(prob);
}

function pDieRolls(rolls,spots) { // chance that the sum of 'rolls' rolls of a die = 'spots'
    if (rolls > 4) {
        alert('Error #1 in irGrade.pDiceRolls: too many rolls ' + rolls + '. ');
        return(Math.NaN);
    } else {  // BRUTE FORCE!
        var found = 0;
        if (spots < rolls || spots > 6*rolls) {return(0.0);}
        var possible = Math.pow(6,rolls);
        var i = 0;
        var j = 0;
        var k = 0;
        if (rolls == 1) {
            return(1/possible);
        } else if (rolls == 2) {
            for (i=1; i <=6; i++ ) {
                for (j=1; j <= 6; j++ ) {
                    if (i+j == spots ) {found++;}
                }
            }
        } else if (rolls == 3 ) {
            for (i=1; i <=6; i++ ) {
                for (j=1; j<=6; j++ ) {
                    for (k=1; k<=6; k++ ) {
                        if (i+j+k == spots ) {found++;}
                    }
                }
            }
        } else if (rolls == 4 ) {
            for (i=1; i <=6; i++ ) {
                for (j=1; j<=6; j++ ) {
                    for (k=1; k<=6; k++ ) {
                        for (var m=1; m <=6; m++ ) {
                            if (i+j+k+m == spots ) {found++;}
                        }
                    }
                }
            }
        }
        return(found/possible);
    }
    return(false);
}

function permutations(n,k) { // number of permutations of k of n things
    var coef;
    if ((Math.floor(n) != n ) || (Math.floor(k) != k)) {
        coef = Number.NaN;
    } else if (n < k || n < 0) {
        coef = 0;
    } else if ( k===0 || n === 0) {
        coef = 1;
    } else {
        coef=1;
        for (var j=0; j < k; j++) coef *= (n-j);
    }
    return(Math.round(coef));
}


function sgn(x) {  // signum function
    if (x >= 0) {
        return(1);
    } else if (x < 0) {
        return (-1);
    }
}

function linspace(lo,hi,n) { // n linearly spaced points between lo and hi
    var spaced = new Array(n);
    var dx =(hi-lo)/(n-1);
    for (var i=0; i < n; i++) {
        spaced[i] = lo + i*dx;
    }
    return(spaced);
}

function rms(list) { // rms
    var r = 0;
    for (var i=0; i < list.length; i++) r += list[i]*list[i];
    r /= list.length;
    return(Math.sqrt(r));
}

function vMinMax(list){ // returns min and max of list
    var mn = list[0];
    var mx = list[0];
    for (var i=1; i < list.length; i++) {
        if (mn > list[i]) mn = list[i];
        if (mx < list[i]) mx = list[i];
    }
    var vmnmx =  new Array(mn,mx);
    return(vmnmx);
}

function vMinMaxIndices(list){ // returns min, max, index of min, index of max
    var mn = list[0];
    var indMn = 0;
    var mx = list[0];
    var indMx = 0;
    for (var i=1; i < list.length; i++) {
        if (mn > list[i]) {
            mn = list[i];
            indMn = i;
        }
        if (mx < list[i]) {
            mx = list[i];
            indMx = i;
        }
    }
    var vmnmx =  new Array(mn,mx,indMn,indMx);
    return(vmnmx);
}

function vMinMaxAbs(list) {
// returns min and max of absolute values of a list's elements
    var mn = Math.abs(list[0]);
    var mx = Math.abs(list[0]);
    var val;
    for (var i=1; i < list.length; i++) {
        val = Math.abs(list[i]);
            if (mn > val) mn = val;
            if (mx < val) mx = val;
    }
    var vmnmx =  new Array(mn,mx);
    return(vmnmx);
}

function randBoolean(p){ // random boolean value, prob p that it is true
    if (typeof(p) == 'undefined' || p === null) {
        p = 0.5;
    }
    if (rand.next() <= p) {
        return(false);
    } else {
        return(true);
    }
}

function sortUnique(list,order) { // sort a list, remove duplicate entries
    var temp = list;
    if (typeof(order) != 'undefined' && order !== null) {
        temp.sort(order);
    } else {
        temp.sort();
    }
    var temp2 = [];
    temp2[0] = temp[0];
    var ix = 0;
    for (var i=1; i < temp.length; i++) {
        if (temp[i] != temp2[ix] ) {
            temp2[++ix] = temp[i];
        }
    }
    return(temp2);
}

function uniqueCount(list) { // unique elements and their counts
    var temp = {};
    temp[list[0]] = list[0];
    var j = 0;
    for (j=1; j < list.length; j++) {
        if (typeof(temp[list[j]]) == 'undefined' || temp[list[j]] === null) {
             temp[list[j]] = 1;
        } else {
             temp[list[j]]++;
        }
    }
    uc = new Array(2);
    uc[0] = [];
    uc[1] = [];
    var k = 0;
    for (j in temp) {
        uc[0][k] = j;
        uc[1][k++] = temp[j];
    }
    return(uc);
}

function unique(list) {
    return(uniqueCount(list)[0]);
}

function randPermutation(list,index) { // returns a random permutation of list
    var randIndex = listOfDistinctRandInts(list.length,0,list.length-1);
    var thePermutation = new Array(list.length);
    var i = 0;
    for (i=0; i < list.length; i++) {
        thePermutation[i] = list[randIndex[i]];
    }
    var p = 0;
    if (typeof(index) != 'undefined' && index == 'forward') { // original indices
        p = new Array(2);
        p[0] = thePermutation;
        p[1] = randIndex;
        thePermutation = p;
    } else if (typeof(index) != 'undefined' && index == 'inverse') { // inverse permutation
        p = new Array(2);
        p[0] = thePermutation;
        p[1] = new Array(list.length);
        for (i=0; i < list.length; i++) {
            p[1][randIndex[i]] = i;
        }
        thePermutation = p;
    }
    return(thePermutation);
}


function cyclicPermutation(n, k) { // cyclic permutation by k of of the integers 0 to n-1
    if (typeof(k) == 'undefined' || k === null) {
        k = 1;
    }
    var perm = new Array(n);
    for (var i = 0; i < n; i++) {
            perm[i] = (i+k)%n;
    }
    return(perm);
}

function distinctPermutation(n, k) { // returns a permutation of the integers 0 to n-1
                                     // in which no index maps to itself
    if (typeof(k) == 'undefined' || k === null) {
            k = Math.min(3, n-1);
    }
    return(cyclicPermutation(n,k));
}

function distinctRandPermutation(n) { // returns a random permutation of the integers 0 to n-1
                                        // in which no index maps to itself
    function isInPlace(x) {  // is any index in its original place?
        v = false;
        for (var i=0; i < x.length; i++) {
           if (x[i] == i) {
              v = true;
           }
        }
        return(v);
    }
    var x = new Array(n);
    for (var i = 0; i < n; i++) {
        x[i] = i;
    }
    x = randPermutation(x);
    while (isInPlace(x)) {
       x = randPermutation(x);
    }
    return(x);
}




function fakeBivariateData(nPoints, funArray, heteroFac, snr, loEnd, hiEnd) {
   // returns a 2-d array of synthetic data generated from a polynomial,
   // according to the contents of funArray.
   // if funArray[0] == 'polynomial', uses the other elements of funArray as
   // the coefficients of a polynomial.
   // funArray[1] + funArray[2]*X + funArray[3]*X^2 + ...
   // 1/3 of the points have noise level heteroFac times larger than the rest.
   // Normalizes the errors  to signal/noise ratio snr  in 2-norm
    var data = new Array(2);
    data[0] = new Array(nPoints);
    data[1] = new Array(nPoints);
    if (snr === 0) {
            snr = 2;
    }
    var x;
    var fVal;
    var xPow;
    var i;
    if (funArray[0] == 'polynomial') {
        if (typeof(loEnd) == 'undefined' || loEnd === null) {   // lower limit of X variable
            loEnd = -10;
        }
        if (typeof(hiEnd) == 'undefined' || hiEnd === null) {   // upper limit of X variable
            hiEnd = 10;
        }
        var dX = (hiEnd - loEnd)/(nPoints - 1);
        for (i=0; i < nPoints; i++) {
            x = loEnd + i*dX;
            data[0][i] = x;
            fVal = 0.0;
            xPow = 1.0;
            for (var j=1;  j < funArray.length; j++) {
                fVal +=  xPow*funArray[j];
                xPow *= x;
            }
            data[1][i] = fVal;
        }
    } else {
        alert('Error #1 in irGrade.fakeBivariateData()!\n' +
            'Unsupported function type: ' + funArray[0].toString());
        return(null);
    }
// now add noise.
    var sigNorm = twoNorm(data[1]);
    var noise = new Array(nPoints);
    for (i=0; i < nPoints; i++) {
        noise[i] = rNorm();
    }
// pick a random set to perturb for heteroscedastic noise
    var segLen = Math.floor(nPoints/3);
    var startPt = Math.floor(2*nPoints/3*rand.next());
    for (i=startPt; i < startPt+segLen; i++) {
        noise[i] = noise[i]*heteroFac;
    }
    var noiseNorm = twoNorm(noise);
    for (i=0; i < nPoints; i++) {
        data[1][i] += noise[i]*sigNorm/noiseNorm/snr;
    }
    return(data);
}

function nextRand() {  // generates next random number in a sequence
    var up   = this.seed / this.Q;
    var lo   = this.seed % this.Q;
    var trial = this.A * lo - this.R * up;
    if (trial > 0) {
        this.seed = trial;
    } else {
        this.seed = trial + this.M;
    }
    return (this.seed * this.oneOverM);
}

function rng(s) {
       if ( typeof(s)=='undefined' || s === null ){
           var d = new Date();
           this.seed = 2345678901 +
             (d.getSeconds() * 0xFFFFFF) +
             (d.getMinutes() * 0xFFFF);
       } else {
           this.seed = s;
       }
       this.A = 48271;
       this.M = 2147483647;
       this.Q = this.M / this.A;
       this.R = this.M % this.A;
       this.oneOverM = 1.0 / this.M;
       this.next = nextRand;
       this.getSeed = getRandSeed;
       return(this);
}

// Only define rand if it has not already been defined - the page may want to
// define a rand using a custom seed. It can do this before the page loads
// if it wants.
jQuery(function() {
  if (typeof(rand) == 'undefined') {
    console.log('rand has not been defined already, creating in stat_utils');
    rand = rng();
  } else {
    console.log('Skipping creation of rand because it already exists.');
  }
});

function getRandSeed() { // get seed of random number generator
    return(this.seed);
}

function crypt(s,t) {
    var slen = s.length;
    var tlen = t.length;
    var rad = 16;
    var r = 0;
    var i;
    var j = -1;
    var result = '';
    if (s.substr(0,2) == '0x') {
        for (i=2; i < slen; i+=2) {
            if (++j >= tlen) {j = 0;}
            r = parseInt(s.substr(i,2),rad) ^ t.charCodeAt(j);
            result += String.fromCharCode(r);
        }
    } else {
        result +='0x';
        for ( i=0; i < slen; i++) {
           if (++j >= tlen) {j = 0;}
           r = s.charCodeAt(i) ^ t.charCodeAt(j);
           result += (r < rad ? '0' : '') + r.toString(rad);
        }
    }
    return(result);
}



/*
This file contains two functions:
    statCalc: a simple calculator
    distCalc: a calculator probability distributions

copyright (c) 2013 by P.B. Stark
last modified 27 January 2013.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
    See the GNU Affero Public License for more details.
    http://www.gnu.org/licenses/

Dependencies: irGrade, jQuery, jQuery-ui

*/

function statCalc(container_id, params) {
    var self = this;
    this.container = $('#' + container_id);

    if (!params instanceof Object) {
       console.error('statCalc parameters should be an object');
       return;
    }

// default options
    this.options = {
                    keys: [ [["7","num"],["8","num"],["9","num"],["/","bin"], ["nCk","bin"]],
                            [["4","num"],["5","num"],["6","num"],["*","bin"], ["nPk","bin"]],
                            [["1","num"],["2","num"],["3","num"],["-","bin"], ["!","una"]],
                            [["0","num"],[".","num"],["+/-","una"],["+","bin"], ["1/x","una"]],
                            [["=","eq"],  ["CE","una"],  ["C","una"], ["Sqrt","una"], ["x^2","una"]]
                          ],
                    buttonsPerRow: 5,
/*      Full set of keys:
                    keys: [ [["7","num"],["8","num"],["9","num"],["/","bin"], ["nCk","bin"], ["nPk","bin"]],
                            [["4","num"],["5","num"],["6","num"],["*","bin"], ["!","una"], ["U[0,1]","una"]],
                            [["1","num"],["2","num"],["3","num"],["-","bin"], ["Sqrt","una"], ["x^2","una"]],
                            [["0","num"],[".","num"],["+/-","una"],["+","bin"], ["1/x","una"], ["x^y","bin"]],
                            [["=","eq"],  ["CE","una"],  ["C","una"], ["exp(x)","una"], ["log(x)","una"],  ["log_y(x)", "bin"]]
                          ],
                    buttonsPerRow: 6
*/
                    digits: 16
    };

// Extend options
    $.extend(this.options, params);

    self.x = 0.0;
    self.inProgress = false;
    self.currentOp = null;

    function initCalc() {
        var me = $('<div />').addClass('calc');
        self.container.append(me);
        // display
        self.theDisplay = $('<input type="text" />').attr('size',self.options.digits);
        me.append(self.theDisplay);
        // buttons
        self.buttonDiv = $('<div />').addClass('buttonDiv');
        self.numButtonDiv = $('<div />').addClass('numButtonDiv');
        self.fnButtonDiv = $('<div />').addClass('fnButtonDiv');
        self.numButtonTable = $('<table />').addClass('numButtonTable');
        self.fnButtonTable = $('<table />').addClass('fnButtonTable');
        self.numButtonDiv.append(self.numButtonTable);
        self.fnButtonDiv.append(self.fnButtonTable);
        self.buttonDiv.append(self.numButtonDiv);
        self.buttonDiv.append(self.fnButtonDiv);
        $.each(self.options.keys, function(j, rowKeys) {
          var row = $('<tr>');
          self.numButtonTable.append(row);
          $.each(rowKeys, function(i, v) {
            if (null === v) {
              row.append($('<td/>'));
              return;
            }
            newBut = $('<input type="button" value="' + v[0] + '">')
              .button()
              .addClass(v[1])
              .addClass('calcButton')
              .click( function(e) {
                e.preventDefault();
                buttonClick(v[0], v[1]);
              });
            row.append($('<td/>').append(newBut));
          });
        });
        me.append(self.buttonDiv);
    }
    initCalc();

//  action functions

    function buttonClick(v, opType) {
        var t = self.theDisplay.val().replace(/[^0-9e.\-]+/gi,'').replace(/^0+/,'');
        try {
            switch(opType) {
               case 'num':
                   self.theDisplay.val(t+v);
                   break;

               case 'una':
                   switch(v) {
                      case '+/-':
                         t = (t.indexOf('-') === 0) ? t.substring(1) : '-'+t;
                         self.theDisplay.val(t);
                         break;
                      case '!':
                         self.theDisplay.val(factorial(t).toString());
                         break;
                      case 'Sqrt':
                         self.theDisplay.val(Math.sqrt(t).toString());
                         break;
                      case 'x^2':
                         self.theDisplay.val((t*t).toString());
                         break;
                      case 'exp(x)':
                         self.theDisplay.val(Math.exp(t).toString());
                         break;
                      case 'ln(x)':
                         self.theDisplay.val(Math.log(t).toString());
                         break;
                      case '1/x':
                         self.theDisplay.val((1/t).toString());
                         break;
                      case 'U[0,1]':
                         self.theDisplay.val(rand.next());
                         break;
                      case 'N(0,1)':
                         self.theDisplay.val(rNorm());
                         break;
                      case 'CE':
                         self.theDisplay.val('0');
                         break;
                      case 'C':
                         self.x = 0;
                         self.inProgress = false;
                         self.currentOp = null;
                         self.theDisplay.val('0');
                    }
                    break;

               case 'bin':
                   if (self.inProgress) {
                        self.x = doBinaryOp(self.x, self.currentOp, t);
                        self.theDisplay.val(self.x.toString());
                   } else {
                        self.x = t;
                        self.theDisplay.val('?');
                        self.inProgress = true;
                   }
                   self.currentOp = v;
                   break;

               case 'eq':
                   if (self.inProgress) {
                        self.x = doBinaryOp(self.x, self.currentOp, t);
                        self.theDisplay.val(self.x.toString());
                        self.inProgress = false;
                        self.currentOp = null;
                   }
                   break;

               default:
                   console.log('unexpected button in statCalc ' + v);
            }
        } catch(e) {
           console.log(e);
           self.theDisplay.val('NaN');
        }
    }

    function doBinaryOp(x, op, y) {
         var res = Math.NaN;
         try {
             switch(op) {
                 case '+':
                     res = parseFloat(x)+parseFloat(y);
                     break;
                 case '-':
                     res = parseFloat(x)-parseFloat(y);
                     break;
                 case '*':
                     res = parseFloat(x)*parseFloat(y);
                     break;
                 case '/':
                     res = parseFloat(x)/parseFloat(y);
                     break;
                 case 'x^y':
                     res = parseFloat(x)^parseFloat(y);
                     break;
                 case 'nCk':
                     res = binomialCoef(parseFloat(x), parseFloat(y));
                     break;
                 case 'nPk':
                     res = permutations(parseFloat(x), parseFloat(y));
                     break;
                 default:
                     console.log('unexpected binary function in statCalc ' + op);
              }
        } catch(e) {
        }
        return(res);
    }




}

function distCalc(container_id, params) {
    var self = this;
    this.container = $('#' + container_id);

    if (!params instanceof Object) {
       console.error('distCalc parameters should be an object');
       return;
    }

// default options
    this.options = {
                    distributions: [ ["Binomial", ["n","p"]],
                                     ["Geometric", ["p"]],
                                     ["Negative Binomial", ["p","r"]],
                                     ["Hypergeometric",["N","G","n"]],
                                     ["Normal", ["mean","SD"]],
                                     ["Student t", ["degrees of freedom"]],
                                     ["Chi-square", ["degrees of freedom"]],
                                     ["Exponential", ["mean"]],
                                     ["Poisson", ["mean"]]
                                   ],
                    digits: 8,
                    paramDigits: 4,
                    showExpect: true
    };

// Extend options
    $.extend(this.options, params);

    self.lo = 0.0;
    self.hi = 0.0;
    self.currDist = null;
    self.distDivs = [];

    function init() {
        var me = $('<div />').addClass('distCalc');
        self.container.append(me);

        // distribution selection
        self.selectDiv = $('<div />').addClass('selectDiv').append('If X has a ');
        self.selectDist = $('<select />').change(function() {
              changeDist($(this).val());
        });

        // parameters of the distributions
        $.each(self.options.distributions, function(i, v) {
               $('<option/>', { value : v[0] }).text(v[0]).appendTo(self.selectDist);
               self.distDivs[v[0]] = $('<div />').css('display','inline');
               $.each(v[1], function(j, parm) {
                     self.distDivs[v[0]].append(parm + ' = ')
                                        .append(  $('<input type="text" />')
                                                    .attr('size','paramDigits')
                                                    .addClass(parm.replace(/ +/g,'_'))
                                                    .blur(calcProb)
                                        )
                                        .append(', ');
               });
        });

        self.paramSpan = $('<span />').addClass('paramSpan');
        self.selectDiv.append(self.selectDist)
                      .append('distribution with ')
                      .append(self.paramSpan);

        // start with the first listed distribution
        self.currDist = self.options.distributions[0][0];
        self.paramSpan.append(self.distDivs[self.currDist]);

        // range over which to find the probability
        self.selectDiv.append(' the chance that ')
                      .append($('<input type="checkbox">').addClass('useLower').click(calcProb))
                      .append('X &ge;')
                      .append($('<input type="text" />').addClass('loLim').attr('size',self.options.digits).val("0").blur(calcProb))
                      .append($('<input type="checkbox">').addClass('useUpper').click(calcProb))
                      .append('and X &le;')
                      .append($('<input type="text" />').addClass('hiLim').attr('size',self.options.digits).val("0").blur(calcProb))
                      .append(' is ');

        // display
        self.theDisplay = $('<input type="text" readonly />').attr('size',self.options.digits+4);
        self.expectSpan = $('<span />').addClass('expectSpan');
        self.selectDiv.append(self.theDisplay).append(self.expectSpan);
        me.append(self.selectDiv);
    }
    init();

//  action functions

    function changeDist(dist) {
        self.currDist = dist;
        self.paramSpan.empty();
        self.expectSpan.empty();
        var thisDist = $.grep(self.options.distributions, function(v,i) {
                          return(v[0] === dist);
        });
        self.paramSpan.append(self.distDivs[thisDist[0][0]]);  // replace with parameters for current distribution
        self.theDisplay.val('NaN');
        calcProb();
    }

    function calcProb(e) {
        if (typeof(e) != 'undefined' && e instanceof jQuery.Event)
          e.preventDefault();
        var prob  = Number.NaN;

        // get range over which to compute the probability
        var loCk  = self.selectDiv.find('.useLower').prop('checked');
        var loLim = loCk ? parseFloat(self.selectDiv.find('.loLim').val()) : Number.NaN;
        var hiCk  = self.selectDiv.find('.useUpper').prop('checked');
        var hiLim = hiCk ? parseFloat(self.selectDiv.find('.hiLim').val()) : Number.NaN;

        var allParamsDefined = true;
        $.each(self.distDivs[self.currDist].find(':input'), function(i, v) {
               if (v.value.trim().length === 0) {
                   allParamsDefined = false;
               }
        });

        if ((!loCk && !hiCk) || !allParamsDefined) {
              prob = Number.NaN;
        } else if (loCk && hiCk && (loLim > hiLim)) {
              prob = 0.0;
        } else {
              self.expectSpan.empty();
              var n;
              var p;
              var t;
              var b;
              var df;
              var m;
              switch(self.currDist) {
                   case "Binomial":
                      n = parseFloat(self.distDivs[self.currDist].find('.n').val());
                      p = parsePercent(self.distDivs[self.currDist].find('.p').val());
                      t = hiCk ? binomialCdf(n, p, hiLim) : 1.0;
                      b = loCk ? binomialCdf(n, p, loLim-1) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                          self.expectSpan.append('E(X) = ' + (n*p).toFixed(self.options.paramDigits) +
                                                 '; SE(X) = ' + Math.sqrt(n*p*(1-p)).toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Geometric":
                      p = parsePercent(self.distDivs[self.currDist].find('.p').val());
                      t = hiCk ? geoCdf(p, hiLim) : 1.0;
                      b = loCk ? geoCdf(p, loLim-1) : 0.0;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + (1/p).toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + (Math.sqrt(1-p)/p).toFixed(self.options.paramDigits));
                      }
                      prob = t - b;
                      break;

                   case "Negative Binomial":
                      p = parsePercent(self.distDivs[self.currDist].find('.p').val());
                      r = parseFloat(self.distDivs[self.currDist].find('.r').val());
                      t = hiCk ? negBinomialCdf( p,  r, hiLim) : 1.0;
                      b = loCk ? negBinomialCdf( p,  r, loLim-1) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                          self.expectSpan.append('E(X) = ' + (r/p).toFixed(self.options.paramDigits) +
                                                 '; SE(X) = ' + (Math.sqrt(r*(1-p))/p).toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Hypergeometric":
                      var N = parseFloat(self.distDivs[self.currDist].find('.N').val());
                      var G = parseFloat(self.distDivs[self.currDist].find('.G').val());
                      n = parseFloat(self.distDivs[self.currDist].find('.n').val());
                      t = hiCk ? hyperGeoCdf(N,  G, n, hiLim) : 1.0;
                      b = loCk ? hyperGeoCdf(N,  G, n, loLim-1) : 0.0;
                      prob = t - b;
                      var hyP = G/N;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + (n*hyP).toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + (Math.sqrt(n*hyP*(1-hyP)*(N-n)/(N-1))).toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Normal":
                      m = parseFloat(self.distDivs[self.currDist].find('.mean').val());
                      var s = parseFloat(self.distDivs[self.currDist].find('.SD').val());
                      t = hiCk ? normCdf((hiLim-m)/s) : 1.0;
                      b = loCk ? normCdf((loLim-m)/s) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + m.toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + s.toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Student t":
                      df = parseFloat(self.distDivs[self.currDist].find('.degrees_of_freedom').val());
                      t = hiCk ? tCdf(df, hiLim) : 1.0;
                      b = loCk ? tCdf(df, loLim) : 0.0;
                      prob = t - b;
                      var se = (df > 2) ? (Math.sqrt(df/(df-2))).toFixed(self.options.paramDigits) : Number.NaN;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = 0; SE(X) = ' + se);
                      }
                      break;

                   case "Chi-square":
                      df = parseFloat(self.distDivs[self.currDist].find('.degrees_of_freedom').val());
                      t = hiCk ? chi2Cdf(df, hiLim) : 1.0;
                      b = loCk ? chi2Cdf(df, loLim) : 0.0;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + df.toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + (Math.sqrt(2*df)).toFixed(self.options.paramDigits));
                      }
                      prob = t - b;
                      break;

                   case "Exponential":
                      m = parseFloat(self.distDivs[self.currDist].find('.mean').val());
                      t = hiCk ? expCdf(m, hiLim) : 1.0;
                      b = loCk ? expCdf(m, loLim) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + m.toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + m.toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Poisson":
                      m = parseFloat(self.distDivs[self.currDist].find('.mean').val());
                      t = hiCk ? poissonCdf(m, hiLim) : 1.0;
                      b = loCk ? poissonCdf(m, loLim) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + m.toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + (Math.sqrt(m)).toFixed(self.options.paramDigits));
                      }
                      break;

                   default:
                      console.log('unexpected distribution in distCalc.calcProb ' + dist);
              }
        }
        self.theDisplay.val((100*prob).toFixed(self.options.digits-3)+'%');
    }

}

// Javascript implementation of venn diagram for sticigui. No params are
// currently available.
function Stici_Venn(container_id, params) {
  var self = this;

  this.env = jQuery('#' + container_id);
  var app = jQuery('<div/>',{id:container_id + 'app'})
              .addClass('stici_venn')
              .addClass('stici');
  this.env.append(app);

  this.container = jQuery('<div/>',{id:container_id + 'container'}).addClass('container');
  this.container.css('width',(this.env.width() - 160) + 'px');
  this.container.css('height', (this.env.height() - 60) + 'px');
  var buttons = jQuery('<div/>',{id:container_id + 'buttons'}).addClass('buttons');
  var scrollbars = jQuery('<div/>',{id:container_id + 'scrollbars'}).addClass('scrollbars');

  app.append(self.container);
  app.append(buttons);
  app.append(scrollbars);

  var s_outline, a_outline, b_outline;
  var a_fill, b_fill, ab_fill;
  var ab_text, a_or_b_text;

  var button_args = [
    ['A', function () {
      a_fill.addClass('selected');
    }],

    ['A<sup>c</sup>', function () {
      s_outline.addClass('selected');
      a_fill.addClass('opaque');
    }],

    ['B', function () {
      b_fill.addClass('selected');
    }],

    ['B<sup>c</sup>', function () {
      s_outline.addClass('selected');
      b_fill.addClass('opaque');
    }],

    ['A or B', function () {
      a_fill.addClass('selected');
      b_fill.addClass('selected');
    }],

    ['AB', function () {
      ab_fill.addClass('selected');
    }],

    ['AB<sup>c</sup>', function () {
      a_fill.addClass('selected');
      ab_fill.addClass('opaque');
    }],

    ['A<sup>c</sup>B', function () {
      b_fill.addClass('selected');
      ab_fill.addClass('opaque');
    }],

    ['S', function () {
      s_outline.addClass('selected');
    }],

    ['{}', function () {
    }]
  ];
  $.each(button_args, function(i, button_arg) {
    var button_name = button_arg[0];
    var button_action = button_arg[1];
    var button = jQuery('<div/>').addClass('button');
    buttons.append(button);
    var inp = jQuery('<input/>',{type:'radio',name:'buttons'});
    var label = jQuery('<label/>').click(function() {inp.prop('checked', true);});
    button.click(function() {
      inp.prop('checked', true);
      a_outline.removeClass('selected opaque');
      b_outline.removeClass('selected opaque');
      a_fill.removeClass('selected opaque');
      b_fill.removeClass('selected opaque');
      ab_fill.removeClass('selected opaque');
      s_outline.removeClass('selected opaque');
      button_action();
    });
    label.html(button_name);
    button.append(inp);
    button.append(label);
  });
  function createPercentControl(letter, size) {
    var sb = jQuery('<div/>',{id:container_id + 'psb' + letter}).addClass('scrollbar');
    var lbl = jQuery('<label/>').attr('for', container_id + 'sb'+letter);
    lbl.html('P(' + letter + ') (%)');
    var idFunc1 = function() {
      $('#' + container_id + 'sb' + letter).slider('value', this.value);
    };
    var idFunc2 = function() {
      $('#' + container_id + 'sb' + letter + 't').val($(this).slider('value'));
    };
    var input = jQuery('<input/>', {
      type: 'text',
      id: container_id + 'sb'+letter+'t',
      onkeyup: idFunc1,
      value: size,
      size: 2
    });
    var input2 =
      jQuery('<span/>')
        .addClass('slider')
        .attr('id', container_id + 'sb' + letter)
        .slider({
      change: idFunc2,
      slide: idFunc2,
      min: 1,
      max: 100,
      step: 1,
      value: size
    });

    sb.append(lbl);
    sb.append(input);
    sb.append(input2);

    scrollbars.append(sb);
  }
  createPercentControl('A', 30);
  createPercentControl('B', 20);

  var infoDiv = jQuery('<div/>').addClass('info');
  ab_text = jQuery('<p/>');
  a_or_b_text = jQuery('<p/>');
  infoDiv.append(ab_text).append(a_or_b_text);
  scrollbars.append(infoDiv);

  var scaleFactorX = 0.3;
  var scaleFactorY = 0.3;

  // Synchronizes fill positions so that the outline is always visible on the A
  // and B boxes, and the intersection area is synchronized.
  function syncPositions() {
    // Make sure everything stays in bounds.
    var ax_offset = a_outline.offset().left + a_outline.width() -
      (s_outline.offset().left + s_outline.width());
    if (ax_offset > 0)
      a_outline.css('left', (a_outline.position().left - ax_offset) + 'px');
    var ay_offset = a_outline.offset().top + a_outline.height() -
      (s_outline.offset().top + s_outline.height());
    if (ay_offset > 0)
      a_outline.css('top', (a_outline.position().top - ay_offset) + 'px');
    var bx_offset = b_outline.offset().left + b_outline.width() -
      (s_outline.offset().left + s_outline.width());
    if (bx_offset > 0)
      b_outline.css('left', (b_outline.position().left - bx_offset) + 'px');
    var by_offset = b_outline.offset().top + b_outline.height() -
      (s_outline.offset().top + s_outline.height());
    if (by_offset > 0)
      b_outline.css('top', (b_outline.position().top - by_offset) + 'px');
    if (a_outline.position().left < s_outline.position().left)
      a_outline.css('left', s_outline.position().left + 'px');
    if (a_outline.position().top < s_outline.position().top)
      a_outline.css('top', s_outline.position().top + 'px');
    if (b_outline.position().left < s_outline.position().left)
      b_outline.css('left', s_outline.position().left + 'px');
    if (b_outline.position().top < s_outline.position().top)
      b_outline.css('top', s_outline.position().top + 'px');

    // Synchronize the fills with the outlines.
    a_fill.css('left', a_outline.css('left'));
    a_fill.css('top', a_outline.css('top'));
    a_fill.css('width', a_outline.css('width'));
    a_fill.css('height', a_outline.css('height'));

    b_fill.css('left', b_outline.css('left'));
    b_fill.css('top', b_outline.css('top'));
    b_fill.css('width', b_outline.css('width'));
    b_fill.css('height', b_outline.css('height'));

    // Calculate the intersection.
    var a_x = a_outline.position().left;
    var a_y = a_outline.position().top;
    var a_w = a_outline.width();
    var a_h = a_outline.height();
    var b_x = b_outline.position().left;
    var b_y = b_outline.position().top;
    var b_w = b_outline.width();
    var b_h = b_outline.height();
    if (a_x + a_w < b_x || b_x + b_w < a_x ||
        a_y + a_h < b_y || b_y + b_h < a_y) {
      ab_fill.css('display', 'none');
    } else {
      ab_fill.css('display', '');
      var x1 = Math.max(a_x, b_x);
      var y1 = Math.max(a_y, b_y);
      ab_fill.css('left', x1 + 'px');
      ab_fill.css('top', y1 + 'px');
      var x2 = Math.min(a_x + a_w, b_x + b_w);
      var y2 = Math.min(a_y + a_h, b_y + b_h);
      ab_fill.css('width', (x2 - x1) + 'px');
      ab_fill.css('height', (y2 - y1) + 'px');
    }

    // Calculate P(AB) and P(A or B)
    var s_area = s_outline.width() * s_outline.height();
    var p_a = a_fill.width() * a_fill.height() / s_area * 100;
    var p_b = b_fill.width() * b_fill.height() / s_area * 100;
    var p_ab = ab_fill.width() * ab_fill.height() / s_area * 100;
    var p_a_or_b = (p_a + p_b - p_ab);
    if ((ab_fill.position().left == a_outline.position().left &&
         ab_fill.position().top == a_outline.position().top &&
         ab_fill.width() == a_outline.width() &&
         ab_fill.height() == a_outline.height()) ||
        (ab_fill.position().left == b_outline.position().left &&
         ab_fill.position().top == b_outline.position().top &&
         ab_fill.width() == b_outline.width() &&
         ab_fill.height() == b_outline.height())) {
      p_ab = Math.min($('#' + container_id + 'sbA').slider('value'),
                      $('#' + container_id + 'sbB').slider('value'));
      p_a_or_b = Math.max($('#' + container_id + 'sbA').slider('value'),
                          $('#' + container_id + 'sbB').slider('value'));
    }
    if (ab_fill.css('display') == 'none') {
      p_ab = 0;
      p_a_or_b = parseFloat($('#' + container_id + 'sbA').slider('value')) +
                 parseFloat($('#' + container_id + 'sbB').slider('value'));
    }
    ab_text.text('P(AB): ' + p_ab.fix(1) + '%');
    a_or_b_text.text('P(A or B): ' + p_a_or_b.fix(1) + '%');
  }

  function draw() {

    s_outline = jQuery('<div/>').addClass('box').addClass('S');
    s_outline.css('left', '10px');
    s_outline.css('top', '10px');
    s_outline.css('width', (self.container.width() - 20) + 'px');
    s_outline.css('height', (self.container.height() - 20) + 'px');
    s_outline.text('S');
    self.container.append(s_outline);

    var rectX = self.container.width() / 2 - 50;
    var rectY = self.container.height() / 2 - 25;

    a_fill = jQuery('<div/>').addClass('box').addClass('A').addClass('fill');
    a_outline = jQuery('<div/>').addClass('box').addClass('A').addClass('outline');
    a_outline.css('left', (rectX - 32) + 'px');
    a_outline.css('top', (rectY - 16) + 'px');
    a_outline.css('width', (s_outline.width() * scaleFactorX) + 'px');
    a_outline.css('height', (s_outline.height() * scaleFactorY) + 'px');
    a_outline.text('A');

    b_fill = jQuery('<div/>').addClass('box').addClass('B').addClass('fill');
    b_outline = jQuery('<div/>').addClass('box').addClass('B').addClass('outline');
    b_outline.css('left', (rectX + 32) + 'px');
    b_outline.css('top', (rectY + 16) + 'px');
    b_outline.css('width', (s_outline.width() * scaleFactorX) + 'px');
    b_outline.css('height', (s_outline.height() * scaleFactorY) + 'px');
    b_outline.text('B');

    ab_fill = jQuery('<div/>').addClass('box').addClass('AB').addClass('fill');
    self.container.append(a_fill);
    self.container.append(b_fill);
    self.container.append(ab_fill);
    self.container.append(a_outline);
    self.container.append(b_outline);
    a_outline.draggable({
      containment: s_outline,
      drag: syncPositions,
      stop: syncPositions
    });
    b_outline.draggable({
      containment: s_outline,
      drag: syncPositions,
      stop: syncPositions
    });
    syncPositions();

    function updateSizes() {
      // ratio = width / height
      // area = width * height
      // width = area / height
      // width = ratio * height
      // width * width = area * ratio
      // height = area / width
      var ratio = s_outline.width() / s_outline.height();
      var s_area = s_outline.width() * s_outline.height();
      var a_p = $('#' + container_id + 'sbA').slider('value') / 100;
      var a_area = s_area * a_p;
      var a_width = Math.sqrt(a_area * ratio);
      var a_height = a_area / a_width;
      a_outline.width(a_width + 'px');
      a_outline.height(a_height + 'px');
      var b_p = $('#' + container_id + 'sbB').slider('value') / 100;
      var b_area = s_area * b_p;
      var b_width = Math.sqrt(b_area * ratio);
      var b_height = b_area / b_width;
      b_outline.width(b_width + 'px');
      b_outline.height(b_height + 'px');
      syncPositions();
    }
    $('#' + container_id + 'sbA').on('slidechange', updateSizes);
    $('#' + container_id + 'sbB').on('slidechange', updateSizes);
    $('#' + container_id + 'sbA').on('slide', updateSizes);
    $('#' + container_id + 'sbB').on('slide', updateSizes);
    $('#' + container_id + 'sbAt').change(updateSizes);
    $('#' + container_id + 'sbBt').change(updateSizes);
    updateSizes();
  }
  draw();
}

(function(){

  $.fn.popbox = function(options){
    var settings = $.extend({
      selector      : this.selector,
      open          : '.open',
      box           : '.box',
      arrow         : '.arrow',
      arrow_border  : '.arrow-border',
      close         : '.close'
    }, options);

    var methods = {
      open: function(event){
        event.preventDefault();

        var pop = $(this);
        var box = $(this).parent().find(settings['box']);

        box.find(settings['arrow']).css({'left': box.width()/2 - 10});
        box.find(settings['arrow_border']).css({'left': box.width()/2 - 10});

        if(box.css('display') == 'block'){
          methods.close();
        } else {
          box.css({'display': 'block', 'top': 10, 'left': ((pop.parent().width()/2) -box.width()/2 )});
        }

        if (typeof $(this).parent().data('onPopBox') != 'undefined')
          $(this).parent().data('onPopBox')();
      },

      close: function(){
        $(settings.selector).find(settings['box']).fadeOut("fast");
      }
    };

    $(document).bind('keyup', function(event){
      if(event.keyCode == 27){
        methods.close();
      }
    });

    $(document).bind('click', function(event){
      if(!$(event.target).closest(settings['selector']).length){
        methods.close();
      }
    });

    return this.each(function(){
      if ($(this).data('isPopBox') === true)
        return;
      $(this).data('isPopBox', true);
      if (!$(this).css('width'))
        $(this).css({'width': $(settings['box']).width()}); // Width needs to be set otherwise popbox will not move when window resized.
      $(settings['open'], this).bind('click', methods.open);
      $(settings['open'], this).parent().find(settings['close']).bind('click', function(event){
        event.preventDefault();
        methods.close();
      });
    });
  }

}).call(this);
