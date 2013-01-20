// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/ScatterPlot.htm
//
// Author: Ken Yu <kenniyu@gmail.com>
//
// container_id: the CSS ID of the container to create the scatterplot (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  - data: Array of URLs (as strings) of json-encoded datasets
function Stici_Scatterplot(container_id, params) {
  var self = this;

  if (!params instanceof Object) {
    console.error('Stici_ScatterPlot params should be an object');
    return;
  }

  // Configuration options.
  this.options = params;

  // jQuery object containing the entire chart.
  this.container = $('#' + container_id);

  // Labels for the data.
  this.dataFields = null;

  // The data itself.
  this.dataValues = null;

  // The URL we got the JSON-encoded data from.
  this.dataSource = null;

  // Various handles to important jQuery objects.
  this.urlInput = null;
  this.dataSelect = null;
  this.xVariableSelect = null;
  this.yVariableSelect = null;
  this.currentData = null;
  this.xScale = null;
  this.yScale = null;
  this.chartWidth = null;
  this.chartHeight = null;
  this.chartMargins = null;
  this.chartDiv = null;
  this.graphOfAvePoints = null;
  this.chartMargins    = { 'top': '10', 'right': '10', 'bottom': '25', 'left': '50' };
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

  if (!params.data instanceof Array) {
    this.dataSource = null;
    this.options.data = [];
  } else {
    this.dataSource = this.options.data[0];
    this.graphOfAvePoints = this.options.graphOfAvePoints || 9;
    this.chartMargins = {
      'top': this.options.chartMargins[0],
      'right': this.options.chartMargins[1],
      'bottom': this.options.chartMargins[2],
      'left': this.options.chartMargins[3]
    };
    this.chartWidth   = this.container.width() - 20;
    this.chartHeight  = this.container.height() - 100;
  }

  // Reloads chart data from this.dataSource
  // upon new data set selection
  this.reloadData = function() {
    var $bottomControls = $('.bottom_controls'),
        $popboxControls = $('.popbox-controls');

    self.options.data = [];
    self.dataFields = [];
    self.dataValues = [];
    self.dataSource = $('select.data_select').val();

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
        self.xVariableSelect.append(
          $('<option/>').attr('value', i).text(field)
        );
        self.yVariableSelect.append(
          $('<option/>').attr('value', i).text(field)
        );
      });

      // TODO unhardcode this
      self.xVariableSelect.val(3);
      self.yVariableSelect.val(2);

      // create popbox controls
      $('.popbox-controls').empty();
      self.createPopbox('list-data');
      self.createPopbox('univar-stats');
      $('.popbox').popbox({'toggler': ['list-data', 'univar-stats']});
      $('.popbox-content table').css('width', self.dataFields.length * 100 + 'px');

      // reload the chart after new data set
      self.reloadChart();

    });
  };

  this.prepareData = function() {
    // get array of x and y points
    self.currentData = $.map(self.dataValues, function(values, index) {
      return { 'x': parseFloat(values[self.xVariableSelect.val()]),
               'y': parseFloat(values[self.yVariableSelect.val()]),
               'index': index,
               'added': false,
               'selected': $('.popbox.list-data tr[data-index="' + index + '"]').hasClass('selected') };
    });
  };

  this.setScale = function(data) {
    // x scale. range from 0 to width
    var chartWidth    = self.chartWidth,
        chartMargins  = self.chartMargins,
        xScale        = d3.scale.linear()
                          .domain([d3.min(data, function(d) { return d.x; }),
                                   d3.max(data, function(d) { return d.x; })])
                          .range([0, chartWidth - chartMargins.left - chartMargins.right])
                          .nice(),
        yMin = d3.min(data, function(d) { return d.y; }),
        yMax = d3.max(data, function(d) { return d.y; }),
        yScale;

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
        svg           = d3.select('svg');

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
   /// prepare data before reloading chart
    self.prepareData();

    if (self.bottomControls['res-plot'] === true) {
      self.toggleResPlot(true);
    } else {
      self.drawDataPlot();
      self.plotSelectedOptions(['res-plot']);
    }
  };

  this.updateRHat = function() {
    var data  = self.filterData(),
        xData = $.map(data, function(d) { return d.x; }),
        yData = $.map(data, function(d) { return d.y; }),
        cc    = corr(xData, yData).toFixed(2);
    $('#r-hat').text('r: ' + cc);
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
    $('.bottom_controls .popbox-controls').append(popboxHtml);
  };

  this.createUnivarStatsHtml = function() {
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
    d3.selectAll('.data-point[data-added="true"]').remove();
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
        pointPlot     = d3.select('svg').append('g')
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

    d3.selectAll('.data-point')
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
        plotContainer = d3.select('.plot');

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
            $('#cursor-pos').text(' x = ' + xVal + '  y = ' + yVal);
      });

    d3.select('.plot-data.plot .mouse-event-handler')
      .on('click', function() {
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
        pointPlot = d3.select('.plot-data.plot');

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

    $('svg g.reg-line').remove();
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

      regLine = d3.select('.plot-data')
        .append('g')
        .attr('class', 'reg-line');

      regLine.append('line')
        .attr('x1', xScale(point1.x))
        .attr('x2', xScale(point2.x))
        .attr('y1', yScale(point1.y))
        .attr('y2', yScale(point2.y));
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

    $('svg g.graph-of-ave').remove();
    if (show) {
      xData = $.map(data, function(d) { return d.x; });
      yData = $.map(data, function(d) { return d.y; });
      xMax  = d3.max(xData);
      xMin  = d3.min(xData);
      xRangeIncrement = (xMax - xMin) / graphOfAvePoints;

      xMean = mean(xData);
      yMean = mean(yData);
      xSd   = sd(xData);
      ySd   = sd(yData);
      cc    = corr(xData, yData);
      slope = cc * ySd / xSd;

      graphOfAve = d3.select('.' + plotType)
        .append('g')
        .attr('class', 'graph-of-ave');

      for (var i = 0; i < graphOfAvePoints; i++) {
        cumY            = 0;
        numPointsInBin  = 0;
        tempXMin        = xMin + i*xRangeIncrement;
        tempXMax        = xMin + (i+1)*xRangeIncrement;
        for (var j = 0; j < data.length; j++) {
          if (i === graphOfAvePoints - 1) {
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
            .attr('x', xScale(tempPointOfAve.x) - 2.5)
            .attr('y', yScale(tempPointOfAve.y) - 2.5)
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

    $('svg g.sd-line').remove();
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

      sdLine = d3.select('.plot-data')
        .append('g')
        .attr('class', 'sd-line');

      sdLine.append('line')
        .attr('x1', xScale(point1.x))
        .attr('x2', xScale(point2.x))
        .attr('y1', yScale(point1.y))
        .attr('y2', yScale(point2.y));
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
    var selectedDataPoint = d3.select('.data-point[data-index="' + dataIndex + '"]'),
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
      d3.select('.data-point.selected:not([data-index="' + dataIndex + '"])')
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
      // $('.popbox.list-data tr:not([data-index="' + dataIndex + '"])').removeClass('selected');
      $('.popbox.list-data tr[data-index="' + dataIndex + '"]').toggleClass('selected');
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

    d3.select('.mean-point').remove();

    d3.select('svg .plot')
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

    $('svg g.sds').remove();
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
      sds = d3.select('.plot-data')
        .append('g')
        .attr('class', 'sds');
      sds.append('line')
        .attr('x1', xScale(xSdPlots[0]))
        .attr('x2', xScale(xSdPlots[0]))
        .attr('y1', 0)
        .attr('y2', chartHeight - chartMargins.bottom - chartMargins.top);
      sds.append('line')
        .attr('x1', xScale(xSdPlots[1]))
        .attr('x2', xScale(xSdPlots[1]))
        .attr('y1', 0)
        .attr('y2', chartHeight - chartMargins.bottom - chartMargins.top);
      sds.append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth - chartMargins.left - chartMargins.right)
        .attr('y1', yScale(ySdPlots[0]))
        .attr('y2', yScale(ySdPlots[0]));
      sds.append('line')
        .attr('x1', 0)
        .attr('x2', chartWidth - chartMargins.left - chartMargins.right)
        .attr('y1', yScale(ySdPlots[1]))
        .attr('y2', yScale(ySdPlots[1]));
    }
  };


  // Initializes the chart controls (top, data, and bottom)
  function initControls() {
    var $stici = $('<div/>').addClass('stici'),
        $topControls = $('<div/>').addClass('top_controls');

    self.container.append($stici);

    // Top controls
    self.urlInput = $('<input type="text" />');
    self.dataSelect = $('<select class="data_select"/>').change(self.reloadData);
    self.xVariableSelect = $('<select class="variable_select"/>').change(self.reloadChart);
    self.yVariableSelect = $('<select class="variable_select"/>').change(self.reloadChart);

    $topControls.append('Data: ').append(self.dataSelect);

    // for each data set, append option to option select
    $.each(self.options.data, function(i, dataUrl) {
      self.dataSelect.append($('<option/>')
                     .attr('value', dataUrl)
                     .text(dataUrl));
    });

    // append x and y variable selects
    $topControls.append(self.yVariableSelect);
    $topControls.append(' vs ');
    $topControls.append(self.xVariableSelect);

    $stici.append($topControls);

    // Chart (for svg container)
    self.chartDiv = $('<div/>').addClass('stici_chart').addClass('chart_box').attr('id', 'scatterplot');
    $stici.append(self.chartDiv);

    // Bottom controls
    var $bottom = $('<div/>').addClass('bottom_controls').addClass('extended'),
        $rHat = $('<span/>').attr('id', 'r-hat').text('r: 0.16'),
        $toggleSd = $('<button/>').attr('id', 'sds').text('SDs'),
        $toggleSdLine = $('<button/>').attr('id', 'sd-line').text('SD Line'),
        $toggleGraphOfAve = $('<button/>').attr('id', 'graph-of-ave').text('Graph of Ave'),
        $toggleRegLine  = $('<button/>').attr('id', 'reg-line').text('Regression Line'),
        $toggleResPlot  = $('<button/>').attr('id', 'res-plot').text('Plot Residuals'),
        $popboxControls = $('<div/>').attr('class', 'popbox-controls'),
        $toggleUsePoints  = $('<button/>').attr('id', 'use-points').text('Use Added Points'),
        $toggleClearPoints = $('<button/>').attr('id', 'clear-points').text('Clear Added Points'),
        $cursorPos  = $('<span/>').attr('id', 'cursor-pos').text('');

    $stici.append($bottom);

    $bottom.append($rHat).append($toggleSd).append($toggleSdLine)
      .append($toggleGraphOfAve).append($toggleRegLine)
      .append($toggleResPlot).append('<br/>')
      .append($popboxControls).append($toggleUsePoints)
      .append($toggleClearPoints).append($cursorPos);

  }


  /***
   * handleBtnToggle: Handles button toggle
   * params: Event e
   ***/
  function handleBtnToggle(e) {
    var $target = $(e.target),
        btnId   = $target.attr('id');
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
        $target       = $(e.target),
        $closestTable = $target.closest('table'),
        $closestRow,
        dataIndex;
    if ($closestTable.hasClass('data-values')) {
      $closestRow = $target.closest('tr');
      dataIndex   = $closestRow.attr('data-index');
      self.highlightDataPoint(dataIndex, eventType);
    }
  }

  // document ready
  $().ready(function() {
    $('button').live('click', function(e) {
      handleBtnToggle(e);
    });
    $('.popbox').live('mouseover mouseout click', function(e) {
      handlePopboxMouseEvents(e);
    });
  });

  initControls();
  this.reloadData();

}
