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
//  //
//  // TODO(jmeady): Rip HistHiLite into separate scriptlets for each of these
//  //               use cases.
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
//
//  // Show sliders to change n and p
//  - binomialBars: true

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
    p: null,
    binomialBars: true
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
  this.sd = 0;
  this.mu = 0;
  this.n = self.options.n;
  this.p = self.options.p;
  this.normalCurve = function(x) {
    return normPdf(self.mu, self.sd, x);
  };

  // Various handles to important jQuery objects.
  this.urlInput = null;
  this.dataSelect = null;
  this.variableSelect = null;
  this.areaFrom = null;
  this.areaTo = null;
  this.areaInfoDiv = null;
  this.showNormalButton = null;
  this.showingOriginal = null;
  this.showingRestricted = null;
  this.additionalInfo = null;
  this.histogram = null;

  // Restricted variable handles.
  this.restrictedVariable = null;
  this.restrictLowerEnable = null;
  this.restrictLower = null;
  this.restrictUpperEnable = null;
  this.restrictUpper = null;
  this.restrictedStates = {};
  this.restrictedCounts = null;
  this.restrictedSd = 0;
  this.restrictedMu = 0;
  this.restrictedNormal = function(x) {
    return normPdf(self.restrictedMu, self.restrictedSd, x);
  };

  // Mode.
  this.dataIsBinomial = false;
  this.dataIsManual = false;
  this.dataIsExternal = false;

  // This method will be set according to which data source we are using.
  this.reloadData = null;

  if (self.options.n !== null || self.options.p !== null) {
    // Binomial data source.
    self.dataIsBinomial = true;
    self.options.showUnivariateStats = false;
    self.options.listData = false;
    self.options.changeNumBins = false;
    self.reloadData = loadBinomialData;
  } else if (self.options.counts !== null || self.options.ends !== null) {
    // Manually specified data source.
    self.dataIsManual = true;
    self.dataSource = null;
    if (!params.showNormal)
      self.options.showNormal = false;
    if (!params.showNormalButton)
      self.options.showNormalButton = false;
    self.options.showUnivariateStats = false;
    self.options.listData = false;
    self.options.changeNumBins = false;
    self.options.binomialBars = false;
    self.reloadData = loadManualData;
  } else if (self.options.data instanceof Array) {
    // External data source.
    self.dataIsExternal = true;
    self.dataSource = self.options.data[0];
    self.options.binomialBars = false;
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

  this.reloadChart = function() {
    redrawChart();

    self.areaFrom.bounds(self.binEnds.min(), self.binEnds.max());
    self.areaTo.bounds(self.binEnds.min(), self.binEnds.max());

    if (!self.dataIsBinomial) {
      if (self.options.hiLiteLo === null) {
        self.areaFrom.val(self.binEnds.min());
      } else {
        self.areaFrom.val(self.options.hiLiteLo);
      }
      if (self.options.hiLiteHi === null) {
        self.areaTo.val(self.binEnds.min());
      } else {
        self.areaTo.val(self.options.hiLiteHi);
      }
    }
  };
  function redrawChart() {
    if (null !== self.restrictedCounts &&
        self.showingRestricted.is(':checked')) {
      if (self.showingOriginal.is(':checked')) {
        self.histogram.set(
          self.binEnds,
          [self.binCounts, self.restrictedCounts],
          [self.normalCurve, self.restrictedNormal]);
      } else {
        self.histogram.set(
          self.binEnds,
          [[], self.restrictedCounts],
          [null, self.restrictedNormal]);
      }
    } else {
      self.histogram.set(self.binEnds, self.binCounts, self.normalCurve);
    }

    // Do we really need this?
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
    var p = self.p;
    var n = self.n;
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
    if (!self.options.binomialBars)
      self.additionalInfo.html('n=' + n + '&nbsp;&nbsp;&nbsp;p=' + p);
  }

  // Initializes the chart controls. Adds the sliders, input fields, etc.
  function initControls() {
    // Create html for basic structure:
    // top_controls -> stici_chart -> area_info -> botom_controls.
    var o = jQuery('<div/>').addClass('stici').addClass('stici_histhilite');
    self.container.append(o);
    var top = jQuery('<div/>').addClass('top_controls');
    o.append(top);
    self.histogram = new SticiHistogram();
    o.append(self.histogram);
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
      var row = jQuery('<div/>').addClass('areaHiLite');
      self.areaFrom = new SticiTextBar({
        change: refreshSelectedAreaOverlay,
        step: self.dataIsBinomial ? 1.0 : 0.001,
        value: -0.5,
        label: 'Area from: '
      });
      self.areaTo = new SticiTextBar({
        change: refreshSelectedAreaOverlay,
        step: self.dataIsBinomial ? 1.0 : 0.001,
        value: -0.5,
        label: ' to: '
      });

      row.append(self.areaFrom, self.areaTo);

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
      } else if(!self.dataIsBinomial) {
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
        var dat = jQuery.map(self.dataValues, function(values) {
          return parseFloat(values[self.restrictedVariable.val()]);
        });
        self.restrictUpperEnable.prop('checked', false);
        self.restrictUpper.val(dat.max());
        self.restrictLowerEnable.prop('checked', false);
        self.restrictLower.val(dat.min());
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

      self.showNormalButton = new SticiToggleButton({
        trueLabel: 'Hide Normal Curve',
        falseLabel: 'Show Normal Curve',
        value: self.options.showNormal,
        change: function(e, show) {
          self.histogram.showCurves(show);
      }});
      if (self.options.showNormalButton)
        row.append(self.showNormalButton);
      else
        self.showNormalButton.set(false);
      self.histogram.showCurves(self.options.showNormal);

      if (row.children().length > 0)
        appendFooterRow(row);
    }
    function createBinomialBars() {
      var row = jQuery('<div/>').addClass('binomialBars');
      var nSlider = new SticiTextBar({
        step: 1,
        min: 1,
        max: 500,
        value: self.n,
        change: updateNP,
        label: 'n: '
      });

      var pSlider = new SticiTextBar({
        step: 0.001,
        min: 0,
        max: 1,
        value: self.p,
        change: updateNP,
        label: 'p: '
      });

      function updateNP() {
        self.n = nSlider.val();
        self.p = pSlider.val();
        self.reloadData();
      }

      row.append(nSlider, pSlider);
      appendFooterRow(row);
    }

    // Top controls only show if the file/variable can be changed.
    if (self.dataSource !== null)
      createSelectDataSourceControls();
    createAreaSelectControls();
    if (self.options.restrict)
      createRestrictionControls();
    if (self.options.binomialBars)
      createBinomialBars();
    createExtraInfoControls();
    var additionalInfoDiv = jQuery('<div/>').addClass('additional_info');
    self.additionalInfo = jQuery('<p/>');
    additionalInfoDiv.append(self.additionalInfo);
    if (!self.dataIsBinomial || !self.options.binomialBars)
      appendFooterRow(additionalInfoDiv);

    jQuery('.popbox').popbox();

    // Set vertical positions based upon available controls.
    self.areaInfoDiv.css('bottom', bottomOffset + 'px');
    top.css('height', topOffset + 'px');
    bottom.css('height', bottomOffset + 'px');
    self.histogram.css('margin-bottom', (bottomOffset + 15) + 'px');
    self.histogram.css('margin-top', (topOffset) + 'px');
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
    var lower = self.areaFrom.val();
    var upper = self.areaTo.val();

    self.histogram.hilite(lower, upper);

    var p = histHiLitArea(lower, upper, self.binEnds, self.binCounts);
    p *= 100;
    var text = 'Selected area: ' + p.fix(2) + '%';
    if (self.showNormalButton.toggled()) {
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
      if (self.showNormalButton.toggled()) {
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

function Stici_SampleDist(container_id, params) {
    var self = this;

    // jQuery object containing the entire chart.
    var container = jQuery('#' + container_id);

    // These are constants.
    var maxBins = 100;
    var nDigs = 4;
    var maxSamples = 10000;
    var maxMaxSampleSize = 500;  // max size of each sample
    var curveLabel = {
      "No Curve": "none",
      "Normal Curve": "normal",
      "Student t Curve": "t",
      "Chi-Squared Curve": "chi-squared"
    };
    var rVar = {  // random variable options and their abbreviations
      "Sample Sum": "sum",
      "Sample Mean": "mean",
      "Sample t": "t",
      "Sample S-Squared": "s-squared",
      "Sample Chi-Squared": "chi-squared"
    };
    var rSource = {
      "Normal": "normal",
      "Uniform": "uniform",
      "Box": "box"
    };

    // User-configurable parameters. These are directly lifted from
    // SampleDist.java. I don't know what the commented ones are yet, nor what
    // their default values should be. -jeady
    var options = {
        binControls: true,
        bins: maxBins,
        boxContents: "0,1,2,3,4",
        boxEditable: true,
        boxHistControl: false,
        curveControls: true,
        curves: "all",
        hiLiteHi: 0.0,
        hiLiteLo: 0.0,
        replace: true,
        replaceControl: false,
        sampleSize: 5,
        samplesToTake: 1,
        showBoxHist: true,
        showCurve: false,
        sources: "all",
        startWith: "sum",
        statLabels: true,
        toggleVar: true,
        variables: "all"
    };
    jQuery.extend(options, params);

    // UI Elements.
    // Most of these are actually initialized later in init(), but they're
    // here temporarily to conform with the existing java code.
    var takeSampleButton = null; // SticiToggleButton, myButton[0] in the Java.
    var populationButton = null; // SticiToggleButton, myButton[1] in the Java.
    var sampleSizeBar = null;    // <input/> //size of each sample
    var samplesToTakeBar = null; // <input/> //number of samples to take
    var binBar = null;           // <input/> //number of bins in the histogram
    var lo = null;  // SticiTextBar
    var hi = null;  // SticiTextBar
    var box = null;  // textarea                  // holds the population.
    var popMeanLabel = null;                      // to display the population mean
    var popSdLabel = null;                        // to display the population SD
    var statSampleMeanLabel = null;               // to display mean of sample means
    var statSampleSDLabel = null;                 // sample SD of sample means
    var statExpLabel = null;                      // theor. Expected value of statistic
    var statSELabel = null;                       // to display theor. SD of statistic or d.f. of chi-square
    var samplesSoFarLabel = null;                 // number of samples of current size taken
    var boxLabel = null;                          // label box as population or category probabilities
    var areaLabel = null;  // span
    var curveAreaLabel = null;  // span
    var hist = new SticiHistogram();
    var replaceCheck = null;
    var varChoice = null;  // SticiComboBox       // options for which random variable to sample
    var curveChoice = null;  // SticiComboBox     // options for which approximating curve to plot
    var sourceChoice = null;  // SticiComboBox    // options for data source (box, normal, uniform)
    var stats = null;                             // Contains all of the statistics labels.

    // State variables.
    var pop = [];                               // elements of the population
    var sample = [];                            // elements of the current sample
    var xMin = null;
    var xMax = null;
    var samplesSoFar = 0;
    var sampleMean = [];                        // the history of sample means
    var sampleSSq = [];                         // history of sample s^2
    var sampleT = [];                           // history of sample t
    var sampleSize = options.sampleSize;        // size of current sample
    var samplesToTake = options.samplesToTake;  // number of samples to take of that size
    var binEnd = [];                            // bin endpoints
    var countPop = [];                          // areas of the bins for the pop. histogram
    var countSample = [];                       // areas of bins for the hist. of sample means
    var hiLiteLo = options.hiLiteLo;
    var hiLiteHi = options.hiLiteHi;
    var showBoxHist = options.showBoxHist;
    var nBins = options.bins;
    var minSampleSize;              // minimum sample size (2 for vars that use ssd)
    var maxSampleSize;              // maximum sample size (population size if sampling w/o replacement)
    var currVar = null;
    var lastVar = null;
    var EX = 0;                         // expected value of the variable plotted
    var SE = 0;                         // standard error of the variable plotted
    var popMin = 0;                     // smallest value in pop.
    var popMax = 0;                     // largest value in pop.
    var popMean = 0;                    // the population mean
    var popSd = 0;                      // the population SD


    // These are class variables from the original java that probably have not
    // yet been incorporated.
    /*
    private boolean showCurve = false;      // show normal, t, or chi-square approximation toggle
    private int nVars = 5;                  // number of random variable choices
    private int nCurves = 4;                // number of approximating curve choices
    private Hashtable varHash = new Hashtable(nVars);
    private int nSources = 3;
    private Hashtable sourceHash = new Hashtable(nSources);
    private boolean replaceControl = false;    // add controls for sampling w/ w/o replacement
    private boolean statLabels = true;         // show summary statistics of sample statistic values?
    private boolean binControls = true;        // add the bin controls?
    private boolean curveControls = true;      // add normal or chi-square curve button and label?
    private boolean boxEditable = true;        // are the contents of the box editable?
    private boolean toggleVar = true;          // add Choice to toggle among variables?
    private boolean showBoxHist = true;        // show histogram of the numbers in the box?
    private boolean boxHistControl = true;     // show button to turn box histogram on and off?
    private boolean normalFillButton = false;  // add button to fill box w/ normal sample?

    */

    function init() {
      var o = jQuery('<div/>').addClass('stici stici_sampledist');
      container.append(o);

      // General pieces
      var top = jQuery('<div/>').addClass('top_controls');
      var middle = jQuery('<div/>').addClass('middle');
      var bottom = jQuery('<div/>').addClass('bottom_controls');
      o.append(top, middle, bottom);

      // Compose the top piece.
      top.append(createSelectDataSourceControls());

      // Compose the middle pieces.
      middle.append(createStatsBox(), hist, createPopulationBox());

      // Compose the bottom piece.
      if (showBoxHist)
        bottom.append(createSampleRow(),
                      createAreaSelectRow(),
                      createInfoRow());

      // Make sure everything is sized correctly.
      middle.height(container.height() - top.height() - bottom.height());
      hist.width(middle.width() - stats.width() - box.width() - 20);

      // Set all of the handlers.
      jQuery.each([populationButton,
                   sampleSizeBar,
                   samplesToTakeBar,
                   binBar,
                   lo,
                   hi,
                   box,
                   varChoice,
                   curveChoice,
                   sourceChoice,
                   replaceCheck],
                  function(_, e) {e.change(handleEvent);});
      takeSampleButton.click(handleEvent);

      // Below this point lie methods used to build the individual pieces.
      // Top.
      function createSelectDataSourceControls() {
        var dataSelectControls = jQuery('<div/>');
        varChoice = new SticiComboBox({
          label: "Distribution of: ",
          options: rVar,
          selected: options.startWith
        });
        currVar = varChoice.selected();
        sourceChoice = new SticiComboBox({
          label: "Sample from: ",
          options: rSource,
          selected: "Box"
        });
        dataSelectControls.append(varChoice, sourceChoice);
        if (options.replaceControl) {
          replaceCheck = jQuery('<input type="checkbox"/>');
          replaceCheck.attr('checked', options.replace);
          dataSelectControls.append(replaceCheck, ' with replacement');
        }
        takeSampleButton = jQuery('<button id="takeSample"/>').text('Take Sample');
        dataSelectControls.append(takeSampleButton);
        return dataSelectControls;
      }
      // Middle.
      function createPopulationBox() {
        var container = jQuery('<div/>').addClass('population');
        boxLabel = jQuery('<div/>');
        box = jQuery('<textarea/>');
        if (!options.boxEditable)
          box.attr("readonly", "readonly");
        container.append(boxLabel, box);
        return container;
      }
      function createStatsBox() {
        stats = jQuery('<div/>').addClass('statsText');
        popMeanLabel = jQuery('<p/>');
        popSdLabel = jQuery('<p/>');
        statExpLabel = jQuery('<p/>');
        statSELabel = jQuery('<p/>');
        stats.append(popMeanLabel,
                        popSdLabel,
                        statExpLabel,
                        statSELabel);
        if (options.statLabels) {
          statSampleMeanLabel = jQuery('<p/>');
          statSampleSDLabel = jQuery('<p/>');
          stats.append(statSampleMeanLabel,
                          statSampleSDLabel);
        }
        samplesSoFarLabel = jQuery('<p/>');
        stats.append(samplesSoFarLabel);

        return stats;
      }
      // Bottom.
      function createSampleRow() {
        if (showBoxHist) {
          var row = jQuery('<div/>');

          areaLabel = jQuery('<span/>');
          curveAreaLabel = jQuery('<span/>');
          curveChoice = new SticiComboBox({
            label: '',
            options: curveLabel
          });
          populationButton = SticiToggleButton({
            trueLabel: 'No Population Histogram',
            falseLabel: 'Population Histogram',
            value: true
          });

          row.append(areaLabel,
                     curveAreaLabel,
                     curveChoice,
                     populationButton);
          return row;
        }
        return null;
      }
      function createAreaSelectRow() {
        var row = jQuery('<div/>').addClass('areaHiLite');
        lo = new SticiTextBar({
          step: 0.001,
          value: 0,
          label: 'Area from: '
        });
        hi = new SticiTextBar({
          step: 0.001,
          value: 0,
          label: ' to: '
        });
        row.append(lo, hi);
        return row;
      }
      function createInfoRow() {
        var row = jQuery('<div/>');

        sampleSizeBar = jQuery('<input type="text"/>').val(sampleSize);
        samplesToTakeBar = jQuery('<input type="text"/>').val(samplesToTake);
        row.append("Sample Size: ",
                   sampleSizeBar,
                   " Take ",
                   samplesToTakeBar,
                   " samples. ");
        if (options.binControls) {
          binBar = jQuery('<input type="text" id="bins" />').val(options.bins);
          row.append(" Bins: ", binBar);
        }
        return row;
      }


      // The UI has been set up. Now initialize the data.
      if (options.sources === null ||
          options.sources.toLowerCase().indexOf("box") >= 0 ||
            options.sources.toLowerCase().indexOf("all") >= 0) {
        if (varChoice.selected() == "Sample Chi-Squared")
          boxLabel.text("Category Probabilities");
        else
          boxLabel.text("Population");
      }
      var bc = "";
      if (options.boxContents !== null) {
        bc = options.boxContents;
      } else if (sourceChoice.selected() == "Normal") {
        bc = "Normal";
      } else if (sourceChoice.selected() == "Uniform") {
        bc = "Uniform";
      } else {
        bc = "0 1 2 3 4";
      }
      setBox(bc, true);
      var vmx = vMinMax(pop);
      xMin = vmx[0];
      xMax = vmx[1];
      initPop();
      setCurve();                                   // set the approximating curve
      setBins();                                    // make the histogram counts
      setBars(hiLiteLo, hiLiteHi);
      adjustSampleSize();
      showPlot();                                   // refresh the histogram
    }

    // compute population statistics
    function initPop() {
        if (sourceChoice.selected() == "Box") {
            popMean = 0;
            popSd = 0;
            if (pop.length === 0) {
                console.log("Error in SampleDist.initPop(): Population is empty!\n");
                for (var i= 0; i < nBins; i++) {
                    countPop[i] = 0;
                }
                // TODO(jmeady): Do we need to clear anything out here?
                return;
            }
            popMean = mean(pop);
            popSd = sd(pop);
// FIX ME! need to handle probabilities here.
        } else if (sourceChoice.selected() == "Normal") {
            popMean = 0;
            popSd = 1;
            replaceCheck.attr('checked', true);
        } else if (sourceChoice.selected() == "Uniform") {
            popMean = 0.5;
            popSd = Math.sqrt(1.0/12.0);
            replaceCheck.attr('checked', true);
        }
        popMin = pop.min();
        popMax = pop.max();
        setLims();                                  // set plot limits
// make the histogram of the population
        setBins();                                    // set the class intervals; make the counts
        setBars(xMin,xMin);                           // set the hilight scrollbar scales
// reset the labels
        if (varChoice.selected() == "Sample Chi-Squared") {
            popMeanLabel.text("Categories: " + pop.length);
            popSdLabel.text("E(Chi-Squared): " + (pop.length-1));
            replaceCheck.attr('checked', true);
        } else {
            popMeanLabel.text("Ave(Box): " + popMean.fix(3));
            popSdLabel.text("SD(Box): " + popSd.fix(3));
            statSampleMeanLabel.text("Mean(values) undefined");
            statSampleSDLabel.text("SD(values) undefined");
        }
        setCurve();
        setCurveLabel();
        setAreas();
    }

    function handleEvent(e) {
      if (binBar.is(e.target)) {                   // update # bins and redraw histogram
        nBins = parseInt(binBar.val(), 10);
        setBins();                              // reset the class intervals, make the counts
        showPlot();                             // refresh the histogram
      } else if (sampleSizeBar.is(e.target)) {     // clear history, reset sample size, redisplay histogram
        sampleSize = parseInt(sampleSizeBar.val(), 10);
        setBars(xMin, xMin);
        samplesSoFar = 0;
        setSamLabel();
        setLims();
        setCurveLabel();
        setBins();
        setCurve();
        setAreas();
        showPlot();
      } else if (samplesToTakeBar.is(e.target)) {
        samplesToTake = parseInt(samplesToTakeBar.val(), 10);
      } else if (lo.is(e.target) || hi.is(e.target)) {
        hiLiteLo = lo.val();
        hiLiteHi = hi.val();
        if (hiLiteLo >= hiLiteHi) hiLiteLo = hiLiteHi;
        setAreas();
        showPlot();
      } else if (takeSampleButton.is(e.target)) {
        var lim = maxSamples - samplesSoFar;            // number remaining samples
        drawSample(Math.min(samplesToTake, lim));
        setSamLabel();
      } else if (sourceChoice.is(e.target)) {
        if (sourceChoice.selected() == "Box" ) {
          setBox(box.text());
        } else {
          setBox(sourceChoice.selected());
          replaceCheck.attr('checked', true);
        }
      } else if (varChoice.is(e.target)) {
        lastVar = currVar;
        currVar = varChoice.selected();
        newVariable(varChoice.selected());
        showPlot();
      } else if (curveChoice.is(e.target)) {
        setCurve();
        setAreas();
        showPlot();
      } else if (replaceCheck.is(e.target)) {
        if (replaceOK(replaceCheck.is(':checked'))) {
          samplesSoFar = 0;
          setLims();
          setBins();
          setSamLabel();
          setBins();
          setBars(hiLiteLo, hiLiteHi);
          setCurveLabel();
          setCurve();
          setAreas();
        } else {
          replaceCheck.attr('checked', true);
        }
      } else if (populationButton.is(e.target)) {
        showBoxHist = populationButton.val();
        setLims();
        setBins();
        setBars(hiLiteLo, hiLiteHi);
        setCurve();
        showPlot();
      } else {
        console.log("Handling unknown event for " + e.target);
      }
    }

    function replaceOK(rep) {
      var v = true;
      if (!rep) {
        if (sourceChoice.selected() != "Box") {
          v = false;
        } else {
          var s = varChoice.selected();
          if (!(s == "Sample Sum" ||
                s == "Sample Mean" ||
                s == "Sample S-Squared" ||
                  s == "Sample t"))
            v = false;
        }
      }
      return v;
    }

    // test what is to be plotted; adjust variables accordingly
    function showPlot() {
      var curves = hist.curves();
      if (samplesSoFar > 0) {
        if (showBoxHist)
          hist.set(binEnd, [countPop, countSample], curves);
        else
          hist.set(binEnd, [[], countSample], curves);
      } else {
        if (showBoxHist)
          hist.set(binEnd, [countPop, []], curves);
        else
          hist.set(binEnd, [[], countSample], curves);
      }
      hist.hilite(hiLiteLo, hiLiteHi);
    }

    // set things up when the variable is changed
    function newVariable() {     // set things up when the variable is changed
      if ((varChoice.selected() == "Sample S-Squared" ||
           varChoice.selected() == "Sample t") &&
          (sampleSize == 1) ) {
            samplesSoFar = 0;
          }
          adjustSampleSize();
          if (lastVar == "Sample Chi-Squared" ||
              varChoice.selected() == "Sample Chi-Squared") {
            samplesSoFar = 0;
          }
          if (varChoice.selected() == "Sample Chi-Squared") {
            boxLabel.text("Category Probabilities");
            setBox(box.text(),true);
          } else {
            boxLabel.text("Population");
          }
          if (!(varChoice.selected() == "Sample Mean" ||
                varChoice.selected() == "Sample Sum" ||
                varChoice.selected() == "Sample S-Squared") ||
                varChoice.selected() == "Sample t") {
            replaceCheck.attr('checked', true);
          }
          setSamLabel();
          setLims();
          setBins();
          setBars(hiLiteLo, hiLiteHi);
          setCurveLabel();
          setCurve();
          setAreas();
    } // ends newVariable

    // function population
    function setBox(newBox, updateBox) {               // parse new population
      if (updateBox === undefined)
        updateBox = false;

      if (newBox.toLowerCase() == "normal") {
        replaceCheck.attr('checked', true);
        pop = [-4, 4];
        box.text("Normal");
        sourceChoice.selected("Normal");
        if (varChoice.selected() == "Sample Chi-Squared") {
          console.log("Warning in SampleDist.setBox(): normal incompatible " +
                             "with Sample Chi-Squared");
          varChoice.selected("Sample Mean");
        }
      } else if (newBox.toLowerCase() == "uniform") {
        replaceCheck.attr('checked', true);
        pop = [0, 1];
        box.text("Uniform");
        sourceChoice.selected("Uniform");
        if (varChoice.selected() == "Sample Chi-Squared") {
          console.log("Warning in SampleDist.setBox(): uniform incompatible " +
                             "with Sample Chi-Squared");
          varChoice.select("Sample Mean");
        }
      } else {
        pop = newBox.split(/[\n\t\r ,]+/);
        pop = jQuery.map(pop, function(v) {return parseFloat(v);});
        if (varChoice.selected() == "Sample Chi-Squared") {
          pop = jQuery.grep(pop, function(v) {
            return (v !== 0 && !isNaN(v));
          });
          pop = scalVMult(1.0/vSum(pop), pop);
          updateBox = true;
        }
        if (updateBox) {
          box.text(jQuery.map(pop, function(v) {return v.fix(nDigs);}).join(",\r"));
        }
        sourceChoice.selected("Box");
      }
      initPop();
      samplesSoFar = 0;
      setSamLabel();
    }  // ends setBox(String, boolean)

    function setSamLabel() {
      samplesSoFarLabel.text("Samples: " + samplesSoFar);
      if (varChoice.selected() == "Sample Mean") {
        countSample = listToHist(sampleMean, binEnd, nBins, samplesSoFar);
        statSampleMeanLabel.text(
          "Mean(values) = " + mean(sampleMean, samplesSoFar).fix(nDigs));
        statSampleSDLabel.text(
          "SD(values) = " + sd(sampleMean, samplesSoFar).fix(nDigs));
      } else if (varChoice.selected() == "Sample Sum") {
        countSample = listToHist(scalVMult(sampleSize, sampleMean), binEnd, nBins, samplesSoFar);
        statSampleMeanLabel.text(
          "Mean(values) = " + (sampleSize * mean(sampleMean, samplesSoFar)).fix(nDigs));
        statSampleSDLabel.text(
          "SD(values) = " + (sampleSize * sd(sampleMean, samplesSoFar)).fix(nDigs));
      } else if (varChoice.selected() == "Sample t") {
        countSample = listToHist(sampleT, binEnd, nBins, samplesSoFar);
        statSampleMeanLabel.text(
          "Mean(values) = " + mean(sampleT, samplesSoFar).fix(nDigs));
        statSampleSDLabel.text(
          "SD(values) = " + sd(sampleT, samplesSoFar).fix(nDigs));
      } else if (varChoice.selected() == "Sample S-Squared" ||
                 varChoice.selected() == "Sample Chi-Squared") {
        countSample = listToHist(sampleSSq, binEnd, nBins, samplesSoFar);
        statSampleMeanLabel.text(
          "Mean(values) = " + mean(sampleSSq, samplesSoFar).fix(nDigs));
        statSampleSDLabel.text(
          "SD(values) = " + sd(sampleSSq, samplesSoFar).fix(nDigs));
      }
      setAreas();
      showPlot();
    }

    function setAreas() {
      areaLabel.text(" Selected area: " + hiLitArea().pct());
      if (curveChoice.selected() == "Normal Curve")
        curveAreaLabel.text(" Normal approx: " + normHiLitArea().pct());
      else if (curveChoice.selected() == "Student t Curve")
        curveAreaLabel.text(" Student t approx: " + tHiLitArea().pct());
      else if (curveChoice.selected() == "Chi-Squared Curve")
        curveAreaLabel.text(" Chi-squared approx: " + chiHiLitArea().pct());
      else
        curveAreaLabel.text("");
    } // ends setAreas()

    function setCurveLabel() {
      var fpc = 1.0;
      if (!replaceCheck.is(':checked')) {
        fpc = Math.sqrt( (pop.length - sampleSize + 0.0)/(pop.length-1.0));
      }
      if (varChoice.selected() == "Sample Sum") {
        SE = fpc*popSd*Math.sqrt(sampleSize + 0.0);
        EX = sampleSize*popMean;
        statExpLabel.text("E(sum): " + EX.fix(3)  + "  ");
        statSELabel.text("SE(sum): " + SE.fix(3)  + "  ");
      } else if (varChoice.selected() == "Sample Mean") {
        SE = fpc*popSd/Math.sqrt(sampleSize + 0.0);
        EX = popMean;
        statExpLabel.text("E(mean): " + EX.fix(4)  + "  ");
        statSELabel.text("SE(mean): " + SE.fix(4) + "  ");
      } else if (varChoice.selected() == "Sample t") {
        if ( sampleSize > 2 ) {
          SE = Math.sqrt((sampleSize + 0.0)/(sampleSize - 2.0));
        } else {
          SE = Double.NaN;
        }
        EX = popMean;
        statExpLabel.text("E(t): " + EX.fix(4)  + "  ");
        statSELabel.text("SE(t): " + SE.fix(4) + "  ");
      } else if (varChoice.selected() == "Sample S-Squared") {
        if (replaceCheck.is(':checked')) {
          EX = popSd*popSd;
        } else {
          EX = popSd*popSd*pop.length/(pop.length-1.0);
        }
        SE = Math.sqrt(2.0/(sampleSize-1.0))*popSd*popSd;
        statExpLabel.text("E(S-squared): " + EX.fix(3)  + "  ");
        statSELabel.text("df: " +  (sampleSize-1) + "  ");
      } else if (varChoice.selected() == "Sample Chi-Squared") {
        EX = pop.length - 1;
        SE = Math.sqrt(2.0*(pop.length-1.0));
        popMeanLabel.text("Categories: " + pop.length);
        popSdLabel.text("E(Chi-Squared): " + (pop.length - 1));
        statExpLabel.text("df: " + (pop.length - 1) + " ");
        statSELabel.text("      ");
      }
    } // ends setCurveLabel()

    function drawSample(nSams) {
      var theSample = new Array(sampleSize);
      var indices = new Array(sampleSize);
      var xb;
      var ssq;
      var tStat;
      var tmp;
      var i;
      for (var j=0; j < nSams; j++) {
        xb = 0;
        ssq = 0;
        tStat = 0;
        if ( varChoice.selected() == "Sample Chi-Squared")  {
          if (sourceChoice.selected() == "Box") {
            var cum = vCumSum(pop);     // cum expecting an Array
            var count = new Array(pop.length); // count expecting an Array
            for (i=0; i < pop.length; i++) {
              count[i] = 0.0;
            }
            for (i=0; i < sampleSize; i++) {
              tmp = Math.random();
              if (tmp <= cum[0]) {
                count[0]++;
              }
              for (var k=1; k < count.length; k++) {
                if ( tmp > cum[k-1] && tmp <= cum[k] ) {
                  count[k]++;
                }
              }
            }
            ssq = 0.0;
            for (i=0; i < pop.length; i++) {
              tmp = sampleSize*pop[i];
              ssq += (count[i] - tmp)*(count[i] - tmp)/tmp;
            }
            sampleSSq[samplesSoFar++] = ssq;                                    // FIX: aculich 2013-03-06
            if (ssq < xMin || ssq > xMax) {
              xMin = Math.min(ssq, xMin);
              xMax = Math.max(ssq, xMax);
            }
          } else {
            console.error("Error in SampleDist.drawSample(): cannot draw from " +
                          "this distribution with Sample Chi-Square!");
          }
        } else {
          if (sourceChoice.selected() == "Box") {
            if (replaceCheck.is(':checked')) {
              indices = listOfRandInts(sampleSize, 0, pop.length-1);
            } else {
              indices = listOfDistinctRandInts(sampleSize, 0, pop.length-1);
            }
            for (i = 0; i < sampleSize; i++) {
              theSample[i] = pop[ indices[i] ];
              xb += theSample[i];
            }
          } else if (sourceChoice.selected() == "Normal") {
            for (i = 0; i < sampleSize; i++) {
              theSample[i] = rNorm();
              xb += theSample[i];
            }
          } else if (sourceChoice.selected() == "Uniform") {
            for (i = 0; i < sampleSize; i++) {
              theSample[i] = Math.random();
              xb += theSample[i];
            }
          }
          xb /= sampleSize;
          for (i = 0; i < sampleSize; i++) {
            ssq += (theSample[i] - xb)*(theSample[i] - xb);
          }
          if (sampleSize > 1) {                             // if n>1, log the sample s^2 and t
            ssq /= (sampleSize-1);
            sampleSSq[samplesSoFar] = ssq;
            tStat = xb/(Math.sqrt(ssq)/Math.sqrt(sampleSize));
            sampleT[samplesSoFar] = tStat;
          } else {                                          // otherwise, set to 0.
            sampleSSq[samplesSoFar] = 0;
            sampleT[samplesSoFar] = 0;
          }
          sampleMean[samplesSoFar++] = xb;                  // log the sample mean        // FIX: aculich 2013-03-06
          if (varChoice.selected() == "Sample Mean") {
            if (xb < xMin || xb > xMax) {
              xMin = Math.min(xb, xMin);
              xMax = Math.max(xb, xMax);
            }
          } else if (varChoice.selected() == "Sample t") {
            if (tStat < xMin || tStat > xMax) {
              xMin = Math.min(tStat, xMin);
              xMax = Math.max(tStat, xMax);
            }
          } else if ( varChoice.selected() == "Sample Sum") {
            tmp = xb * sampleSize;
            if (tmp < xMin || tmp > xMax) {
              xMin = Math.min(tmp, xMin);
              xMax = Math.max(tmp, xMax);
            }
          } else if (varChoice.selected() == "Sample S-Squared") {
            if (ssq < xMin || ssq > xMax) {
              xMin = Math.min(ssq, xMin);
              xMax = Math.max(ssq, xMax);
            }
          }
        }
      }
      setBins();
      setBars(hiLiteLo, hiLiteHi);
    }

    // set the TextBars for hilight and sampleSize
    function setBars(l, h) {
        hi.set(h, xMin, xMax, Math.pow(10, -1 * nDigs));
        lo.set(l, xMin, xMax, Math.pow(10, -1 * nDigs));
        hiLiteLo = l;
        hiLiteHi = h;
        adjustSampleSize();
    }

    function setBins() {
      binEnd = [];
      jQuery.each(range(0, nBins + 1), function(i) {
          binEnd[i] = xMin + i*(xMax - xMin)/nBins;
      });
      countPop = new Array(nBins);
      countSample = new Array(nBins);
      if (sourceChoice.selected() == "Box" && pop.length > 0) {
        if (varChoice.selected() == "Sample Chi-Squared") {
          setCurve();
        } else {
          countPop = listToHist(pop, binEnd, nBins);
          setCurve();
        }
      } else if (sourceChoice.selected() == "Normal") {
        jQuery.each(range(0, nBins), function(i) {
          countPop[i] = (normCdf(binEnd[i+1]) -
                         normCdf(binEnd[i]))/(binEnd[i+1] - binEnd[i]);
        });
      } else if (sourceChoice.selected() == "Uniform") {
        var midPt;
        jQuery.each(range(0, nBins), function(i) {
          midPt = (binEnd[i]+binEnd[i+1])/2;
          if (midPt >= 0 && midPt <= 1) {
            countPop[i] = 1;
          } else {
            countPop[i] = 0;
          }
        });
      }
      if (samplesSoFar > 0 ) {
        if (varChoice.selected() == "Sample S-Squared" || varChoice.selected() == "Sample Chi-Squared") {
          countSample = listToHist(sampleSSq, binEnd, nBins, samplesSoFar);
        } else if (varChoice.selected() == "Sample Mean") {
          countSample = listToHist(sampleMean, binEnd, nBins, samplesSoFar);
        } else if (varChoice.selected() == "Sample t") {
          countSample = listToHist(sampleT, binEnd, nBins, samplesSoFar);
        } else if (varChoice.selected() == "Sample Sum") {
          countSample = listToHist(scalVMult(sampleSize, sampleMean), binEnd, nBins, samplesSoFar);
        }
      } else {
        jQuery.each(range(0, nBins), function(i) {
          countSample[i] = 0;
        });
      }
    }

    function setLims() {
        if (varChoice.selected() == "Sample Sum") {
            xMin = sampleSize * popMin; // these are the limits for the histogram
            xMax = sampleSize * popMax;
        } else if (varChoice.selected() == "Sample Chi-Squared") {
            xMin = 0.0;
            xMax = 10*Math.sqrt(pop.length - 1); // 5 SD
        } else if (varChoice.selected() == "Sample S-Squared") {
            xMin = 0.0;
            var maxDev = Math.max(popMean-popMin, popMax-popMean);
            xMax = 3*maxDev*maxDev/Math.sqrt(sampleSize);
        } else if (varChoice.selected() == "Sample Mean") {
            xMin = popMean-4*popSd/Math.sqrt(sampleSize);
            xMax = popMax+4*popSd/Math.sqrt(sampleSize);
        } else if (varChoice.selected() == "Sample t") {
            if (sampleSize > 2) {
                xMin = -3*Math.sqrt((sampleSize+0.0)/(sampleSize - 2.0));
                xMax =  3*Math.sqrt((sampleSize+0.0)/(sampleSize - 2.0));
            } else {
                xMin = -5;
                xMax = 5;
            }
        }
        if (showBoxHist) {
            xMin = Math.min(popMin, xMin);
            xMax = Math.max(popMax, xMax);
        }
    }

    function setSampleSize(size) {
        sampleSize = size;
        adjustSampleSize();
        showPlot();
    }

    function adjustSampleSize() {
        minSampleSize = 1;
        if (varChoice.selected() == "Sample S-Squared" || varChoice.selected() == "Sample t") {
            minSampleSize = 2;
        }
        if ( !replaceCheck.is(':checked') ) {
            maxSampleSize = pop.length;
        } else {
            maxSampleSize = maxMaxSampleSize;
        }
        sampleSize = Math.max(sampleSize,minSampleSize);
        sampleSize = Math.min(sampleSize,maxSampleSize);
        //sampleSizeBar.setValues(sampleSize,minSampleSize,maxSampleSize,1);
        //TODO(jmeady): Allow bounds on this.
        sampleSizeBar.val(sampleSize);
    }

    function setCurve() {
      var sd = 0;                         // sd for normal approx
      var mu = 0;                         // mean for normal approx
      hist.curves([null, null]);
      var fpc = 1.0;
      var popVar = popSd*popSd;
      if ( !replaceCheck.is(':checked') ) {
        popVar = popVar*pop.length/(pop.length-1.0);
      }
      if (!replaceCheck.is(':checked')) {
        fpc = Math.sqrt( (pop.length - sampleSize + 0.0)/(pop.length-1.0));
      }
      if (curveChoice.selected() == "No Curve") {
        hist.hideCurves();
      } else {
        hist.showCurves();
        if (curveChoice.selected() == "Chi-Squared Curve") {
          if (varChoice.selected() == "Sample S-Squared") {
            var scale = (sampleSize - 1.0)/(popVar);
            // change of variables: (n-1)*S^2/sigma^2 ~ Chi^2_{n-1}
            hist.curves(1, function(x) {
              return scale*chi2Pdf(sampleSize-1.0, x * scale);
            });
          } else if (varChoice.selected() == "Sample Chi-Squared") {
            hist.curves(1, function(x) {
              return chi2Pdf(pop.length-1.0, x);
            });
          } else {
            console.warn("Warning in SampleDist.setCurve(): Chi-squared " +
                         "approximation to " +
                         varChoice.selected() + " Not Supported!");
            curveChoice.select("No Curve");
            hist.hideCurves();
            return(false);
          }
        } else if (curveChoice.selected() == "Normal Curve") {
          if (varChoice.selected() == "Sample Mean") {
            sd = fpc*popSd/Math.sqrt(sampleSize + 0.0);
            mu = popMean;
          } else if (varChoice.selected() == "Sample Sum") {
            sd = fpc*popSd * Math.sqrt(sampleSize + 0.0);
            mu = popMean * sampleSize;
          } else if (varChoice.selected() == "Sample S-Squared") {
            // E(chi^2) = (n-1), so E( sigma^2 chi^2 / (n-1) = sigma^2.
            // SD(chi^2) = sqrt(2(n-1)), so SD( sigma^2 chi^2/ (n-1)) = sqrt(2/(n-1)) sigma^2.
            sd = Math.sqrt(2.0/(sampleSize-1.0))*popSd*popSd; // FIX ME!
            // doesn't account for no replacement
            mu = popVar;
          } else if (varChoice.selected() == "Sample Chi-Squared") {
            sd = Math.sqrt(2.0*(pop.length-1.0));
            mu = pop.length-1;
          } else if (varChoice.selected() == "Sample t") {
            if (sampleSize > 2) {
              sd = sampleSize/(sampleSize-2.0);
            } else {
              sd = NaN;
              console.warn("Warning in SampleDist.setCurve(): normal " +
                           "approximation to Student t with sample size <= 2 " +
                           " Not Supported!");
              curveChoice.select("No Curve");
              hist.hideCurves();
              return(false);
            }
            mu = 0;
          }
          hist.curves(1, function(x) {
            return normPdf(mu, sd, x);
          });
        } else if (curveChoice.selected() == "Student t Curve") {
          if (varChoice.selected() == "Sample t") {
            hist.curves(1, function(x) {
              return tPdf(sampleSize-1, x);
            });
          } else {
            console.warn("Warning in SampleDist.setCurve(): Student t " +
                         "approximation to " + varChoice.selected() +
                         " Not Supported!");
            curveChoice.select("No Curve");
            hist.hideCurves();
            return(false);
          }
        }
      }
      return(true);
    }

    function hiLitArea() {
      var area = 0;
      for (var i=0; i < nBins; i++) {
        if( binEnd[i]  > hiLiteHi ||  binEnd[i+1] <= hiLiteLo) {
        } else if (binEnd[i] >= hiLiteLo && binEnd[i+1] <= hiLiteHi) {
          area += countSample[i]*(binEnd[i+1]-binEnd[i]);
        } else if (binEnd[i] >= hiLiteLo && binEnd[i+1] > hiLiteHi) {
          area += countSample[i]*(hiLiteHi - binEnd[i]);
        } else if (binEnd[i] <= hiLiteLo && binEnd[i+1] <= hiLiteHi) {
          area += countSample[i]*(binEnd[i+1]-hiLiteLo);
        } else if (binEnd[i] < hiLiteLo && binEnd[i+1] > hiLiteHi) {
          area += countSample[i]*(hiLiteHi - hiLiteLo);
        }
      }
      return(area);
    } // ends hiLitArea()


    function normHiLitArea() {
        var area = 0;
        var fpc = 1.0;
        if (!replaceCheck.is(':checked')) {
            fpc = Math.sqrt( (pop.length - sampleSize + 0.0)/(pop.length-1.0));
        }
        if (hiLiteHi > hiLiteLo) {
           area = normCdf((hiLiteHi - EX)/(fpc*SE)) - normCdf((hiLiteLo - EX)/(fpc*SE));
        }
        return(area);
    }// ends normHiLitArea

    function chiHiLitArea() {
       var area = 0;
       if (hiLiteHi > hiLiteLo) {
           if (varChoice.selected() == "Sample S-Squared") {
               var scale = (sampleSize - 1.0)/(popSd*popSd);
               area = chi2Cdf(sampleSize-1, scale*hiLiteHi) -
                      chi2Cdf(sampleSize-1, scale*hiLiteLo);
           } else if (varChoice.selected() == "Sample Chi-Squared") {
               area = chi2Cdf(pop.length-1, hiLiteHi) -
                      chi2Cdf(pop.length-1, hiLiteLo);
           } else {
               console.error("Error in SampleDist.chiHiLitArea(): " + varChoice.selected() +
                      " not supported. ");
               area = 0.0;
           }
       }
       return(area);
    }// ends chiHiLitArea

    function tHiLitArea() {
       var area = 0;
       if (hiLiteHi > hiLiteLo) {
           if (varChoice.selected() == "Sample t") {
               area = tCdf(sampleSize-1, hiLiteHi) -
                      tCdf(sampleSize-1, hiLiteLo);
           } else {
               console.error("Error in SampleDist.tHiLitArea(): " + varChoice.selected() +
                      " not supported. ");
               area = 0.0;
           }
       }
       return(area);
    }// ends chiHiLitArea

    init();
}

//js rewrite of http://statistics.berkeley.edu/~stark/Java/Html/SampleDist.htm

function Stici_OldSampleDist(container_id, params) {
  var self = this;

  var SUM = 'sum';
  var MEAN = 'mean';
  var T = 't';
  var CHISQUARE = 'chisquared';
  var SSQ = 'ssq';

  var BOX = 'Box';
  var UNIFORM = 'Uniform';
  var NORMAL = 'Normal';

  var NO_CURVE = 'none';
  var NORMAL_CURVE = 'normal';
  var STUDENT_T_CURVE = 't';
  var CHI_SQUARED_CURVE = 'chisquared';

  if (!params instanceof Object) {
    console.error('Stici_SampleDist params should be an object');
    return;
  }
//configuration option defaults
  this.options = {
    bins: 10,
    population: [0,1,2,3,4],
    boxContents: [0,1,2,3,4].join('\n'),
    showBoxHist: true,
    showPopulation: true,
    populationType: BOX,
    dataSets: [UNIFORM, BOX, NORMAL],
    sources: "all",
    variables: "all",
    startsWith: null,
    statisticTypes: [['Sample Chi-Squared', CHISQUARE], ['Sample Mean', MEAN], ['Sample t', T], ['Sample Sum', SUM], ['Sample S-Squared', SSQ]],
    statisticType: SUM,
    withReplacement: true,
    sampleSize: 5,
    samplesToTake: 1,
    boxEditable: true,
    toggleVar: true,
    replaceControl: true,
    statLabels: true,
    binControls: true,
    curveTypes: [['No Curve', NO_CURVE], ['Normal Curve', NORMAL_CURVE], ['Student t Curve', STUDENT_T_CURVE], ['Chi-Squared Curve', CHI_SQUARED_CURVE]],
    hiLiteLo: null,
    hiLiteHi: null,
    showCurve: true,
    curveChoice: NO_CURVE
  };

  this.xMin = 0;
  this.xMax = 10;
  this.popMin = null;
  this.popMax = null;
  this.popMean = null;
  this.popSd = null;
  this.samplesSoFar = 0;
  this.sampleMean = [];
  this.sampleSum = [];
  this.sampleSsq = [];
  this.sampleT = [];
  this.binEnd = [];
  this.sampleBinCounts = null;
  this.mu = 0;
  this.sd = 0;
  this.se = 0;
  this.ex = 0;
  this.curveYFunction = function(d) { return d; };

  // Various handles to important jQuery objects.
  //some of these might not be needed????
  this.overlayDiv = jQuery('<div/>');
  this.replacementCheckbox = null;
  this.statisticSelect = null;
  this.dataSelect = null;
  this.popTextLabel = "Population";
  this.stashedBoxPopulation = [0,1,2,3,4];
  this.sourceList = [UNIFORM, BOX, NORMAL];
  this.sourceChoices = null;
  this.areaFromInput = null;
  this.areaFromSlider = null;
  this.areaToInput = null;
  this.areaToSlider = null;
  this.areaInfoSpan = null;
  this.curveInfoSpan = null;
    // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

  // jQuery object containing the entire chart.
  this.container = jQuery('#' + container_id);

  this.reloadChart = function() {
    self.areaFromSlider.slider('option', 'min', self.binEnd.min());
    self.areaFromSlider.slider('option', 'max', self.binEnd.max());
    if (self.options.hiLiteLo === null) {
      self.areaFromSlider.slider('option', 'value', self.binEnd.min());
      self.areaFromInput.val(self.binEnd.min());
    } else {
      self.areaFromSlider.slider('option', 'value', self.options.hiLiteLo);
      self.areaFromInput.val(self.options.hiLiteLo);
    }
    self.areaToSlider.slider('option', 'min', self.binEnd.min());
    self.areaToSlider.slider('option', 'max', self.binEnd.max());
    if (self.options.hiLiteHi === null) {
      self.areaToSlider.slider('option', 'value', self.binEnd.min());
      self.areaToInput.val(self.binEnd.min());
    } else {
      self.areaToSlider.slider('option', 'value', self.options.hiLiteHi);
      self.areaToInput.val(self.options.hiLiteHi);
    }
    getPopStats();
    refreshStatsBox();
    redrawChart();
    refreshSelectedAreaOverlay();
  };

function initData() {
  getPopStats();
  setLims();
  setPopulation();
  setupNormalCurveData();
}

function setupNormalCurveData() {
  if (self.options.statisticType == MEAN) {
    self.mu = self.popMean;
    self.sd = self.popSd;
  } else if (self.options.statisticType == SUM) {
    self.mu = self.popMean * self.options.sampleSize;
    self.sd = self.popSd;
  } else if (self.options.statisticType == SSQ) {
    if (self.options.withReplacement) {
      self.mu = self.popSd*self.popSd;
    } else {
      self.mu = (self.mu)*(self.options.population.length)/(self.options.population.length - 1);
    }
    self.sd = Math.sqrt(2.0/(self.options.sampleSize-1))*self.popSd*self.popSd;
  } else if (self.options.statisticType == CHISQUARE) {
    self.mu = self.options.population.length - 1;
    self.sd = Math.sqrt(2.0*(self.options.population.length - 1.0));
  } else if (self.options.statisticType == T) {
    self.mu = 0;
    if (self.options.sampleSize > 2) {
      self.sd = self.options.sampleSize/(self.options.sampleSize-2);
    } else {
      self.sd = NaN;
    }
  }
}

function setPopTextLabel() {
  if (self.options.statisticType == CHISQUARE) {
    self.popTextLabel = "Category Probabilities";
  } else {
    self.popTextLabel = "Population";
  }
  if (self.options.populationType == BOX) {
    self.options.boxContents = self.options.population.join('\n');
  }
}

function getPopStats() {
  nPop = self.options.population.length;
  fpc = 1.0;
  if (!self.options.withReplacement) {
    fpc = Math.sqrt( (nPop - self.options.sampleSize + 0.0)/(nPop-1.0));
  }
  if (self.options.populationType == BOX) {
    pop = self.options.population;
  } else if (self.options.populationType == NORMAL) {
    pop = [-4, 4];
  } else if (self.options.populationType == UNIFORM) {
    pop = [0,1];
  }
  self.popMin = pop.min();
  self.popMax = pop.max();
  nPop = self.options.population.length;

  if (self.options.populationType == BOX) {
    self.popMean = mean(self.options.population);
    self.popSd = sd(self.options.population);
  } else if (self.options.populationType == NORMAL) {
    self.popMean = 0;
    self.popSd = 1;
  } else if (self.options.populationType == UNIFORM) {
    self.popMean = 0.5;
    self.popSd = Math.sqrt(1.0/12.0);
  }

  if (self.options.statisticType == SUM) {
    self.ex = self.options.sampleSize * self.popMean;
    self.se = fpc*self.popSd*Math.sqrt(self.options.sampleSize);
  } else if (self.options.statisticType == MEAN) {
    self.ex = self.popMean;
    self.se = fpc*(self.popSd)*Math.sqrt(self.options.sampleSize);
  } else if (self.options.statisticType == T) {
    self.ex = self.popMean;
    if (self.options.sampleSize > 2) {
      self.se = Math.sqrt((self.options.sampleSize + 0.0)/(self.options.sampleSize - 2.0));
    } else {
      self.se = NaN;
    }
  } else if (self.options.statisticType == SSQ) {
    if (self.options.withReplacement) {
      self.ex = (self.popSd)*(self.popSd);
    } else {
      self.ex = (self.popSd)*(self.popSd)*nPop/nPop-1;
    }
    self.se = Math.sqrt(2.0/(self.options.sampleSize-1.0))*(self.popSd)*(self.popSd);
  } else if (self.options.statisticType == CHISQUARE) {
    self.ex = nPop;
    self.se = Math.sqrt(2.0*(nPop-1.0));
  }
}

function getUniformPopulation() {
  var population = [];
  for(var i=0; i < self.options.bins; i++) {
    midPt = (self.binEnd[i]+self.binEnd[i+1])/2;
    if (midPt >= 0 && midPt <= 1) {
      population.push(midPt);
    }
  }
  return population;
}

function getNormalPopulation() {
  var normalPopulation = [];
  for(var i=0; i < self.options.bins; i++) {

    count = (normCdf(self.binEnd[i+1]) - normCdf(self.binEnd[i]))/(self.binEnd[i+1] - self.binEnd[i]);
    count = Math.round(count * 100);
    while (count > 0) {
      normalPopulation.push(self.binEnd[i]);
      count--;
    }
  }
  return normalPopulation;
}

function getBoxPopulation() {
  return jQuery("#population").val().split('\n')
            .map(function(i) { return parseFloat(i, 10); })
            .filter(function(i) { return !isNaN(i); });
}

function setPopulation() {
  var population = [];
  if (self.options.populationType == BOX) {
    population = getBoxPopulation();
  } else if (self.options.populationType == UNIFORM) {
    population = getUniformPopulation();
  } else if (self.options.populationType == NORMAL) {
    population = getNormalPopulation();
  }
  self.options.population = population;
}

function setLims() {
  getPopStats();

  if (self.options.statisticType == SUM) {
    self.xMin = self.options.sampleSize * self.popMin;
    self.xMax = self.options.sampleSize * self.popMax;
  } else if (self.options.statisticType == CHISQUARE) {
    self.xMin = 0;
    self.xMax = 10*Math.sqrt(self.options.population.length - 1); //5 SD
  } else if (self.options.statisticType == SSQ) {
    self.xMin = 0.0;
    var maxDev = Math.max(self.popMean - self.popMin, self.popMax - self.popMean);
    self.xMax = 3*maxDev*maxDev/Math.sqrt(self.options.sampleSize);
  } else if (self.options.statisticType == MEAN) {
    self.xMin = (self.popMean-4*self.popSd)/Math.sqrt(self.options.sampleSize);
    //console.log("mean xmin " + self.xMin);
    //self.xMin = -0.1;
    self.xMax = (self.popMax+4*self.popSd)/Math.sqrt(self.options.sampleSize);
  } else if (self.options.statisticType == T) {
    if (self.options.sampleSize > 2) {
      self.xMin = -3*Math.sqrt((self.options.sampleSize+0.0)/(self.options.sampleSize - 2.0));
      self.xMax = 3*Math.sqrt((self.options.sampleSize+0.0)/(self.options.sampleSize - 2.0));
    } else {
      self.xMin = -5;
      self.xMax = 5;
    }
  }
  if (self.showBoxHist) {
    self.xMin = Math.min(self.popMin, self.xMin);
    self.xMax = Math.max(self.popMax, self.xMax);
  }
  self.binEnd = histMakeBins(self.options.bins, [self.xMin, self.xMax]);
}

function refreshStatsBox() {
  if (self.options.statLabels) {
    if (self.options.statisticType == SUM) {
      statExpText = "E(sum): " + Number(self.ex).toFixed(2);
      statSEText = "SE(sum): " + Number(self.se).toFixed(2);
      statSampleMeanText = "Mean(values): " + Number(mean(self.sampleMean)).toFixed(4);
      statSampleSDText = "SD(values): " + Number(sd(self.sampleMean)).toFixed(4);
    } else if (self.options.statisticType == MEAN) {
      statExpText = "E(mean): " + Number(self.ex).toFixed(2);
      statSEText = "SE(mean): " + Number(self.se).toFixed(2);
      statSampleMeanText = "Mean(values): " + Number(mean(self.sampleMean)).toFixed(4);
      statSampleSDText = "SD(values): " + Number(sd(self.sampleMean)).toFixed(4);
    } else if (self.options.statisticType == T) {
      statExpText = "E(t): " + Number(self.ex).toFixed(2);
      statSEText = "SE(t): " + Number(self.se).toFixed(2);
      statSampleMeanText = "Mean(values): " + Number(mean(self.sampleT)).toFixed(4);
      statSampleSDText = "SD(values): " + Number(sd(self.sampleT)).toFixed(4);
    } else if (self.options.statisticType == SSQ) {
      statExpText = "E(S-squared): " + Number(self.ex).toFixed(2);
      statSEText = "df: " +  (self.options.sampleSize-1);
      statSampleMeanText = "Mean(values): " + Number(mean(self.sampleSsq)).toFixed(4);
      statSampleSDText = "SD(values): " + Number(sd(self.sampleSsq)).toFixed(4);
    } else if (self.options.statisticType == CHISQUARE) {
      statExpText = "df: " + Number(self.ex).toFixed(2);
      statSEText = "     ";
      statSampleMeanText = "Mean(values): " + Number(mean(self.sampleSsq)).toFixed(4);
      statSampleSDText = "SD(values): " + Number(sd(self.sampleSsq)).toFixed(4);
    }

    if (self.samplesSoFar === 0) {
      statSampleMeanText = "Mean(values): NaN";
      statSampleSDText = "SD(values): NaN";
    }

    if (self.options.statisticType == CHISQUARE) {
      //note this only works for box
      popMeanText = "Categories: " + self.options.population.length;
      popSdText = "E(Chi-Squared): " + (self.options.population.length - 1);
    } else {
      popMeanText = "Ave(Box): " + Number(self.popMean).toFixed(2);
      popSdText = "Sd(Box): " + Number(self.popSd).toFixed(2);
    }

    samplesSoFarText = "Samples: " + self.samplesSoFar;

    var statsTextLines = [popMeanText, popSdText, statExpText, statSEText, statSampleMeanText, statSampleSDText, samplesSoFarText];

    self.statsBox.children().remove();
    var list = jQuery('<ul/>');
    statsTextLines.map(function(l) { list.append(jQuery('<li/>').text(l)); });
    self.statsBox.append(list);
  }
}

function resetSamples() {
  self.samplesSoFar = 0;
  self.sampleMean = [];
  self.sampleSum = [];
  self.sampleSsq = [];
  self.sampleT = [];
  refreshStatsBox();
  redrawChart();
}

function drawSample() {
  for (var j=0; j < self.options.samplesToTake; j++) {
    var samples = [], indices = [];
    var i, xb = 0, ssq = 0, tStat = 0;
    if (self.options.statisticType == CHISQUARE) {
      if (self.options.populationType != BOX) {
        console.log("can't do that");
      } else {
        var cum = [], count = [];
        for (i=0; i < self.options.population.length; i++) {
          cum[i] = self.options.population[i];
          count[i] = 0;
        }
        cum[0] = self.options.population[0];
        for (i = 1; i < self.options.population.length; i++ ) {
          cum[i] += cum[i-1];
        }
        for (i=0; i < self.options.sampleSize; i++) {
          tmp = Math.random();
          if (tmp <= cum[0]) {
            count[0]++;
          }
          for (k=0; k < count.length; k++) {
            if (tmp > cum[k-1] && tmp <= cum[k]) {
              count[k]++;
            }
          }
        }
        ssq = 0.0;
        for (i=0; i < self.options.population.length; i++) {
          tmp = self.options.sampleSize*(self.options.population[i]);
          ssq += (count[i] - tmp)*(count[i] - tmp)/tmp;
        }
        self.sampleSsq[self.samplesSoFar++] = ssq;
      }
    } else {
      if (self.options.populationType == BOX) {
        if (self.options.withReplacement) {
          indices = listOfRandInts(self.options.sampleSize, 0, self.options.population.length - 1);
        } else {
          indices = listOfDistinctRandInts(self.options.sampleSize, 0, self.options.population.length - 1);
        }

        for (i = 0; i < self.options.sampleSize; i++) {
          samples[i] = self.options.population[ indices[i] ];
          xb += samples[i];
        }
      } else if (self.options.populationType == UNIFORM) {
        for (i = 0; i < self.options.sampleSize; i++) {
          samples[i] = Math.random();
          xb += samples[i];
        }
      } else if (self.options.populationType == NORMAL) {
        for (i = 0; i < self.options.sampleSize; i++) {
          samples[i] = rNorm();
          xb += samples[i];
        }
      }
      xb /= self.options.sampleSize;
      for (i = 0; i < self.options.sampleSize; i++) {
        ssq += (samples[i] - xb) * (samples[i] - xb);
      }
      if (self.options.sampleSize > 1) {
        ssq /= (self.options.sampleSize - 1);
        self.sampleSsq[self.samplesSoFar] = ssq;
        tStat = xb/(Math.sqrt(ssq)/Math.sqrt(self.options.sampleSize));
        self.sampleT[self.samplesSoFar] = tStat;
      } else {
        self.sampleSsq[self.samplesSoFar] = 0;
        self.sampleT[self.samplesSoFar] = 0;
      }

      self.sampleMean[self.samplesSoFar] = xb;
      self.sampleSum[self.samplesSoFar] = xb * self.options.sampleSize;
      self.samplesSoFar++;
    }
  }
}

function normalHiLitArea() {
  area = 0;
  fpc = 1;
  if (!self.options.withReplacement) {
    fpc = Math.sqrt((self.options.population.length - self.options.sampleSize)/(self.options.population - 1));
  }
  if (self.options.hiLiteHi > self.options.hiLiteLo) {
    area = normCdf((self.options.hiLiteHi - self.ex)/(fpc*self.se)) - normCdf((self.options.hiLiteLo - self.ex)/(fpc*self.se));
  }
  return area;
}

function chiHiLitArea() {
  area = 0;
  if (self.options.hiLiteHi > self.options.hiLiteLo) {
    if (self.options.statisticType == SSQ) {
      scale = (self.options.sampleSize - 1.0)/(self.popSd*self.popSd);
      area = chi2Cdf(self.options.sampleSize-1, scale*self.options.hiLiteHi) - chi2Cdf(self.options.sampleSize-1, scale*self.options.hiLiteLo);
    } else if (self.options.statisticType == CHISQUARE) {
      area = chi2Cdf(self.options.population.length - 1, self.options.hiLiteHi) - chi2Cdf(self.options.population.length - 1, self.options.hiLiteLo);
    }
  }
  return area;
}

function tHiLitArea() {
  area = 0;
  if (self.options.hiLiteHi > self.options.hiLiteLo) {
    if (self.options.statisticType == T) {
      area = tCdf(self.options.sampleSize-1, self.options.hiLiteHi) - tCdf(self.options.sampleSize-1, self.options.hiLiteLo);
    }
  }
  return area;
}

var normalCurveY = function(d) {
  var x =
    self.binEnd[0] +
    d * (self.binEnd[self.options.bins] - self.binEnd[0]) / (self.overlayDiv.width() - 1);
  var y = normPdf(self.mu, self.sd, x);
  return y;
};
var chisquaredCurveCSQY = function (d) {
  var x = self.binEnd[0] + d * (self.binEnd[self.options.bins] - self.binEnd[0]) / (self.overlayDiv.width()-1);
  var y = chi2Pdf(self.options.population.length - 1, x);
  return y;
};
var chisquaredCurveSSQY = function(d) {
  popVar = self.popSd*self.popSd;
  if (!self.options.withReplacement) {
    popVar = popVar*self.population.length/(self.population.length -1);
  }
  scale = (self.options.sampleSize - 1)/popVar;
  var x = self.binEnd[0] + d * (self.binEnd[self.options.bins] - self.binEnd[0]) / (self.overlayDiv.width()-1);
  var y = scale*chi2Pdf(self.options.sampleSize-1, x*scale);
  return y;
};
var studentTCurveY = function(d) {
  var x = self.binEnd[0] + d * (self.binEnd[self.options.bins] - self.binEnd[0]) / (self.overlayDiv.width()-1);
  //PbsStat.tPdf(xVal[i], sampleSize-1);
  var y = tPdf(self.options.sampleSize-1, x);
  return y;
};

function redrawChart() {
      setLims();
      var normalChartDiv = jQuery('<div/>').addClass('chart_box');
      self.chartDiv.children().remove();
      self.overlayDiv = normalChartDiv.clone().addClass('overlay');
      var sampleChartDiv = normalChartDiv.clone().addClass('sample_chart');
      self.curveOverlayDiv = jQuery('<div/>').addClass('chart_box');
      self.chartDiv.append(normalChartDiv);
      self.chartDiv.append(sampleChartDiv);
      self.chartDiv.append(self.overlayDiv);
      self.chartDiv.append(self.curveOverlayDiv);
      // Background calculations.
      //maybe this should happen in selector callback?
      var sampleData = [];
      if (self.options.statisticType == MEAN) {
        sampleData = self.sampleMean;
      } else if (self.options.statisticType == SUM) {
        sampleData = self.sampleSum;
      } else if (self.options.statisticType == SSQ || self.options.statisticType == CHISQUARE) {
        sampleData = self.sampleSsq;
      } else if (self.options.statisticType == T) {
        sampleData = self.sampleT;
      }
      var allPops = self.options.population.concat(sampleData);
      var currentBinCounts = histMakeCounts(self.binEnd, allPops);
      var yScale = null;
      var totalDataLength = self.options.population.length + sampleData.length;
      var popBinCounts = histMakeCounts(self.binEnd, self.options.population, totalDataLength);
      yScale = popBinCounts.max();
      if (sampleData.length !== 0) {
        var sampleBinCounts = histMakeCounts(self.binEnd, sampleData, totalDataLength);
        yScale = Math.max(yScale, sampleBinCounts.max());
      }
      var width = self.overlayDiv.width();
      var height = self.overlayDiv.height();
      var graphWidth = self.binEnd.max() - self.binEnd.min();
      yScale /= (height - 1);


      function appendPopulationSvg(div) {
        var popBinCounts = histMakeCounts(self.binEnd, self.options.population);
        if (self.options.population.length !== 0) {
        var svg = d3.select(div.get(0)).append('svg').selectAll('div');
        svg.data(popBinCounts)
          .enter()
          .append('rect')
          .attr('y', function(d) { return height - d / yScale; })
          .attr('height', function(d) { return d / yScale; })
          .attr('x', function(d, i) {
            return (width * (self.binEnd[i] - self.binEnd.min()) /
                    graphWidth);
          })
          .attr('width', function(d, i) {
            return width * (self.binEnd[i + 1] - self.binEnd[i]) /
              graphWidth;
          })
          .attr('class', 'population');
      }
    }
    function appendSamplesSvg(div) {
      if (sampleData.length !== 0) {
        self.sampleBinCounts = histMakeCounts(self.binEnd, sampleData);
        var svg = d3.select(div.get(0)).append('svg').selectAll('div');
        svg.data(self.sampleBinCounts)
          .enter()
          .append('rect')
          .attr('y', function(d) { return height - d / yScale; })
          .attr('height', function(d) { return d / yScale; })
          .attr('x', function(d, i) {
            return (width * (self.binEnd[i] - self.binEnd.min()) /
                    graphWidth);
          })
          .attr('width', function(d, i) {
            return width * (self.binEnd[i + 1] - self.binEnd[i]) /
                  graphWidth;
          })
          .attr('class', 'sample');
      }
    }
      appendSamplesSvg(self.overlayDiv);
      appendSamplesSvg(sampleChartDiv);

      self.overlayDiv.css('clip', 'rect(0px, 0px, ' + height + 'px, 0px)');
      appendPopulationSvg(normalChartDiv);

      var axisSvg = d3.select(normalChartDiv.get(0))
                  .append('svg')
                  .attr('class', 'axis');
      var axisScale = d3.scale.linear()
                              .domain([self.binEnd.min(), self.binEnd.max()])
                              .range([0, width]);
      var axis = d3.svg.axis().scale(axisScale).orient('bottom');
      axisSvg.append('g').call(axis);

      function drawCurve() {
        if (self.options.curveChoice == NO_CURVE) {
          return;
        } else if (self.options.curveChoice == NORMAL_CURVE) {
          curveYFunction = normalCurveY;
        } else if (self.options.curveChoice == CHI_SQUARED_CURVE) {
          if (self.options.statisticType == SSQ) {
            curveYFunction = chisquaredCurveSSQY;
          } else if (self.options.statisticType == CHISQUARE) {
            curveYFunction = chisquaredCurveCSQY;
          }
        } else if (self.options.curveChoice == STUDENT_T_CURVE) {
          curveYFunction = studentTCurveY;
        }
        var normalCurve =
          d3.svg.line()
            .x(function(d) {return d;})
            .y(function(d) {
              return height - (curveYFunction(d) / yScale);
            });
        var normSvg = d3.select(self.curveOverlayDiv.get(0))
                        .append('svg')
                        .attr('height', '100%');
        var normPath = normSvg.append('path');
        normPath.attr('class', 'nrestricted');
        normPath.data([d3.range(0, width)])
          .attr('d', normalCurve);
      }
      drawCurve();
      if (!self.options.showCurve) {
        self.curveOverlayDiv.hide();
      }
      if (!self.options.showPopulation || self.options.statisticType == CHISQUARE) {
        jQuery('.population').toggle();
      }
    }

    function refreshSelectedAreaOverlay() {
      self.options.hiLiteLo = parseFloat(self.areaFromSlider.slider('value'));
      self.options.hiLiteHi = parseFloat(self.areaToSlider.slider('value'));
      var scale = self.chartDiv.width() /
        (self.binEnd.max() - self.binEnd.min());
      var left = (self.options.hiLiteLo - self.binEnd.min()) * scale;
      var right = (self.options.hiLiteHi - self.binEnd.min()) * scale;
      self.overlayDiv.css('clip',
                          'rect(0px,' +
                                right + 'px,' +
                                self.chartDiv.height() + 'px,' +
                                left + 'px)');
      var p = 0;
      if (self.sampleBinCounts !== null) {
        p = histHiLitArea(self.options.hiLiteLo, self.options.hiLiteHi, self.binEnd, self.sampleBinCounts);
      }
      p *= 100;
      var text = 'Selected area: ' + p.fix(2) + '%';
      self.areaInfoSpan.text(text);
      curveText = "";
      if (self.options.curveChoice == NO_CURVE) {
        curveText = "";
      } else if (self.options.curveChoice == NORMAL_CURVE) {
        p = normalHiLitArea() * 100;
        curveText = " Normal approx: " + p.fix(2) + '%';
      } else if (self.options.curveChoice == STUDENT_T_CURVE) {
        p = tHiLitArea() * 100;
        curveText = " Student t approx: " + p.fix(2) + '%';
      } else if (self.options.curveChoice == CHI_SQUARED_CURVE) {
        p = chiHiLitArea() * 100;
        curveText = " Chi-squared approx: " + p.fix(2) + '%';
      }
      self.curveInfoSpan.text(curveText);
    }

    function initControls() {
      var statsBox = jQuery('div#statsText');
      self.statsBox = statsBox;
      refreshStatsBox();
      var o = jQuery('<div/>').addClass('stici').addClass('stici_sampledist');
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
      var rowHeight = 30;  // px
      var topOffset = 0;
      var bottomOffset = 0;
      function appendFooterRow(o) {
        bottom.append(o);
        bottomOffset += rowHeight;
      }

      function createSampleSizeInput() {
        var sampleSizeInput = jQuery('<input type="text" id="sampleSize" />').val(self.options.sampleSize)
          .change(function(e) {
            e.preventDefault();
            self.options.sampleSize = jQuery(this).val();
            resetSamples();
            redrawChart();
          });
        return sampleSizeInput;
      }

      function createSamplesToTakeInput() {
        var samplesToTakeInput = jQuery('<input type="text" id="samplesToTake" />').val(self.options.samplesToTake)
          .change(function(e) {
            e.preventDefault();
            self.options.samplesToTake = jQuery(this).val();
            resetSamples();
            redrawChart();
          });
        return samplesToTakeInput;
      }

      function createBinsInput() {
        var binsInput = jQuery('<input type="text" id="bins" />').val(self.options.bins)
          .change(function(e) {
            e.preventDefault();
            self.options.bins = parseInt(jQuery(this).val(), 10);
            if (self.options.populationType == NORMAL) {
              self.options.population = getNormalPopulation();
            } else if (self.options.populationType == UNIFORM) {
              self.options.population = getUniformPopulation();
            }
            resetSamples();
          });
        return binsInput;
      }

      function createSelectDataSourceControls() {
        var dataSelectControls = jQuery('<div/>');
        if (self.options.toggleVar) {
          self.statisticSelect = jQuery('<select/>').change(function(e) {
            prevStatisticType = self.options.statisticType;
            e.preventDefault();
            if (jQuery(this).val() == CHISQUARE && (self.options.populationType == UNIFORM || self.options.populationType == NORMAL)) {
              self.options.statisticType = MEAN;
              jQuery(this).val(MEAN);
            } else {
              self.options.statisticType = jQuery(this).val();
            }
            if (self.options.statisticType == CHISQUARE) {
              self.stashedBoxPopulation = self.options.population;
              pop = self.options.population;
              pop = pop.filter(function(i) { if (i !== 0 && !isNaN(i)) { return i; }});
              pop = vMult(1/vSum(pop), pop);
              pop = pop.map(function(i) { return parseFloat(Number(i).toFixed(5)); }); //clean up js floating point errors
              self.options.population = pop;

            } else {
              if (self.options.populationType == BOX && prevStatisticType == CHISQUARE) {
                self.options.population = self.stashedBoxPopulation;
              }
            }
            setPopTextLabel();
            drawPopulationArea(jQuery('div#popText'));
            initData();
            self.reloadChart();
          });
          jQuery.each(self.options.statisticTypes, function(i, stat) {
            self.statisticSelect.append(jQuery('<option/>')
                            .attr('value', stat[1])
                            .text(stat[0]));
          });
          self.statisticSelect.val(self.options.statisticType);
        } else {
          self.statisticSelect = "Sample Mean&nbsp;&nbsp;";
        }

        dataSelectControls.append('Distribution of: ').append(self.statisticSelect);
        self.dataSelect = jQuery('<select/>').change(function(e) {
          e.preventDefault(e);
          if (self.options.populationType == BOX) {
            self.stashedBoxPopulation = self.options.population;
          }
          if (jQuery(this).val() == NORMAL) {
            self.options.populationType = NORMAL;
            self.options.boxContents = "Normal";
            if (self.options.statisticType == CHISQUARE) {
              self.options.statisticType = MEAN;
              self.statisticSelect.val(MEAN);
            }
          } else if (jQuery(this).val() == BOX) {
            self.options.populationType = BOX;
            self.options.boxContents = self.stashedBoxPopulation.join('\n');
          } else if (jQuery(this).val() == UNIFORM) {
            self.options.populationType = UNIFORM;
            self.options.boxContents = "Uniform";
            if (self.options.statisticType == CHISQUARE) {
              self.options.statisticType = MEAN;
              self.statisticSelect.val(MEAN);
            }
          }
          drawPopulationArea(jQuery('div#popText'));
          initData();
          resetSamples();
          self.reloadChart();
        });
        jQuery.each(self.sourceChoices, function(i, dataSet) {
          self.dataSelect.append(jQuery('<option/>')
                         .attr('value', dataSet)
                         .text(dataSet));
        });
        if (jQuery.inArray(BOX, self.sourceChoices) != -1) {
          defaultVal = BOX;
        } else {
          defaultVal = self.sourceChoices[0];
        }
        self.dataSelect.val(defaultVal);
        dataSelectControls.append('Sample from: ').append(self.dataSelect);
        if (self.options.replaceControl) {
          self.replacementCheckbox = jQuery('<input type="checkbox" id="withReplacement" />').change(function(e) {
            e.preventDefault();
            self.options.withReplacement = !self.options.withReplacement;
            initData();
            resetSamples();
            self.reloadChart();
          });
          if (self.options.withReplacement) {
            self.replacementCheckbox.attr('checked', true);
          }
          dataSelectControls.append(self.replacementCheckbox).append(' with replacement');
        }
        self.takeSampleButton = jQuery('<button id="takeSample"/>')
        .addClass('open')
        .text('Take Sample').click(function(e) {
          e.preventDefault();
          drawSample();
          self.reloadChart();
        });
        dataSelectControls.append(self.takeSampleButton);
        jQuery('#top_controls').append(dataSelectControls);
      }

      function createPopulationTextArea() {
        self.populationTextArea = jQuery('<textarea id="population">' + self.options.boxContents + '</textarea>')
          .addClass('populationControls');
        if (!self.options.boxEditable) {
          self.populationTextArea.attr("readonly", "readonly");
        }
        self.populationTextArea.change(function(e) {
          e.preventDefault();
          if (self.options.populationType == BOX) {
            self.options.population = getBoxPopulation();
            resetSamples();
            initData();
            self.reloadChart();
          }
        });
      }
      function createPopulationButton() {
        self.showBoxHist = jQuery('<button/>')
                             .addClass('open');
        if (self.options.showPopulation) {
          self.showBoxHist.text('No Population Histogram');
        } else {
          self.showBoxHist.text('Population Histogram');
        }
        self.showBoxHist.click(function(e) {
          e.preventDefault();
          if (self.options.statisticType != CHISQUARE) {
            jQuery('.population').toggle();
            if (!self.options.showPopulation) {
              self.showBoxHist.text('No Population Histogram');
            } else {
              self.showBoxHist.text('Population Histogram');
            }
            self.options.showPopulation = !self.options.showPopulation;
            refreshSelectedAreaOverlay();
          }
        });
        self.areaInfoDiv.css('bottom', bottomOffset + 'px');
        bottom.css('height', bottomOffset + 'px');
        self.chartDiv.css('margin-bottom', (bottomOffset + 15) + 'px');
        self.chartDiv.css('margin-top', (topOffset) + 'px');
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

        appendFooterRow(row);
      }
      function createCurveSelectControls() {
        var curveSelect = jQuery('<select/>').change(function(e) {
          e.preventDefault();
          if (jQuery(this).val() == CHI_SQUARED_CURVE && (self.options.statisticType != SSQ && self.options.statisticType != CHISQUARE)) {
            self.options.curveChoice = NO_CURVE;
            jQuery(this).val(NO_CURVE);
          } else if (jQuery(this).val() == STUDENT_T_CURVE && self.options.statisticType != T) {
            self.options.curveChoice = NO_CURVE;
            jQuery(this).val(NO_CURVE);
          } else {
            self.options.curveChoice = jQuery(this).val();
          }
          self.reloadChart();
        });
        jQuery.each(self.options.curveTypes, function(i, curveChoice) {
          curveSelect.append(jQuery('<option/>')
            .attr('value', curveChoice[1])
            .text(curveChoice[0]));
        });
        curveSelect.val(self.options.curveChoice);
        return curveSelect;
      }

        var row = jQuery('<div/>');
        createSelectDataSourceControls();
        createPopulationButton();
        self.areaInfoSpan = jQuery('<span/>');
        self.curveInfoSpan = jQuery('<span/>');
        if (self.options.showBoxHist) {
          row.append(self.areaInfoSpan);
          row.append(self.curveInfoSpan);
          row.append(createCurveSelectControls());
          row.append(self.showBoxHist);
        }

        function drawPopulationArea(div) {
          createPopulationTextArea();
          div.html("");
          div.append(self.populationTextArea);
          div.append(self.popTextLabel);
        }

        drawPopulationArea(jQuery('div#popText'));

        var sampleFooterRow = jQuery('<div/>');
        sampleFooterRow.append("Sample Size: ");
        sampleFooterRow.append(createSampleSizeInput());
        sampleFooterRow.append(" Take ");
        sampleFooterRow.append(createSamplesToTakeInput());
        sampleFooterRow.append("samples. ");
        if (self.options.binControls) {
          sampleFooterRow.append(" Bins: ");
          sampleFooterRow.append(createBinsInput());
        }
        if (row.children().length > 0) {
          appendFooterRow(row);
          createAreaSelectControls();
          appendFooterRow(sampleFooterRow);
        }
        self.areaInfoDiv.css('bottom', bottomOffset + 'px');
        bottom.css('height', bottomOffset + 'px');
        self.chartDiv.css('margin-bottom', (bottomOffset + 15) + 'px');
        self.chartDiv.css('margin-top', (topOffset) + 'px');

    }

  var sources = self.options.sources.split('\n\t');
  if (sources.length > 0) {
    if (jQuery.inArray('all', sources) != -1) {
      self.sourceChoices = self.sourceList;
    } else {
      self.sourceChoices = sources.filter(function(s) { if(jQuery.inArray(s,self.sourceList) != -1) { return s; }});
    }
  } else {
    self.sourceChoices = self.sourceList;
  }

  initControls();
  initData();
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
Number.prototype.fix = function(n) {
  return parseFloat(this.toFixed(n));
};
Number.prototype.pct = function() {
  return (100 * this).fix(2) + '%';
};

// Includes lo, excludes hi.
function range(lo, hi) {
  var seq = [];
  for (var i = lo; i < hi; i++)
    seq.push(i);
  return seq;
}

var rmin = 2.3e-308;
var eps = 2.3e-16;

// ============================================================================
// ========================= STATISTICAL SUBROUTINES ==========================

function mean(list, n) { // computes the mean of the list
  if (n !== undefined)
    list = list.slice(0, n);

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

function sd(list, n) { // computes the SD of the list
  if (n !== undefined)
    list = list.slice(0, n);

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

function histMakeCounts(binEnd, data, fulllength) {  // makes vector of histogram heights
        if (!fulllength) {
            fulllength = data.length;
        }
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
           counts[i] /= fulllength*(binEnd[i+1]-binEnd[i]);
        }
        return(counts);
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

function normHiLitArea(loEnd, hiEnd, sampleSize, nPop, EX, SE, replacement) {
    var area = 0;
    var fpc = 1.0;
    if (!replacement) {
        fpc = Math.sqrt( (nPop - sampleSize + 0.0)/(nPop-1.0));
    }
    if (hiEnd > loEnd) {
        area = normCdf((hiEnd - EX)/(fpc*SE)) - normCdf((loEnd - EX)/(fpc*SE));
    }
    return(area);
}

function chiHiLitArea(loEnd, hiEnd, sampleSize, pop, popSd, sampleType) {
    var area = 0;
    if (hiEnd > loEnd) {
        if (varChoice.getSelectedItem().equals("Sample S-Squared")) {
            var scale = (sampleSize - 1.0)/(popSd*popSd);
            area = PbsStat.chi2Cdf(scale*hiEnd, sampleSize-1) -
                PbsStat.chi2Cdf(scale*loEnd, sampleSize-1);
        } else if (varChoice.getSelectedItem().equals("Sample Chi-Squared")) {
            area = PbsStat.chi2Cdf(hiEnd, pop.length-1) -
                PbsStat.chi2Cdf(loEnd, pop.length-1);
        } else {
            console.log("Error in SampleDist.chiHiLitArea(): " + varChoice.getSelectedItem() +
                        " not supported. ");
            area = 0.0;
        }
    }
    return(area);
}

function tHiLitArea(loEnd, hiEnd) {
    var area = 0;
    if (hiEnd > loEnd) {
        if (varChoice.getSelectedItem().equals("Sample t")) {
            area = PbsStat.tCdf(hiEnd, sampleSize-1) -
                PbsStat.tCdf(loEnd, sampleSize-1);
        } else {
            console.log("Error in SampleDist.tHiLitArea(): " + varChoice.getSelectedItem() +
                        " not supported. ");
            area = 0.0;
        }
    }
    return(area);
}

function histSetBins(nBins, xMin, xMax) {
    var binEnd = new Array(nBins+1);
    for (var i=0; i < nBins+1; i++) {
        binEnd[i] = xMin + i*(xMax - xMin)/nBins;
    }
    return binEnd;
}

function histMakeBins(nBins, data) { // makes equispaced histogram bins that span the range of data
        binEnd = new Array(nBins+1);
        dMnMx = vMinMax(data);
        for (var i=0; i < nBins+1; i++) {
           binEnd[i] = dMnMx[0] + i*(dMnMx[1] - dMnMx[0])/nBins;
        }
        return(binEnd);
}

function listToHist(list, binEnd, nBins, lim) {
    // lim is an optional paramater, defaulting to list.length if not set
    lim = lim || list.length;
    c = new Array(nBins);
    var i;
    for (i = 0; i < nBins; i++) {
        c[i] = 0;
    }
    var mass = 1.0/lim;
    for (i = 0; i < lim; i++) {
        for (var j = 0; j < nBins - 1; j++) {
            if (list[i] >= binEnd[j] && list[i] < binEnd[j+1]) {
                c[j] += mass/(binEnd[j+1] - binEnd[j]);
            }
        }
        if (list[i] >= binEnd[nBins - 1] && list[i] <= binEnd[nBins]) {
            c[nBins-1] += mass/(binEnd[nBins] - binEnd[nBins - 1]);
        }
    }
    return(c);
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

function scalVMult(s, v) {
  var ans = new Array(v.length);
  for (var i=0; i < v.length; i++) {
    ans[i] = s*v[i];
  }
  return(ans);
}

function vCumSum(x) {  // cumulative sum of vector
  ans = new Array(x.length);
  ans[0] = x[0];
  for (var i=1; i < x.length; i++) {
    ans[i] = ans[i-1] + x[i];
  }
  return(ans);
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
  var buttons = jQuery('<div/>',{id:container_id + 'buttons'}).addClass('buttons');
  var scrollbars = jQuery('<div/>',{id:container_id + 'scrollbars'}).addClass('scrollbars');

  app.append(self.container);
  app.append(buttons);
  app.append(scrollbars);

  this.container.css('width',(this.env.width() - buttons.width()) + 'px');
  this.container.css('height', (this.env.height() - scrollbars.height()) + 'px');

  var s_outline, a_outline, b_outline;
  var a_fill, b_fill, ab_fill;
  var ab_text, a_or_b_text;

  // Create all of the html objects so we can get handles to them and all. Then
  // create the controls.
  draw();

  // Array of row arrays. E.g.:
  //
  // A B C
  // X Y C
  //
  // Is represented as
  // [[A, B, C],
  //  [X, Y, Z]]
  var button_args = [
    [{label: 'A', filled: a_fill},
     {label: 'Ac', filled: s_outline, opaque: a_fill}],

    [{label: 'B', filled: b_fill},
     {label: 'Bc', filled: s_outline, opaque: b_fill}],

    [{label: 'A or B', filled: [a_fill, b_fill]},
     {label: 'AB', filled: ab_fill}],

    [{label: 'ABc', filled: a_fill, opaque: ab_fill},
     {label: 'AcB', filled: b_fill, opaque: ab_fill}],

    [{label: 'S', filled: s_outline},
     {label: '{}'}]
  ];
  $.each(button_args, function(i, button_row) {
    var row = jQuery('<div/>').addClass('button_row');
    $.each(button_row, function(i, button) {
      button.label = button.label.replace(/c/g, '<sup>c</sup>');
      button.label = button.label.replace(/\|/g, '&nbsp;|&nbsp;');
      button.label = button.label.replace(/ or /g, '&nbsp;\u222A&nbsp;');

      var button_div = jQuery('<div/>').addClass('button');
      row.append(button_div);
      var inp = jQuery('<input/>',{type:'radio',name:'buttons'});
      var label = jQuery('<label/>').click(function() {inp.prop('checked', true);});
      button_div.click(function() {
        inp.prop('checked', true);
        a_outline.removeClass('selected opaque');
        b_outline.removeClass('selected opaque');
        a_fill.removeClass('selected opaque');
        b_fill.removeClass('selected opaque');
        ab_fill.removeClass('selected opaque');
        s_outline.removeClass('selected opaque');

        if (button.opaque !== undefined) {
          if (!button.opaque instanceof Array)
            button.opaque = [button.opaque];
          $.each(button.opaque, function(i, opaque_element) {
            jQuery(opaque_element).addClass('opaque');
          });
        }
        if (button.filled !== undefined) {
          if (!button.filled instanceof Array)
            button.filled = [button.filled];
          $.each(button.filled, function(i, fill_element) {
            jQuery(fill_element).addClass('selected');
          });
        }
      });
      label.html(button.label);
      button_div.append(inp);
      button_div.append(label);
    });
    buttons.append(row);
  });
  function createPercentControl(letter, size) {
    var sb = jQuery('<div/>',{id:container_id + 'psb' + letter}).addClass('scrollbar');
    var lbl = jQuery('<label/>').attr('for', container_id + 'sb'+letter);
    lbl.html('P(' + letter + ') (%)');
    var idFunc1 = function() {
      $('#' + container_id + 'sb' + letter).slider('value', this.value);
      updateSizes();
    };
    var idFunc2 = function() {
      $('#' + container_id + 'sb' + letter + 't').val($(this).slider('value'));
      updateSizes();
    };
    var input = jQuery('<input/>', {
      type: 'text',
      id: container_id + 'sb'+letter+'t',
      change: idFunc1,
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

  updateSizes();

  // Synchronizes fill positions so that the outline is always visible on the A
  // and B boxes, and the intersection area is synchronized.
  function syncPositions() {
    // Make sure everything stays in bounds.
    function bound(outline) {
      var x_offset = outline.offset().left + outline.width() -
        (s_outline.offset().left + s_outline.width());
      if (x_offset > 0)
        outline.css('left', (outline.position().left - x_offset) + 'px');
      var y_offset = outline.offset().top + outline.height() -
        (s_outline.offset().top + s_outline.height());
      if (y_offset > 0)
        outline.css('top', (outline.position().top - y_offset) + 'px');

      if (outline.position().left < s_outline.position().left)
        outline.css('left', s_outline.position().left + 'px');
      if (outline.position().top < s_outline.position().top)
        outline.css('top', s_outline.position().top + 'px');
    }
    function intersect(a, b, ab) {
      var a_x = a.position().left;
      var a_y = a.position().top;
      var a_w = a.width();
      var a_h = a.height();
      var b_x = b.position().left;
      var b_y = b.position().top;
      var b_w = b.width();
      var b_h = b.height();
      if (a_x + a_w < b_x || b_x + b_w < a_x ||
          a_y + a_h < b_y || b_y + b_h < a_y) {
        ab.css('display', 'none');
      } else {
        ab.css('display', '');
        var x1 = Math.max(a_x, b_x);
        var y1 = Math.max(a_y, b_y);
        ab.css('left', x1 + 'px');
        ab.css('top', y1 + 'px');
        var x2 = Math.min(a_x + a_w, b_x + b_w);
        var y2 = Math.min(a_y + a_h, b_y + b_h);
        ab.css('width', (x2 - x1) + 'px');
        ab.css('height', (y2 - y1) + 'px');
      }
    }
    bound(a_outline);
    bound(b_outline);

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
    intersect(a_outline, b_outline, ab_fill);

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

  // Updates the sizes of A and B to what the slider specifies.
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

  function draw() {
    // Initial sizes. These will get overwritten as soon as updateSizes is
    // called.
    var scaleFactorX = 0.3;
    var scaleFactorY = 0.3;

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
  }
}

// Javascript implementation of venn diagram for sticigui. No params are
// currently available.
//
// container_id: the CSS ID of the container to create the venn diagram (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  // Whether or not to render the conditional probability radio buttons.
//  - showConditional: false
//
//  // Whether or not to show the P= labels
//  - showProbabilities: true

function Stici_Venn3(container_id, params) {
  var self = this;

  this.env = jQuery('#' + container_id);
  var app = jQuery('<div/>',{id:container_id + 'app'})
              .addClass('stici_venn')
              .addClass('stici_venn3')
              .addClass('stici');
  this.env.append(app);


  // Configuration option defaults.
  this.options = {
    showConditional: false,
    showProbabilities: true
  };

  // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

  this.container = jQuery('<div/>',{id:container_id + 'container'}).addClass('container');
  var buttons_div = jQuery('<div/>',{id:container_id + 'buttons'}).addClass('buttons');
  var scrollbars = jQuery('<div/>',{id:container_id + 'scrollbars'}).addClass('scrollbars');

  app.append(self.container);
  app.append(buttons_div);
  app.append(scrollbars);

  this.container.css('width',(this.env.width() - buttons_div.width()) + 'px');
  this.container.css('height', (this.env.height() - scrollbars.height()) + 'px');

  var s_outline, a_outline, b_outline, c_outline;
  var a_fill, b_fill, c_fill, ab_fill, ac_fill, bc_fill, abc_fill;

  // Create all of the html objects so we can get handles to them and all. Then
  // create the controls.
  draw();

  // Array of row arrays. E.g.:
  //
  // A B C
  // X Y C
  //
  // Is represented as
  // [[A, B, C],
  //  [X, Y, Z]]
  this.buttons_arr = [
    [{label: 'A', filled: a_fill},
     {label: 'B', filled: b_fill},
     {label: 'C', filled: c_fill},
     {label: 'Ac', filled: s_outline, opaque: a_fill}],

    [{label: 'Bc', filled: s_outline, opaque: b_fill},
     {label: 'Cc', filled: s_outline, opaque: c_fill},
     {label: 'AB', filled: ab_fill},
     {label: 'AC', filled: ac_fill}],

    [{label: 'BC', filled: bc_fill},
     {label: 'A or B', filled: [a_fill, b_fill]},
     {label: 'A or C', filled: [a_fill, c_fill]},
     {label: 'B or C', filled: [b_fill, c_fill]}],

    [{label: 'ABC', filled: abc_fill},
     {label: 'A or B or C', filled: [a_fill, b_fill, c_fill]},
     {label: 'ABc', filled: a_fill, opaque: ab_fill},
     {label: 'AcB', filled: b_fill, opaque: ab_fill}],

    [{label: 'AcBC', filled: bc_fill, opaque: abc_fill},
     {label: 'Ac or BC', filled: [bc_fill, s_outline], opaque: a_fill},
     {label: 'S', filled: s_outline},
     {label: '{}'}]
  ];

  if (this.options.showConditional) {
    self.buttons_arr.push(
      [{label: 'P(A|B)', filled: b_fill, hilite: ab_fill},
       {label: 'P(Ac|B)', filled: ab_fill, hilite: b_fill},
       {label: 'P(B|A)', filled: a_fill, hilite: ab_fill}]);

    self.buttons_arr.push(
      [{label: 'P(A|BC)', filled: bc_fill, hilite: abc_fill},
       {label: 'P(Ac|BC)', filled: abc_fill, hilite: bc_fill},
       {label: 'P(A|(B or C))', filled: [b_fill, c_fill], hilite: [ab_fill, ac_fill]}]);
  }

  self.buttons = {};
  self.buttons_arr = $.map(self.buttons_arr, function(button_row) {
    var row = jQuery('<div/>').addClass('button_row');
    button_row = $.map(button_row, function(button) {
      button.human_label = button.label;
      button.label = button.label.replace(/c/g, '<sup>c</sup>');
      button.label = button.label.replace(/\|/g, '&nbsp;|&nbsp;');
      button.label = button.label.replace(/ or /g, '&nbsp;\u222A&nbsp;');

      if (button.opaque !== undefined) {
        if (!(button.opaque instanceof Array))
          button.opaque = [button.opaque];
      } else {
        button.opaque = [];
      }
      if (button.filled !== undefined) {
        if (!(button.filled instanceof Array))
          button.filled = [button.filled];
      } else {
        button.filled = [];
      }
      if (button.hilite !== undefined) {
        if (!(button.hilite instanceof Array))
          button.hilite = [button.hilite];
      } else {
        button.hilite = [];
      }

      var button_div = jQuery('<div/>').addClass('button');
      button.div = button_div;
      row.append(button_div);
      var inp = jQuery('<input/>',{type:'radio',name:'buttons'});
      var label = jQuery('<label/>').click(function() {inp.prop('checked', true);});
      button_div.click(function() {
        inp.prop('checked', true);
        a_outline.removeClass('selected opaque hilite');
        b_outline.removeClass('selected opaque hilite');
        c_outline.removeClass('selected opaque hilite');
        a_fill.removeClass('selected opaque hilite');
        b_fill.removeClass('selected opaque hilite');
        c_fill.removeClass('selected opaque hilite');
        ab_fill.removeClass('selected opaque hilite');
        bc_fill.removeClass('selected opaque hilite');
        ac_fill.removeClass('selected opaque hilite');
        abc_fill.removeClass('selected opaque hilite');
        s_outline.removeClass('selected opaque hilite');

        $.each(button.opaque, function(i, opaque_element) {
          jQuery(opaque_element).addClass('opaque');
        });
        $.each(button.filled, function(i, fill_element) {
          jQuery(fill_element).addClass('selected');
        });
        $.each(button.hilite, function(i, fill_element) {
          jQuery(fill_element).addClass('hilite');
        });
      });
      label.html(button.label);
      var prob_span = jQuery('<div/>');
      label.append(prob_span);

      button.p = function(p) {
        if (isNaN(p))
          p = 0;
        prob_span.text(' (P = ' + (p / s_outline.area() * 100).fix(1) + '%)');
      };

      button_div.append(inp);
      button_div.append(label);

      self.buttons[button.human_label] = button;
      return button;
    });
    buttons_div.append(row);
    return button_row;
  });

  function createPercentControl(letter, size) {
    var sb = jQuery('<div/>',{id:container_id + 'psb' + letter}).addClass('scrollbar');
    var lbl = jQuery('<label/>').attr('for', container_id + 'sb'+letter);
    lbl.html('P(' + letter + ') (%)');
    var idFunc1 = function() {
      $('#' + container_id + 'sb' + letter).slider('value', this.value);
      updateSizes();
    };
    var idFunc2 = function() {
      $('#' + container_id + 'sb' + letter + 't').val($(this).slider('value'));
      updateSizes();
    };
    var input = jQuery('<input/>', {
      type: 'text',
      id: container_id + 'sb'+letter+'t',
      change: idFunc1,
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
  createPercentControl('C', 10);

  updateSizes();

  function createBox() {
    var box = jQuery('<div/>').addClass('box');
    box.area = function() {
      if (box.css('display') == 'none')
        return 0;

      if (a_outline.isSameBox(box))
        return $('#' + container_id + 'sbA').slider('value') / 100 *
          s_outline.area();
      if (b_outline.isSameBox(box))
        return $('#' + container_id + 'sbB').slider('value') / 100 *
          s_outline.area();
      if (c_outline.isSameBox(box))
        return $('#' + container_id + 'sbC').slider('value') / 100 *
          s_outline.area();

      return box.width() * box.height();
    };
    box.x = function() {
      return box.position().left;
    };
    box.y = function() {
      return box.position().top;
    };
    box.isSameBox = function(other) {
      return box.y() == other.y() &&
             box.x() == other.x() &&
             box.width() == other.width() &&
             box.height() == other.height();
    };
    return box;
  }

  // Synchronizes fill positions so that the outline is always visible on the A
  // and B boxes, and the intersection area is synchronized.
  function syncPositions() {
    // Make sure everything stays in bounds.
    function bound(outline) {
      var x_offset = outline.offset().left + outline.width() -
        (s_outline.offset().left + s_outline.width());
      if (x_offset > 0)
        outline.css('left', (outline.position().left - x_offset) + 'px');
      var y_offset = outline.offset().top + outline.height() -
        (s_outline.offset().top + s_outline.height());
      if (y_offset > 0)
        outline.css('top', (outline.position().top - y_offset) + 'px');

      if (outline.position().left < s_outline.position().left)
        outline.css('left', s_outline.position().left + 'px');
      if (outline.position().top < s_outline.position().top)
        outline.css('top', s_outline.position().top + 'px');
    }
    function intersect(a, b, ab) {
      if (ab === undefined) {
        ab = createBox();
      }

      var a_x = a.position().left;
      var a_y = a.position().top;
      var a_w = a.width();
      var a_h = a.height();
      var b_x = b.position().left;
      var b_y = b.position().top;
      var b_w = b.width();
      var b_h = b.height();
      if (a_x + a_w < b_x || b_x + b_w < a_x ||
          a_y + a_h < b_y || b_y + b_h < a_y) {
        ab.css('display', 'none');
      } else {
        ab.css('display', '');
        var x1 = Math.max(a_x, b_x);
        var y1 = Math.max(a_y, b_y);
        ab.css('left', x1 + 'px');
        ab.css('top', y1 + 'px');
        var x2 = Math.min(a_x + a_w, b_x + b_w);
        var y2 = Math.min(a_y + a_h, b_y + b_h);
        ab.css('width', (x2 - x1) + 'px');
        ab.css('height', (y2 - y1) + 'px');
      }

      return ab;
    }
    bound(a_outline);
    bound(b_outline);
    bound(c_outline);

    // Synchronize the fills with the outlines.
    a_fill.css('left', a_outline.css('left'));
    a_fill.css('top', a_outline.css('top'));
    a_fill.css('width', a_outline.css('width'));
    a_fill.css('height', a_outline.css('height'));

    b_fill.css('left', b_outline.css('left'));
    b_fill.css('top', b_outline.css('top'));
    b_fill.css('width', b_outline.css('width'));
    b_fill.css('height', b_outline.css('height'));

    c_fill.css('left', c_outline.css('left'));
    c_fill.css('top', c_outline.css('top'));
    c_fill.css('width', c_outline.css('width'));
    c_fill.css('height', c_outline.css('height'));

    // Calculate the intersection.
    intersect(a_outline, b_outline, ab_fill);
    intersect(b_outline, c_outline, bc_fill);
    intersect(a_outline, c_outline, ac_fill);
    intersect(ab_fill, bc_fill, abc_fill);

    if (self.options.showProbabilities) {
      self.buttons['A'].p(a_outline.area());
      self.buttons['B'].p(b_outline.area());
      self.buttons['C'].p(c_outline.area());
      self.buttons['Ac'].p(s_outline.area() - a_outline.area());
      self.buttons['Bc'].p(s_outline.area() - b_outline.area());
      self.buttons['Cc'].p(s_outline.area() - c_outline.area());
      self.buttons['AB'].p(ab_fill.area());
      self.buttons['AC'].p(ac_fill.area());
      self.buttons['BC'].p(bc_fill.area());
      self.buttons['A or B'].p(
        a_outline.area() + b_outline.area() - ab_fill.area());
      self.buttons['A or C'].p(
        a_outline.area() + c_outline.area() - ac_fill.area());
      self.buttons['B or C'].p(
        b_outline.area() + c_outline.area() - bc_fill.area());
      self.buttons['ABC'].p(abc_fill.area());
      self.buttons['A or B or C'].p(
        a_outline.area() + b_outline.area() + c_outline.area() -
        ab_fill.area() - bc_fill.area() - bc_fill.area() +
        abc_fill.area());
      self.buttons['ABc'].p(a_outline.area() - ab_fill.area());
      self.buttons['AcB'].p(b_outline.area() - ab_fill.area());
      self.buttons['AcBC'].p(bc_fill.area() - abc_fill.area());
      self.buttons['Ac or BC'].p(
        s_outline.area() - a_outline.area() + abc_fill.area());
      self.buttons['S'].p(s_outline.area());
      self.buttons['{}'].p(0);
      if (self.options.showConditional) {
        self.buttons['P(A|B)'].p(
          ab_fill.area() / b_outline.area() * s_outline.area());
        self.buttons['P(Ac|B)'].p(
          s_outline.area() -
          ab_fill.area() / b_outline.area() * s_outline.area());
        self.buttons['P(B|A)'].p(
          ab_fill.area() / a_outline.area() * s_outline.area());
        self.buttons['P(A|BC)'].p(
          abc_fill.area() / bc_fill.area() * s_outline.area());
        self.buttons['P(Ac|BC)'].p(
          s_outline.area() -
          abc_fill.area() / bc_fill.area() * s_outline.area());
        self.buttons['P(A|(B or C))'].p(
          s_outline.area() *
          (ab_fill.area() + ac_fill.area() - abc_fill.area()) /
          (b_outline.area() + c_outline.area() - bc_fill.area()));
      }
    }
  }

  // Updates the sizes of the boxes according to their sliders.
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
    var c_p = $('#' + container_id + 'sbC').slider('value') / 100;
    var c_area = s_area * c_p;
    var c_width = Math.sqrt(c_area * ratio);
    var c_height = c_area / c_width;
    c_outline.width(c_width + 'px');
    c_outline.height(c_height + 'px');
    syncPositions();
  }

  function draw() {
    // Initial sizes. These will get overwritten as soon as updateSizes is
    // called.
    var scaleFactorX = 0.3;
    var scaleFactorY = 0.3;

    s_outline = createBox().addClass('S');
    s_outline.css('left', '10px');
    s_outline.css('top', '10px');
    s_outline.css('width', (self.container.width() - 20) + 'px');
    s_outline.css('height', (self.container.height() - 20) + 'px');
    s_outline.text('S');
    self.container.append(s_outline);

    a_fill = createBox().addClass('A').addClass('fill');
    a_outline = createBox().addClass('A').addClass('outline');
    a_outline.css('left', (self.container.width() * 0.15) + 'px');
    a_outline.css('top', (self.container.height() * 0.3) + 'px');
    a_outline.css('width', (s_outline.width() * scaleFactorX) + 'px');
    a_outline.css('height', (s_outline.height() * scaleFactorY) + 'px');
    a_outline.text('A');

    b_fill = createBox().addClass('B').addClass('fill');
    b_outline = createBox().addClass('B').addClass('outline');
    b_outline.css('left', (self.container.width() * 0.5) + 'px');
    b_outline.css('top', (self.container.height() * 0.4) + 'px');
    b_outline.css('width', (s_outline.width() * scaleFactorX) + 'px');
    b_outline.css('height', (s_outline.height() * scaleFactorY) + 'px');
    b_outline.text('B');

    c_fill = createBox().addClass('C').addClass('fill');
    c_outline = createBox().addClass('C').addClass('outline');
    c_outline.css('left', (self.container.width() * 0.4) + 'px');
    c_outline.css('top', (self.container.height() * 0.2) + 'px');
    c_outline.css('width', (s_outline.width() * scaleFactorX) + 'px');
    c_outline.css('height', (s_outline.height() * scaleFactorY) + 'px');
    c_outline.text('C');

    ab_fill = createBox().addClass('AB').addClass('fill');
    ac_fill = createBox().addClass('AC').addClass('fill');
    bc_fill = createBox().addClass('BC').addClass('fill');
    abc_fill = createBox().addClass('BC').addClass('fill');
    self.container.append(a_fill);
    self.container.append(b_fill);
    self.container.append(c_fill);
    self.container.append(ab_fill);
    self.container.append(ac_fill);
    self.container.append(bc_fill);
    self.container.append(abc_fill);
    self.container.append(a_outline);
    self.container.append(b_outline);
    self.container.append(c_outline);
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
    c_outline.draggable({
      containment: s_outline,
      drag: syncPositions,
      stop: syncPositions
    });
  }
}

// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript combo box.
//
// Usage:
// $('body').append(new SticiComboBox({
//   label: 'Choose your favorite pet: ',
//   options: {
//     'cats'         : 'MEOW!',
//     'dogs'         : 'WOOF!',
//     'anything else': 'Fascinating...'
//   },
//   selected: 'cats',
//   change: function(e, value, label) {
//     alert(value);
// }}));
function SticiComboBox(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<div/>').addClass('stici_combobox');
  var label = jQuery('<span/>');
  var select = jQuery('<select/>');

  // Options.
  var options = {
    label: 'Choose: ',
    options: {
      'foo': null,
      'bar': null
    },
    selected: null,
    value: null,
    change: function(e, value, label) {}
  };
  jQuery.extend(options, params);

  // Accessors and modifiers.
  self.val = function(val) {
    if (val !== undefined) {
      jQuery.each(options.options, function(key, value) {
        if (val == value)
          self.selected(key);
      });
      return self;
    }
    return options.options[select.val()];
  };
  self.selected = function(label) {
    if (label !== undefined) {
      select.val(label);
      return self;
    }
    return select.val();
  };
  self.options = function(opts) {
    if (opts !== undefined) {
      options.options = opts;
      select.children().remove();
      jQuery.each(options.options, function(key, value) {
        var opt =
          jQuery('<option/>').data('value', value).text(key);
        select.append(opt);
      });
      return self;
    }
    return options.options;
  };
  self.change = function(c) {
    if (c !== undefined) {
      options.change = c;
      return self;
    }
    return options.change;
  };

  // Put things together.
  label.text(options.label);
  self.append(label, select);

  // Fill in the combobox.
  self.options(options.options);
  if (options.value !== null)
    self.val(options.value);
  if (options.selected !== null)
    self.selected(options.selected);

  // Change handler, which will in turn dispatch the event to the user.
  select.change(function(e) {
    e.preventDefault();
    e.target = self;

    options.change(e, self.val(), select.val());
  });

  return self;
}

// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript control that displays a histogram.
//
// Usage:
// TODO(jmeady): Add Usage.
function SticiHistogram(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<div/>').addClass('stici_histogram');

  // Options.
  var options = {
    hiLiteLo: 0,
    hiLiteHi: 0,
    binEnds: [0, 10, 20, 30, 40, 50, 60],
    showCurves: true,

    // These can be either arrays of binCount arrays/curves or a single
    // binCount array and curve.
    binCounts: [[2, 8, 10, 17, 3, 5], [5, 10, 15, 12, 8, 2]],
    curves: [function(x) {return 7;}, function(x) {return 13;}]
  };
  jQuery.extend(options, params);

  // Private handle to the overlay to adjust the highlighting.
  var overlay = null;

  // If the given binCounts/curves are not arrays, make them single-element
  // arrays. This means we can use the same code regardless of how many
  // overlain histograms there are.
  if (!(options.binCounts[0] instanceof Array))
    options.binCounts = [options.binCounts];
  if (!(options.curves) instanceof Array)
    options.curves = [options.curves];

  // Accessor and modifier functions.
  self.hilite = function(lo, hi) {
    if (lo !== undefined)
      options.hiLiteLo = lo;
    if (hi !== undefined)
      options.hiLiteHi = hi;

    var bounds = calculateBounds();
    var scale = self.width() / (bounds.x_hi - bounds.x_lo);
    var left = (options.hiLiteLo - bounds.x_lo) * scale;
    var right = (options.hiLiteHi - bounds.x_lo) * scale;
    overlay.css(
      'clip',
      'rect(0px,' + right + 'px,' + self.height() + 'px,' + left + 'px)');

    if (lo !== undefined || hi !== undefined)
      return self;
    else
      return [options.hiLiteLo, options.hiLiteHi];
  };
  self.binEnds = function(ends) {
   if (ends !== undefined) {
     options.binEnds = ends;
     self.redraw();
     return self;
   }
   return options.binEnds;
  };
  self.showCurves = function(show) {
    if (show === undefined)
      show = true;
    options.showCurves = show;
    self.redraw();
    return self;
  };
  self.hideCurves = function() {
    options.showCurves = false;
    self.redraw();
    return self;
  };

  // The following functions are rather magical. If only a single histogram is
  // being displayed, 'i' can always be ommitted and all arguments/return
  // values will traffic in the binCounts array and curve function directly
  // (e.g. set([2,3,4], [5,6], function(x) {return 7;});). If multiple
  // histograms are being displayed, however, they will traffic in arrays
  // of bin count arays and curve functions.
  self.binCounts = function(i, counts) {
    if (counts === undefined && options.binCounts.length == 1) {
      // Single-histogram mode.
      counts = i;
      if (counts === undefined)
        return options.binCounts[0];

      setBinCounts(counts);
      self.redraw();
      return self;
    } else {
      // Multi-histogram mode
      if (i === undefined)
        return options.binCounts;

      if (!isFinite(i)) {
        setBinCounts(i);
        self.redraw();
        return self;
      }

      if (counts === undefined)
        return options.binCounts[i];

      options.binCounts[i] = counts;
      self.redraw();
      return self;
    }
  };
  self.curves = self.curve = function(i, curve) {
    if (curve === undefined && options.curves.length == 1) {
      // Single-histogram mode.
      curve = i;
      if (curve === undefined)
        return options.curves[0];

      setCurves(curves);
      self.redraw();
      return self;
    } else {
      // Multi-histogram mode
      if (i === undefined)
        return options.curves;

      if (!isFinite(i)) {
        setCurves(i);
        self.redraw();
        return self;
      }

      if (curve === undefined)
        return options.curves[i];

      options.curves[i] = curve;
      self.redraw();
      return self;
    }
  };
  self.set = function(binEnds, binCounts, curves) {
    if (curves === undefined)
      curves = [];

    options.binEnds = binEnds;
    setBinCounts(binCounts);
    setCurves(curves);
    self.redraw();
    return self;
  };

  // These methods provide validation so we prefer them over setting variables
  // directly.
  function setBinCounts(binCounts) {
    if (!(binCounts[0] instanceof Array))
      binCounts = [binCounts];

    binCounts = jQuery.map(binCounts, function(counts) {
      return [jQuery.map(counts, function(v) {
        if (v === undefined || v === null || isNaN(v))
          return 0;
        return v;
      })];
    });

    options.binCounts = binCounts;
  }
  function setCurves(curves) {
    if (!(curves instanceof Array))
      curves = [curves];

    options.curves = curves;
  }

  // This can be called in the case that our size has changed.
  self.redraw = function() {
    // Clear everything.
    self.children().remove();

    // Don't try to draw if we cannot be seen.
    if (!self.is(':visible') || self.width() === 0 || self.height() === 0)
      return;

    // Basic pieces. Use these to enforce ordering.
    overlay = jQuery('<div/>').addClass('chart_box overlay');
    var chart = jQuery('<div/>').addClass('chart_box');
    var curves = jQuery('<div/>').addClass('chart_box');
    var axis = jQuery('<div/>').addClass('chart_box axis');
    self.append(chart, overlay, curves, axis);

    // Basic chart parameters.
    var width = self.width();
    var height = self.height() - axis.height();
    var bounds = calculateBounds();
    var yScale = bounds.y_hi / (height - 1);

    // Draw the bins. Iterate once for each set of binCounts, but draw them so
    // that the tallest bins regardless of binCounts set get rendered first,
    // and are therefore in the back.
    var interleaved = interleaveAndSortBinCounts();
    jQuery.each(options.binCounts, function(i) {
      d3.select(chart.get(0))
        .append('svg')
        .selectAll('div')
        .data(interleaved)
        .enter()
        .append('rect')
        .attr('y', function(d) { return height - d[i][0] / yScale; })
        .attr('height', function(d) { return d[i][0] / yScale; })
        .attr('x', function(d, i) {
          return (width * (options.binEnds[i] - bounds.x_lo) / bounds.width);
        })
        .attr('width', function(d, i) {
          return width * (options.binEnds[i + 1] - options.binEnds[i]) /
            bounds.width;
        })
        .attr('class', function(d) {
          return 'set' + d[i][1];
        });
    });

    // Create the hilite overlay.
    overlay.append(chart.children().clone().detach());

    // Hide the overlay. This clip will be controlled to highlight sections.
    overlay.css('clip', 'rect(0px, 0px, ' + height + 'px, 0px)');

    // Draw the curves.
    if (options.showCurves) {
      jQuery.each(options.curves, function(i, curve) {
        if (curve === undefined || curve === null)
          return;

        var line =
          d3.svg.line()
            .x(function(d) {return d;})
            .y(function(d) {
              // Convert the pixel offset to a usable x-coordinate that means
              // something to the curve.
              var x = bounds.x_lo + d * bounds.width / width;
              var y = height - (curve(x) / yScale);
              if (isNaN(y))
                return 0;
              return y;
            });
        d3.select(curves.get(0))
          .append('svg')
          .append('path')
          .attr('class', 'set' + i)
          .data([range(0, width)])
          .attr('d', line);
      });
    }

    // Draw the axis
    var scale =
      d3.scale.linear()
        .domain([bounds.x_lo, bounds.x_hi])
        .range([0, width]);
    d3.select(axis.get(0))
      .append('svg')
      .append('g').call(d3.svg.axis().scale(scale).orient('bottom'));

    // Reset the highlight position.
    self.hilite();
  };

  // Calculates the chart bounds from the binCounts and curves.
  function calculateBounds() {
    var bounds = {
      x_lo: Infinity,
      x_hi: -Infinity,
      width: -Infinity,
      y_lo: 0, // We don't allow negative bin counts.
      y_hi: -Infinity,
      height: -Infinity
    };

    // X range is easy to calculate.
    bounds.x_lo = options.binEnds.min();
    bounds.x_hi = options.binEnds.max();
    bounds.width = bounds.x_hi - bounds.x_lo;

    // Y height can be bounded either by the curve or by the bins. Check both,
    // and watch out for NaN.
    var boxHi =
      jQuery.map(options.binCounts, function(a) {
        if (a === undefined || a === null || a.length === 0)
          return -Infinity;

        return a.max();
      }).max();
    var curveHi =
        jQuery.map(options.curves, function(c) {
          if (c === undefined || c === null)
            return -Infinity;

          return jQuery.grep(
            jQuery.map(range(bounds.x_lo, bounds.x_hi), c),
            isNaN,
            true).max();
        }).max();
    if (isNaN(curveHi))
      curveHi = -Infinity;

    bounds.y_hi = Math.max(curveHi, boxHi);
    bounds.height = bounds.y_hi - bounds.y_lo;

    return bounds;
  }

  // Interleaves the values from all of the binCounts. Each value is
  // transformed into a [value, binCountsIndex] pair. The resulting interleaved
  // elements are then sorted in descending order by value. For example:
  // Given:   [[1, 5, 8], [3, 9, 7], [2, 6, 4]]
  // Outputs: [[[3, 1], [2, 2], [1, 0]],
  //           [[9, 1], [6, 2], [5, 0]],
  //           [[8, 0], [7, 1], [4, 2]]]
  function interleaveAndSortBinCounts() {
    return jQuery.map(range(0, options.binEnds.length - 1), function(i) {
      // jQuery requires that we double-wrap this array because it flattens map
      // results.
      return [jQuery.map(options.binCounts, function(binCounts, set) {
        // Just use 0 if there is no count for this bin.
        if (i >= binCounts.length)
          return [[0, set]];

        return [[binCounts[i], set]];
      }).sort(function(a, b) {
        return b[0] - a[0];
      })];
    });
  }

  // Draw once before we return. All other draws will be triggered by events.
  self.redraw();

  return self;
}

// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript control that consists of both a text input
// and a jQuery-UI slider.
//
// Usage:
// $('body').append(new SticiTextBar({
//   label: 'Insanity',
//   min: 0,
//   max: 10000,
//   step: 1,
//   value: 2000,
//   change: function(e, value) {
//     if (value > 9000)
//       alert('OVER 9000!!!');
//   }}));
function SticiTextBar(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<div/>').addClass('stici_textbar');

  // Options.
  var options = {
    min: 0,
    max: 100,
    step: 1,
    value: 25,
    label: '',
    change: function(e, value) {}
  };
  jQuery.extend(options, params);

  // Create the basic pieces.
  var label = jQuery('<span/>').addClass('stici_textbar_label');
  var input = jQuery('<input type="text"/>').addClass('stici_textbar_input');
  var slider = jQuery('<div/>').addClass('stici_textbar_slider');

  // Compose the pieces.
  self.append(jQuery('<div/>').append(label, input));
  self.append(jQuery('<div/>').append(slider));

  // Accessor and modifier functions.
  self.min = function(min) {
    if (min !== undefined) {
      options.min = min;
      slider.slider('option', 'min', options.min);
      self.val(self.val());
      return self;
    }
    return options.min;
  };
  self.max = function(max) {
    if (max !== undefined) {
      options.max = max;
      slider.slider('option', 'max', options.max);
      self.val(self.val());
      return self;
    }
    return options.max;
  };
  self.bounds = function(min, max) {
    self.min(min);
    self.max(max);
    return self;
  };
  self.step = function(step) {
    if (step !== undefined) {
      options.step = step;
      slider.slider('option', 'step', options.step);
      self.val(self.val());
      return self;
    }
    return options.step;
  };
  self.val = function(val) {
    if (val !== undefined) {
      // Set the slider value first and allow it to do things like bounds
      // checking.
      slider.slider('value', val);

      val = slider.slider('value');
      input.val(val);
      return self;
    }
    return slider.slider('value');
  };
  self.label = function(label) {
    if (label !== undefined) {
      options.label = label;
      label.text(options.label);
      return self;
    }
    return options.label;
  };
  self.change = function(change) {
    if (change !== undefined) {
      options.change = change;
      return self;
    }
    return options.change;
  };
  self.set = function(val, min, max, step) {
    return self.val(val).bounds(min, max).step(step);
  };

  // Initialize the pieces.
  label.text(options.label);
  input.change(onChange);
  slider.slider({
    min: options.min,
    max: options.max,
    step: options.step,
    value: options.value,
    slide: onChange
  });
  input.val(slider.slider('value'));

  // This function receives a change event and sets both the slider and text
  // input equal to the event value. Used as the change callback for both
  // inputs.
  function onChange(e, ui) {
    var value;
    e.target = self;

    // If ui is undefined, we are coming from the text input.
    if (ui === undefined)
       value = jQuery(this).val();
    else
      value = ui.value;

    // This method will do bounds and step checking so use it.
    self.val(value);
    options.change(e, self.val());
  }

  return self;
}

// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript toggle button.
//
// Usage:
// $('body').append(new SticiToggleButton({
//   trueLabel: 'On',
//   falseLabel: 'Off',
//   value: false,
//   change: function(e, is_on) {
//     if (is_on)
//       alert('On!');
// }}));
function SticiToggleButton(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<button/>').addClass('stici_togglebutton');

  // Options.
  var options = {
    trueLabel: 'On',
    falseLabel: 'Off',
    value: false,
    change: function(e, is_on) {}
  };
  jQuery.extend(options, params);

  // Accessors.
  self.val = self.is_true = self.is_toggled = self.toggled = function() {
    return options.value;
  };
  self.is_false = function() {
    return !options.value;
  };
  self.set = function(val) {
    options.value = val;
    return self;
  };
  self.change = function(c) {
    if (c !== undefined) {
      options.change = c;
      return self;
    }
    return options.change;
  };

  // Helper method.
  function setLabel() {
    if (options.value)
      self.text(options.trueLabel);
    else
      self.text(options.falseLabel);
  }

  // Set up the button.
  self.click(function(e) {
    e.preventDefault();
    e.target = self;

    options.value = !options.value;
    setLabel();

    options.change(e, options.value);
  });

  setLabel();

  return self;
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
