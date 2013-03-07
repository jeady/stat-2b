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

  this.showingNormal = self.options.showNormal;

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

    // Draw the normal curve and then hide it. We can show it by toggling
    // its css.
    if (self.options.showNormalButton || self.options.showNormal) {
      if (self.showingNormal) {
        self.histogram.showCurves();
        self.showNormalButton.text('Hide Normal Curve');
      } else {
        self.histogram.hideCurves();
        self.showNormalButton.text('Show Normal Curve');
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
        if (!self.showingNormal)
          self.showNormalButton
              .text(self.showNormalButton.text().replace('Show', 'Hide'));
        else
          self.showNormalButton
              .text(self.showNormalButton.text().replace('Hide', 'Show'));
        self.showingNormal = !self.showingNormal;
        if (self.showingNormal)
          self.histogram.showCurves();
        else
          self.histogram.hideCurves();
        refreshSelectedAreaOverlay();
      });
      if (self.options.showNormalButton)
        row.append(self.showNormalButton);

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
