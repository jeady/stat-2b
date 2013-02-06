//js rewrite of http://statistics.berkeley.edu/~stark/Java/Html/SampleDist.htm

function Stici_SampleDist(container_id, params) {
  var self = this;

  if (!params instanceof Object) {
    console.error('Stici_SampleDist params should be an object');
    return;
  }
//configuration option defaults
  this.options = {
    bins: 100,
    population: [0,1,2,3,4],
    populationText: [0,1,2,3,4].join(','),
    showPopulationButton: true,
    dataSets: ['Box', 'Uniform', 'Normal'],
    statisticTypes: [['Sample Sum', 'sum'], ['Sample Mean', 'mean'], ['Sample t', 't'], 
    ['Sample Chi-Squared', 'chisquared'], ['Sample S-Squared', 'ssquared']],
    withReplacement: true
  };

  // Various handles to important jQuery objects.
  this.showingPopulation = true;
  this.restrictedCounts = null;
  this.replacementCheckbox = null;
  this.statisticSelect = null;
  this.dataSelect = null;
    // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

  // jQuery object containing the entire chart.
  this.container = jQuery('#' + container_id);

  this.reloadChart = function() {
    console.log("called reload chart");
    redrawChart();
  };

function redrawChart() {
      console.log("called redraw chart");
      var normalChartDiv = jQuery('<div/>').addClass('chart_box');
      self.chartDiv.children().remove();
      self.overlayDiv = normalChartDiv.clone().addClass('overlay');
      self.normalOverlayDiv = jQuery('<div/>').addClass('chart_box');
      self.chartDiv.append(normalChartDiv);
      self.chartDiv.append(self.overlayDiv);
      self.chartDiv.append(self.normalOverlayDiv);
      // Background calculations.
      self.binEnds = histMakeBins(self.options.bins, self.options.population); //this needs to be dynamic later
      self.binCounts = histMakeCounts(self.binEnds, self.options.population);
      var width = self.overlayDiv.width();
      var height = self.overlayDiv.height();
      var graphWidth = self.binEnds.max() - self.binEnds.min();
      //this chunk is copied from histhilite, to do with setting up y scale
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
      //end copied chunk

      //first draw the histogram with the population bars
      function appendPopulationSvg(div) {
        console.log("called append svg");
        if (self.options.population.length !== 0) {
        var svg = d3.select(div.get(0)).append('svg').selectAll('div');
        svg.data(self.binCounts)
          .enter()
          .append('rect')
          .attr('y', function(d) { console.log("appending " + d); return height - d / yScale; })
          .attr('height', function(d) { return d / yScale; })
          .attr('x', function(d, i) {
            return (width * (self.binEnds[i] - self.binEnds.min()) /
                    graphWidth);
          })
          .attr('width', function(d, i) {
            return width * (self.binEnds[i + 1] - self.binEnds[i]) /
              graphWidth;
          })
          .attr('class', 'population');
      }
    }
      //three parts: draw the population bars, draw the sample dist data, and draw the restricted range of the dist data (not the pop)
      appendPopulationSvg(normalChartDiv);
      var axisSvg = d3.select(normalChartDiv.get(0))
                  .append('svg')
                  .attr('class', 'axis');
      var axisScale = d3.scale.linear()
                              .domain([self.binEnds.min(), self.binEnds.max()])
                              .range([0, width]);
      var axis = d3.svg.axis().scale(axisScale).orient('bottom');
      axisSvg.append('g').call(axis);
    }


    function initControls() {
      // Create html for basic structure:
      // top_controls -> stici_chart -> area_info -> botom_controls.
      var o = jQuery('<div/>').addClass('stici').addClass('stici_sampledist');
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

      function createSelectDataSourceControls() {
        var dataSelectControls = jQuery('<div/>');
        self.statisticSelect = jQuery('<select/>'); //add change handler
        jQuery.each(self.options.statisticTypes, function(i, stat) {
          self.statisticSelect.append(jQuery('<option/>')
                          .attr('value', stat[1])
                          .text(stat[0]));
        });
        dataSelectControls.append('Distribution of: ').append(self.statisticSelect);
        self.dataSelect = jQuery('<select/>'); //eventually put change handler here
        jQuery.each(self.options.dataSets, function(i, dataSet) {
          self.dataSelect.append(jQuery('<option/>')
                         .attr('value', dataSet)
                         .text(dataSet));
        });
        dataSelectControls.append('Sample from: ').append(self.dataSelect);
        self.replacementCheckbox = jQuery('<input type="checkbox" id="withReplacement" />'); //add change handler
        if (self.options.withReplacement) {
          self.replacementCheckbox.attr('checked', true);
        }
        dataSelectControls.append(self.replacementCheckbox).append(' with replacement');
        self.takeSampleButton = jQuery('<button id="takeSample"/>')
        .addClass('open')
        .text('Take Sample'); //add change handler
        dataSelectControls.append(self.takeSampleButton);
        appendHeaderRow(dataSelectControls);
      }

      function createPopulationTextArea() {
        self.populationTextArea = jQuery('<input id="population" value="' + self.options.populationText + '"/>')
          .addClass('populationControls');
        self.populationTextArea.change(function(e) {
          e.preventDefault();
          var new_pop = jQuery("#population").val().split(',')
            .map(function(i) { return parseInt(i, 10); })
            .filter(function(i) { return !isNaN(i); });
          if (new_pop.length < 2) {
            console.log("bad input");
          } else {
            self.options.population = new_pop;
            redrawChart();
          }
        });

      }
      function createPopulationButton() {
        self.showPopulationButton = jQuery('<button/>')
                             .addClass('open');
        if (self.showingPopulation)
          self.showPopulationButton.text('Hide Population Histogram');
        else
          self.showPopulationButton.text('Show Population Histogram');
        self.showPopulationButton.click(function(e) {
          e.preventDefault();
          jQuery('.population').toggle();
          if (!self.showingPopulation)
            self.showPopulationButton
                .text(self.showPopulationButton.text().replace('Show', 'Hide'));
          else
            self.showPopulationButton
                .text(self.showPopulationButton.text().replace('Hide', 'Show'));
          self.showingPopulation = !self.showingPopulation;
          //refreshSelectedAreaOverlay();
        });
        self.areaInfoDiv.css('bottom', bottomOffset + 'px');
        top.css('height', topOffset + 'px');
        bottom.css('height', bottomOffset + 'px');
        self.chartDiv.css('margin-bottom', (bottomOffset + 15) + 'px');
        self.chartDiv.css('margin-top', (topOffset) + 'px');
      }

        var row = jQuery('<div/>');
        createSelectDataSourceControls();
        createPopulationButton();
        if (self.options.showPopulationButton)
          row.append(self.showPopulationButton);
        createPopulationTextArea();
        row.append(" Population: ");
        row.append(self.populationTextArea);

        if (row.children().length > 0)
          appendFooterRow(row);
        self.areaInfoDiv.css('bottom', bottomOffset + 'px');
        top.css('height', topOffset + 'px');
        bottom.css('height', bottomOffset + 'px');
        self.chartDiv.css('margin-bottom', (bottomOffset + 15) + 'px');
        self.chartDiv.css('margin-top', (topOffset) + 'px');

    }

  initControls();
  this.reloadChart();
}