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
    populationType: "Box",
    dataSets: ['Box', 'Uniform', 'Normal'],
    statisticTypes: [['Sample Sum', 'sum'], ['Sample Mean', 'mean'], ['Sample t', 't'], 
    ['Sample Chi-Squared', 'chisquared'], ['Sample S-Squared', 'ssq']],
    statisticType: "sum",
    withReplacement: true,
    sampleSize: 2 //hardcoded for now
  };

  this.samplesSoFar = 0;
  this.sampleMean = [];
  this.sampleSum = [];
  this.sampleSsq = [];
  this.sampleT = [];
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

function getUniformPopulation() {
  var xMin = 0;
  var xMax = 1;
  var width = (xMax - xMin)/self.options.bins;
  var population = [];
  for (var i=0; i<self.options.bins; i++) {
    population[i] = i*width;
  }
  return population;
}

function getNormalPopulation() {
  var xMin = -4;
  var xMax = 4;
  var width = (xMax - xMin)/self.options.bins;
  var normalPopulation = [];
  var x;
  for (i=0;i<self.options.bins;i++) {
    x = xMin + i*width;
    count = Math.round(normPdf(0, 1, x) * 100);
    while (count > 0) {
      normalPopulation.push(x);
      count--;
    }
  }
  return normalPopulation;
}

function getBoxPopulation() {
  return jQuery("#population").val().split(',')
            .map(function(i) { return parseInt(i, 10); })
            .filter(function(i) { return !isNaN(i); });
}

function resetSamples() {
  self.samplesSoFar = 0;
  self.sampleMean = [];
  self.sampleSum = [];
  self.sampleSsq = [];
  self.sampleT = [];
  redrawChart();
}

function drawSample() {
  var samples = [], indices = [];
  var i, xb = 0, ssq = 0, tStat = 0;
  console.log("sample size " + self.options.sampleSize);
  console.log("samples so far " + self.samplesSoFar);
  if (self.options.populationType == "Box") {
    if (self.options.withReplacement) {
      indices = listOfRandInts(self.options.sampleSize, 0, self.options.population.length - 1);
    } else {
      indices = listOfDistinctRandInts(self.options.sampleSize, 0, self.options.population.length - 1);
    }
    
    for (i = 0; i < self.options.sampleSize; i++) {
      samples[i] = self.options.population[ indices[i] ];
      xb += samples[i];
      console.log("sample includes: " + self.options.population[ indices[i]]);
    }
  } else if (self.options.populationType == "Uniform") {
    for (i = 0; i < self.options.sampleSize; i++) {
      samples[i] = Math.random();
      xb += samples[i];
      console.log("sample includes: " + samples[i]);
    }
  } else if (self.options.populationType == "Normal") {
    for (i = 0; i < self.options.sampleSize; i++) {
      samples[i] = rNorm();
      xb += samples[i];
      console.log("sample includes: " + samples[i]);
    }
  }
  xb /= self.options.sampleSize;
  for (i = 0; i < self.options.sampleSize; i++) {
    ssq += (samples[i] - xb) * (samples[i] - xb);
  }
  if (self.options.sampleSize > 1) {
    ssq /= (self.options.sampleSize - 1);
    console.log("setting ssq " + ssq);
    self.sampleSsq[self.samplesSoFar] = ssq;
    console.log("calculating t stat");
    //tStat = xb/(Math.sqrt(ssq)/Math.sqrt(self.options.sampleSize));
    //console.log("setting t");
    //self.sampleT[self.samplesSoFar] = tStat;
  } else {
    self.sampleSsq[self.samplesSoFar] = 0;
    self.sampleT[self.samplesSoFar] = 0;
  }

  self.sampleMean[self.samplesSoFar] = xb;
  self.sampleSum[self.samplesSoFar] = xb * self.options.sampleSize;
  self.samplesSoFar++;
}

