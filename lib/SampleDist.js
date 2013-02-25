//js rewrite of http://statistics.berkeley.edu/~stark/Java/Html/SampleDist.htm

function Stici_SampleDist(container_id, params) {
  var self = this;

  var SUM = 'sum';
  var MEAN = 'mean';
  var T = 't';
  var CHISQUARE = 'chisquared';
  var SSQ = 'ssq';

  var BOX = 'Box';
  var UNIFORM = 'Uniform';
  var NORMAL = 'Normal';

  if (!params instanceof Object) {
    console.error('Stici_SampleDist params should be an object');
    return;
  }
//configuration option defaults
  this.options = {
    bins: 10,
    population: [0,1,2,3,4],
    populationText: [0,1,2,3,4].join(',\n'),
    showPopulationButton: false,
    showPopulation: true,
    populationType: BOX,
    dataSets: [UNIFORM, BOX, NORMAL],
    statisticTypes: [['Sample Chi-Squared', CHISQUARE], ['Sample Mean', MEAN], ['Sample t', T], ['Sample Sum', SUM], ['Sample S-Squared', SSQ]],
    statisticType: SUM,
    withReplacement: false,
    sampleSize: 5,
    samplesToTake: 1,
    boxEditable: true,
    toggleVar: true,
    replaceControl: true,
    statLabels: true,
    binControls: true
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
  this.binEnds = [];

  // Various handles to important jQuery objects.
  //some of these might not be needed????
  this.restrictedCounts = null;
  this.replacementCheckbox = null;
  this.statisticSelect = null;
  this.dataSelect = null;
  this.popTextLabel = "Population";
  this.stashedBoxPopulation = [0,1,2,3,4];
    // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

  // jQuery object containing the entire chart.
  this.container = jQuery('#' + container_id);

  this.reloadChart = function() {
    getPopStats();
    refreshStatsBox();
    redrawChart();
  };

function initData() {
  getPopStats();
  setLims();
  setPopulation();
}

function setPopTextLabel() {
  if (self.options.statisticType == CHISQUARE) {
    self.popTextLabel = "Category Probabilities";
  } else {
    self.popTextLabel = "Population";
  }
  if (self.options.populationType == BOX) {
    self.options.populationText = self.options.population.join(',\n');
  }
}

function getPopStats() {
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
}

function getUniformPopulation() {
  var population = [];
  for(var i=0; i < self.options.bins; i++) {
    midPt = (self.binEnds[i]+self.binEnds[i+1])/2;
    if (midPt >= 0 && midPt <= 1) {
      population.push(midPt);
    }
  }
  return population;
}

function getNormalPopulation() {
  var normalPopulation = [];
  for(var i=0; i < self.options.bins; i++) {

    count = (normCdf(self.binEnds[i+1]) - normCdf(self.binEnds[i]))/(self.binEnds[i+1] - self.binEnds[i]);
    count = Math.round(count * 100);
    while (count > 0) {
      normalPopulation.push(self.binEnds[i]);
      count--;
    }
  }
  return normalPopulation;
}

function getBoxPopulation() {
  return jQuery("#population").val().split(',')
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
    //self.xMin = (self.popMean-4*self.popSd)/Math.sqrt(self.options.sampleSize);
    //console.log("mean xmin " + self.xMin);
    self.xMin = -0.1;
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
  if (self.showPopulationButton) {
    self.xMin = Math.min(self.popMin, self.xMin);
    self.xMax = Math.max(self.popMax, self.xMax);
  }
  self.binEnds = histMakeBins(self.options.bins, [self.xMin, self.xMax]);
}

function refreshStatsBox() {
  if (self.options.statLabels) {
    var nPop, fpc, ex;
    nPop = self.options.population.length;
    fpc = 1.0;
    if (!self.options.withReplacement) {
      fpc = Math.sqrt( (nPop - self.options.sampleSize + 0.0)/(nPop-1.0));
    }

    if (self.options.statisticType == SUM) {
      ex = self.options.sampleSize * self.popMean;
      statExpText = "E(sum): " + Number(ex).toFixed(2);
      se = fpc*self.popSd*Math.sqrt(self.options.sampleSize);
      statSEText = "SE(sum): " + Number(se).toFixed(2);
      statSampleMeanText = "Mean(values) = " + Number(mean(self.sampleMean)).toFixed(4);
      statSampleSDText = "SD(values) = " + Number(sd(self.sampleMean)).toFixed(4);
    } else if (self.options.statisticType == MEAN) {
      ex = self.popMean;
      statExpText = "E(mean): " + Number(ex).toFixed(2);
      se = fpc*(self.popSd)*Math.sqrt(self.options.sampleSize);
      statSEText = "SE(mean): " + Number(se).toFixed(2);
      statSampleMeanText = "Mean(values) = " + Number(mean(self.sampleMean)).toFixed(4);
      statSampleSDText = "SD(values) = " + Number(sd(self.sampleMean)).toFixed(4);
    } else if (self.options.statisticType == T) {
      ex = self.popMean;
      statExpText = "E(t): " + Number(ex).toFixed(2);
      if (self.options.sampleSize > 2) {
        se = Math.sqrt((self.options.sampleSize + 0.0)/(self.options.sampleSize - 2.0));
      } else {
        se = NaN;
      }
      statSEText = "SE(t): " + Number(se).toFixed(2);
      statSampleMeanText = "Mean(values) = " + Number(mean(self.sampleT)).toFixed(4);
      statSampleSDText = "SD(values) = " + Number(sd(self.sampleT)).toFixed(4);
    } else if (self.options.statisticType == SSQ) {
      if (self.options.withReplacement) {
        ex = (self.popSd)*(self.popSd);
      } else {
        ex = (self.popSd)*(self.popSd)*nPop/nPop-1;
      }
      se = Math.sqrt(2.0/(self.options.sampleSize-1.0))*(self.popSd)*(self.popSd);
      statExpText = "E(S-squared): " + Number(ex).toFixed(2);
      statSEText = "df: " +  (self.options.sampleSize-1);
      statSampleMeanText = "Mean(values) = " + Number(mean(self.sampleSsq)).toFixed(4);
      statSampleSDText = "SD(values) = " + Number(sd(self.sampleSsq)).toFixed(4);
    } else if (self.options.statisticType == CHISQUARE) {
      ex = nPop;
      statExpText = "df: " + Number(ex).toFixed(2);
      se = Math.sqrt(2.0*(nPop-1.0));
      statSEText = "     ";
      statSampleMeanText = "Mean(values) = " + Number(mean(self.sampleSsq)).toFixed(4);
      statSampleSDText = "SD(values) = " + Number(sd(self.sampleSsq)).toFixed(4);
    }

    if (self.samplesSoFar === 0) {
      statSampleMeanText = "Mean(values) = NaN";
      statSampleSDText = "SD(values) = NaN";
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

function redrawChart() {
      setLims();
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

      //self.binEnds = histMakeBins(self.options.bins, [self.xMin, self.xMax]);
      var currentBinCounts = histMakeCounts(self.binEnds, allPops);
      var width = self.overlayDiv.width();
      var height = self.overlayDiv.height();
      var graphWidth = self.binEnds.max() - self.binEnds.min();
      //this chunk is copied from histhilite, to do with setting up y scale
      var normalCurveY = function(d) {
        var x =
          self.binEnds[0] +
          d * (self.binEnds[self.options.bins] - self.binEnds[0]) / (width - 1);
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
      yScale = Math.max(currentBinCounts.max(), yScale);
      var restrictedNormalCurveY = null;
      if (null !== self.restrictedCounts) {
        restrictedNormalCurveY = function(d) {
          var x =
            self.binEnds[0] +
            d * (self.binEnds[self.options.bins] - self.binEnds[0]) / (width - 1);
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
        var popBinCounts = histMakeCounts(self.binEnds, self.options.population);
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
      var statsBox = jQuery('div#statsText');
      self.statsBox = statsBox;
      refreshStatsBox();
      var o = jQuery('<div/>').addClass('stici').addClass('stici_sampledist');
      self.container.append(o);
       //var top = jQuery('<div/>').addClass('top_controls');
       //o.append(top);
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
        // topOffset += rowHeight;
        //jQuery('div#topControls').append(o);
        topOffset += rowHeight;
      }
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
            //don't reset?????
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
            self.options.populationText = "Normal";
          } else if (jQuery(this).val() == BOX) {
            self.options.populationType = BOX;
            self.options.populationText = self.stashedBoxPopulation.join(',\n');
          } else if (jQuery(this).val() == UNIFORM) {
            self.options.populationType = UNIFORM;
            self.options.populationText = "Uniform";
          }
          drawPopulationArea(jQuery('div#popText'));
          initData();
          resetSamples();
          self.reloadChart();
        });
        jQuery.each(self.options.dataSets, function(i, dataSet) {
          self.dataSelect.append(jQuery('<option/>')
                         .attr('value', dataSet)
                         .text(dataSet));
        });
        self.dataSelect.val(self.options.populationType);
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
        self.populationTextArea = jQuery('<textarea id="population">' + self.options.populationText + '</textarea>')
          .addClass('populationControls');
        if (!self.options.boxEditable) {
          self.populationTextArea.attr("readonly", "readonly");
        }
        self.populationTextArea.change(function(e) {
          e.preventDefault();
          if (self.options.populationType == BOX) {
            self.options.population = getBoxPopulation();
            initData();
            self.reloadChart();
          }
        });
      }
      function createPopulationButton() {
        self.showPopulationButton = jQuery('<button/>')
                             .addClass('open');
        if (self.options.showPopulation)
          self.showPopulationButton.text('Hide Population Histogram');
        else
          self.showPopulationButton.text('Show Population Histogram');
        self.showPopulationButton.click(function(e) {
          e.preventDefault();
          jQuery('.population').toggle();
          if (!self.options.showPopulation)
            self.showPopulationButton
                .text(self.showPopulationButton.text().replace('Show', 'Hide'));
          else
            self.showPopulationButton
                .text(self.showPopulationButton.text().replace('Hide', 'Show'));
          self.options.showPopulation = !self.options.showPopulation;
          //refreshSelectedAreaOverlay();
        });
        self.areaInfoDiv.css('bottom', bottomOffset + 'px');
        bottom.css('height', bottomOffset + 'px');
        self.chartDiv.css('margin-bottom', (bottomOffset + 15) + 'px');
        self.chartDiv.css('margin-top', (topOffset) + 'px');
      }

        var row = jQuery('<div/>');
        createSelectDataSourceControls();
        createPopulationButton();
        if (self.options.showPopulationButton)
          row.append(self.showPopulationButton);

        function drawPopulationArea(div) {
          createPopulationTextArea();
          div.html("");
          div.append(self.populationTextArea);
          div.append(self.popTextLabel);
        }

        drawPopulationArea(jQuery('div#popText'));

        //this is a little bit crazypants, refactor this whole thing
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
        if (row.children().length > 0)
          appendFooterRow(row);
          appendFooterRow(sampleFooterRow);
        self.areaInfoDiv.css('bottom', bottomOffset + 'px');
        bottom.css('height', bottomOffset + 'px');
        self.chartDiv.css('margin-bottom', (bottomOffset + 15) + 'px');
        self.chartDiv.css('margin-top', (topOffset) + 'px');

    }

  initControls();
  initData();
  this.reloadChart();
  if (!self.options.showPopulation) { //maybe a bad place to put this
    jQuery('.population').toggle();
  }
}