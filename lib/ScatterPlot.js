// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/ScatterPlot.htm
//
// Authors: Ken Yu <kenniyu@gmail.com>
//          James Eady <jeady@berkeley.edu>
//          Philip B. Stark <stark@stat.berkeley.edu>
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

  doWhileVisible(self.container, function() {
    initControls();
    self.reloadData();
  });
}