function redrawChart() {
      console.log("called redraw chart");
      var normalChartDiv = jQuery('<div/>').addClass('chart_box');
      self.chartDiv.children().remove();
      self.overlayDiv = normalChartDiv.clone().addClass('overlay');
      var sampleChartDiv = normalChartDiv.clone().addClass('sample_chart');
      self.normalOverlayDiv = jQuery('<div/>').addClass('chart_box');
      self.chartDiv.append(normalChartDiv);
      self.chartDiv.append(self.overlayDiv);
      self.chartDiv.append(self.normalOverlayDiv);
      self.chartDiv.append(sampleChartDiv);
      // Background calculations.
      var sampleData;
      if (self.options.statisticType == "mean") {
        sampleData = self.sampleMean;
      } else if (self.options.statisticType == "sum") {
        sampleData = self.sampleSum;
      } else if (self.options.statisticType == "ssq") {
        sampleData = self.sampleSsq;
      } else if (self.options.statisticType == "t") {
        sampleData = self.sampleT;
      }
      var allPops = self.options.population.concat(sampleData);
      self.binEnds = histMakeBins(self.options.bins, allPops);
      self.binCounts = histMakeCounts(self.binEnds, allPops);
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
        var popBinEnds = histMakeBins(self.options.bins, self.options.population);
        var popBinCounts = histMakeCounts(self.binEnds, self.options.population);
        console.log("called append svg");
        if (self.options.population.length !== 0) {
        var svg = d3.select(div.get(0)).append('svg').selectAll('div');
        svg.data(popBinCounts)
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
          })
          .attr('class', 'population');
      }
    }
    function appendSamplesSvg(div) {
      console.log("stat type " + self.options.statisticType + " for data " + sampleData);
      var sampleBinEnds = histMakeBins(self.options.bins, sampleData);
      var sampleBinCounts = histMakeCounts(self.binEnds, sampleData);
      if (sampleData.length !== 0) {
        var svg = d3.select(div.get(0)).append('svg').selectAll('div');
        svg.data(sampleBinCounts)
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
          })
          .attr('class', 'sample');
      }
    }
      //three parts: draw the population bars, draw the sample dist data, and draw the restricted range of the dist data (not the pop)
      appendSamplesSvg(sampleChartDiv);
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
        self.statisticSelect = jQuery('<select/>').change(function(e) {
          e.preventDefault();
          self.options.statisticType = jQuery(this).val();
          redrawChart();
        });
        jQuery.each(self.options.statisticTypes, function(i, stat) {
          self.statisticSelect.append(jQuery('<option/>')
                          .attr('value', stat[1])
                          .text(stat[0]));
        });
        dataSelectControls.append('Distribution of: ').append(self.statisticSelect);
        self.dataSelect = jQuery('<select/>').change(function(e) {
          e.preventDefault(e);
          if (jQuery(this).val() == 'Normal') {
            console.log("normal!");
            self.options.populationType = "Normal";
            self.options.population = getNormalPopulation();
            resetSamples();
            redrawChart();
          } else if (jQuery(this).val() == 'Box') {
            console.log("box");
            self.options.populationType = "Box";
            self.options.population = getBoxPopulation();
            resetSamples();
            redrawChart();
          } else if (jQuery(this).val() == 'Uniform') {
            console.log("uniform!");
            self.options.populationType = "Uniform";
            self.options.population = getUniformPopulation();
            resetSamples();
            redrawChart();
          }
        });
        jQuery.each(self.options.dataSets, function(i, dataSet) {
          self.dataSelect.append(jQuery('<option/>')
                         .attr('value', dataSet)
                         .text(dataSet));
        });
        dataSelectControls.append('Sample from: ').append(self.dataSelect);
        self.replacementCheckbox = jQuery('<input type="checkbox" id="withReplacement" />').change(function(e) {
          e.preventDefault();
          self.options.withReplacement = !self.options.withReplacement;
          resetSamples();
        });
        if (self.options.withReplacement) {
          self.replacementCheckbox.attr('checked', true);
        }
        dataSelectControls.append(self.replacementCheckbox).append(' with replacement');
        self.takeSampleButton = jQuery('<button id="takeSample"/>')
        .addClass('open')
        .text('Take Sample').click(function(e) {
          e.preventDefault();
          console.log("You took a sample!");
          drawSample();
          redrawChart();
        }); //add change handler
        dataSelectControls.append(self.takeSampleButton);
        appendHeaderRow(dataSelectControls);
      }

      function createPopulationTextArea() {
        self.populationTextArea = jQuery('<input id="population" value="' + self.options.populationText + '"/>')
          .addClass('populationControls');
        self.populationTextArea.change(function(e) {
          e.preventDefault();
          var new_pop = getBoxPopulation();
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