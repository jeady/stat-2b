function Stici_SampleDist(container_id, params) {
    var self = this;

    // jQuery object containing the entire chart.
    this.container =
      jQuery('#' + container_id);

    // These are constants.
    var maxBins = 100;

    // User-configurable parameters. These are directly lifted from
    // SampleDist.java. I don't know what the commented ones are yet, nor what
    // their default values should be. -jeady
    this.options = {
        binControls: true,
        bins: maxBins,
        //boxContents: ,
        boxEditable: true,
        boxHistControl: false,
        curveControls: true,
        //curves: ,
        hiLiteHi: 0.0,
        hiLiteLo: 0.0,
        replace: true,
        replaceControl: false,
        sampleSize: 5,
        samplesToTake: 1,
        showBoxHist: true,
        showCurve: false,
        //sources: ",
        //startWith: ,
        statLabels: true,
        toggleVar: true
        //variables:,
    };
    jQuery.extend(this.options, params);

    // UI Elements
    self.sampleSizeBar = jQuery('<input type="text"/>');    // size of each sample
    self.samplesToTakeBar = jQuery('<input type="text"/>'); // number of samples to take
    self.binBar = jQuery('<input type="text"/>');           // number of bins in the histogram
    self.lo = new SticiTextBar();
    self.hi = new SticiTextBar();
    self.box = jQuery('<input type="text"/>');     // holds the population.
    self.popMeanLabel = createLabel();             // to display the population mean
    self.popSdLabel = createLabel();               // to display the population SD
    self.statSampleMeanLabel = createLabel();      // to display mean of sample means
    self.statSampleSDLabel = createLabel();        // sample SD of sample means
    self.statExpLabel = createLabel();             // theor. Expected value of statistic
    self.statSELabel = createLabel();              // to display theor. SD of statistic or d.f. of chi-square
    self.samplesToTakeLabel = createLabel();       // display number of samples to take next
    self.samplesSoFarLabel = createLabel();        // number of samples of current size taken
    self.sourceLabel = createLabel();              // label for the population sampled
    self.titleLabel = createLabel();
    self.boxLabel = createLabel();                 // label box as population or category probabilities
    self.areaLabel = createLabel();
    self.curveAreaLabel = createLabel();
    self.hist = new SticiHistogram();
    self.replaceCheck = createCheckbox("with replacement");
    self.varChoice = createChoice();   // options for which random variable to sample
    self.curveChoice = createChoice(); // options for which approximating curve to plot
    self.sourceChoice = createChoice(); // options for data source (box, normal, uniform)

    // These are class variables from the original java that probably have not
    // yet been incorporated.
    /*
    String[][] curveLabel = { {"No Curve","none"},
                              {"Normal Curve","normal"},
                              {"Student t Curve","t"},
                              {"Chi-Squared Curve","chi-squared"}
                            };
    String[] buttonLabel = {"Take Sample",
                            "Population Histogram",
                           };
    protected Button[] myButton = new Button[buttonLabel.length];
    protected Panel[] myPanel = new Panel[12];
    protected Font titleFont = new Font("TimesRoman", Font.PLAIN, 12);
    protected Font labelFont = new Font("ComputerModern",Font.PLAIN, 10);
    protected String title;
    private double[] xVal;                  // x coords of curve approx. to sampling distribution
    private double[] yVal;                  // y coords of ditto.
    private int nPop;                       // number of elements in the population
    private int sampleSize;                 // size of current sample
    private int minSampleSize;              // minimum sample size (2 for vars that use ssd)
    private int maxSampleSize;              // maximum sample size (population size if sampling w/o replacement)
    private int samplesToTake;              // number of samples to take of that size
    private int samplesSoFar;               // number of samples taken so far
    private boolean showCurve = false;      // show normal, t, or chi-square approximation toggle
    private int nVars = 5;                  // number of random variable choices
    private int nCurves = 4;                // number of approximating curve choices
    private String[][] rVar = { {"Sample Sum","sum"},
                                {"Sample Mean","mean"},
                                {"Sample t","t"},
                                {"Sample S-Squared","s-squared"},
                                {"Sample Chi-Squared","chi-squared"},
                              };            // random variable options and their abbreviations
    private Hashtable varHash = new Hashtable(nVars);
    private int nSources = 3;
    String[][] rSource =      { {"Normal","normal"},
                                {"Uniform","uniform"},
                                {"Box","box"},
                              };
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
    private String currVar = null;             // current random variable displayed
    private String lastVar = null;             // previous random variable

    private int nBins;                         // number of bins for histogram
    private int nDigs = 4;                     // number of digits in text bars
    private double xMin;                       // lower limit for histogram
    private double xMax;                       // upper limit for histogram
    private double EX;                         // expected value of the variable plotted
    private double SE;                         // standard error of the variable plotted
    private double popMin;                     // smallest value in pop.
    private double popMax;                     // largest value in pop.
    private double[] pop;                      // elements of the population
    private double[] sample;                   // elements of the current sample
    double[] binEnd;                           // bin endpoints
    double[] countPop;                         // areas of the bins for the pop. histogram
    double[] countSample;                      // areas of bins for the hist. of sample means
    private double popMean;                    // the population mean
    private double popSd;                      // the population SD
    private double sd;                         // sd for normal approx
    private double mu;                         // mean for normal approx
    private double[] sampleMean;               // the history of sample means
    private double[] sampleSSq;                // history of sample s^2
    private double[] sampleT;                  // history of sample t
    private double hiLiteLo;                   // lower limit of hilighting
    private double hiLiteHi;                   // upper limit of highlighting
    */

    function init() {
      //var statsBox = jQuery('div#statsText');
      //self.statsBox = statsBox;
      //refreshStatsBox();
      var o = jQuery('<div/>').addClass('stici stici_sampledist');
      self.container.append(o);
      o.append(self.hist);
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
          /*jQuery.each(self.options.statisticTypes, function(i, stat) {
            self.statisticSelect.append(jQuery('<option/>')
                            .attr('value', stat[1])
                            .text(stat[0]));
          });
          self.statisticSelect.val(self.options.statisticType);*/
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
        /*jQuery.each(self.sourceChoices, function(i, dataSet) {
          self.dataSelect.append(jQuery('<option/>')
                         .attr('value', dataSet)
                         .text(dataSet));
        });
        if (jQuery.inArray(BOX, self.sourceChoices) != -1) {
          defaultVal = BOX;
        } else {
          defaultVal = self.sourceChoices[0];
        }
        self.dataSelect.val(defaultVal);*/
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
        self.hist.css('margin-bottom', (bottomOffset + 15) + 'px');
        self.hist.css('margin-top', (topOffset) + 'px');
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
        /*jQuery.each(self.options.curveTypes, function(i, curveChoice) {
          curveSelect.append(jQuery('<option/>')
            .attr('value', curveChoice[1])
            .text(curveChoice[0]));
        });
        curveSelect.val(self.options.curveChoice);*/
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
        self.hist.css('margin-bottom', (bottomOffset + 15) + 'px');
        self.hist.css('margin-top', (topOffset) + 'px');

    }

    // compute population statistics
    function initPop() {}                                        // UI
    function handleEvent(e) {}                                   // UI
    function replaceOK(rep) {}                                   // UI

    // test what is to be function accordingly
    function showPlot() {}                                       // UI

    // set things up when the variable is changed
    function newVariable(lastVar) {}                             // UI

    // function population
    function updateBox(newBox, updateBox) {}                     // UI

    function setSamLabel() {}                                    // UI
    function setAreas() {}                                       // UI

    function setCurveLabel() {}                                  // UI

    function drawSample(nSams, sampleSize, sourceType, varType) {
        var theSample = new Array(sampleSize);
        var indices = new Array(sampleSize);
        var xb;
        var ssq;
        var tStat;
        var tmp;
        for (var j=0; j < nSams; j++) {
            xb = 0;
            ssq = 0;
            tStat = 0;
            if ( varType() == "Sample Chi-Squared")  {                                  // stub
                if (sourceType() == "Box") {
                    var cum = vCumSum(pop);     // cum expecting an Array
                    var count = new Array(pop.length); // count expecting an Array
                    for (var i=0; i < pop.length; i++) {
                        count[i] = 0.0;
                    }
                    for (var i=0; i < sampleSize; i++) {
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
                    for ( var i=0; i < pop.length; i++) {
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
                if (sourceType() == "Box") {
                    if (replaceCheck()) {                                               // stub
                        indices = listOfRandInts(sampleSize, 0, nPop-1);
                    } else {
                        indices = listOfDistinctRandInts(sampleSize, 0, nPop-1);
                    }
                    for (var i = 0; i < sampleSize; i++) {
                        theSample[i] = pop[ indices[i] ];
                        xb += theSample[i];
                    }
                } else if (sourceType() == "Normal") {
                    for (var i = 0; i < sampleSize; i++) {
                        theSample[i] = rNorm();
                        xb += theSample[i];
                    }
                } else if (sourceType() == "Uniform") {
                    for (var i = 0; i < sampleSize; i++) {
                        theSample[i] = Math.random();
                        xb += theSample[i];
                    }
                }
                xb /= sampleSize;
                for (var i = 0; i < sampleSize; i++) {
                    ssq += (theSample[i] - xb)*(theSample[i] - xb);
                }
                if (sampleSize > 1) {                             // if n>1, log the sample s^2 and t
                    ssq /= (sampleSize-1);
                    sampleSSq[samplesSoFar()] = ssq;                                    // stub
                    tStat = xb/(Math.sqrt(ssq)/Math.sqrt(sampleSize));
                    sampleT[samplesSoFar()] = tStat;                                    // stub
                } else {                                          // otherwise, set to 0.
                    sampleSSq[samplesSoFar()] = 0;                                      // stub
                    sampleT[samplesSoFar()] = 0;                                        // stub
                }
                sampleMean[samplesSoFar++] = xb;                  // log the sample mean        // FIX: aculich 2013-03-06
                if (currVar() == "Sample Mean") {                                       // stub
                    if (xb < xMin || xb > xMax) {
                        xMin = Math.min(xb, xMin);
                        xMax = Math.max(xb, xMax);
                    }
                } else if (currVar() == "Sample t") {                                   // stub
                    if (tStat < xMin || tStat > xMax) {
                        xMin = Math.min(tStat, xMin);
                        xMax = Math.max(tStat, xMax);
                    }
                } else if ( currVar() == "Sample Sum") {                                // stub
                    tmp = xb * sampleSize;
                    if (tmp < xMin || tmp > xMax) {
                        xMin = Math.min(tmp, xMin);
                        xMax = Math.max(tmp, xMax);
                    }
                } else if (currVar() == "Sample S-Squared") {                           // stub
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
        hi.setValues(h, xMin, xMax, nDigs);
        lo.setValues(l, xMin, xMax, nDigs);
        hiLiteLo = l;
        hiLiteHi = h;
        adjustSampleSize();
    }

    function setBins(nBins, xMin, xMax, nPop, sourceType, varType, samplesSoFar) {
        var binEnd = histSetBins(nBins, xMin, xMax)
        var countPop = new Array(nBins);
        var countSample = new Array(nBins);
        if (sourceType() == "Box" && nPop > 0) {
            if (varType() == "Sample Chi-Squared") {                                    // stub
                setCurve();
            } else {
                countPop = listToHist(pop, nPop);
                setCurve();
            }
        } else if (sourceType() == "Normal") {
            for (var i=0; i < nBins; i++ ) {
                countPop[i] = (normCdf(binEnd[i+1]) -
                               normCdf(binEnd[i]))/(binEnd[i+1] - binEnd[i]);
            }
        } else if (sourceType() == "Uniform") {
            var midPt;
            for (var i=0; i < nBins; i++) {
                midPt = (binEnd[i]+binEnd[i+1])/2;
                if (midPt >= 0 && midPt <= 1) {
                    countPop[i] = 1;
                } else {
                    countPop[i] = 0;
                }
            }
        }
        if (samplesSoFar() > 0 ) {                                                      // stub
            if (currVar() == "Sample S-Squared" || currVar().equals("Sample Chi-Squared")) {    // stub
                countSample = listToHist(sampleSSq, samplesSoFar());                    // stub
            } else if (currVar() == "Sample Mean") {                                    // stub
                countSample = listToHist(sampleMean, samplesSoFar());                   // stub
            } else if (currVar() == "Sample t") {                                       // stub
                countSample = listToHist(sampleT, samplesSoFar());                      // stub
            } else if (currVar() == "Sample Sum") {                                     // stub
                countSample = listToHist(scalVMult(sampleSize,sampleMean), samplesSoFar());     // stub
            }
        } else {
            for (var i=0; i < nBins; i++) {
                countSample[i] = 0;
            }
        }

        return (binEnd, countPop, countSample);
    }

    function setLims(xMin, xMax, sampleSize, pop, popMin, popMax, popMean, popSd) {
        if (currVar() == "Sample Sum") {                                                // stub
            xMin = sampleSize * popMin; // these are the limits for the histogram
            xMax = sampleSize * popMax;
        } else if (currVar() == "Sample Chi-Squared") {                                 // stub
            xMin = 0.0;
            xMax = 10*Math.sqrt(pop.length - 1); // 5 SD
        } else if (currVar() == "Sample S-Squared") {                                   // stub
            xMin = 0.0;
            var maxDev = Math.max(popMean-popMin, popMax-popMean);
            xMax = 3*maxDev*maxDev/Math.sqrt(sampleSize);
        } else if (currVar() == "Sample Mean") {                                        // stub
            xMin = popMean-4*popSd/Math.sqrt(sampleSize);
            xMax = popMax+4*popSd/Math.sqrt(sampleSize);
        } else if (currVar() == "Sample t") {                                           // stub
            if (sampleSize > 2) {
                xMin = -3*Math.sqrt((sampleSize+0.0)/(sampleSize - 2.0));
                xMax =  3*Math.sqrt((sampleSize+0.0)/(sampleSize - 2.0));
            } else {
                xMin = -5;
                xMax = 5;
            }
        }
        if (showBoxHist()) {
            xMin = Math.min(popMin, xMin);
            xMax = Math.max(popMax, xMax);
        }
    }

    function setSampleSize(size) {
        sampleSize = size;
        adjustSampleSize();
        showPlot();
    }

    function adjustSampleSize(minSampleSize, maxSampleSize, maxMaxSampleSize, sampleSize, sampleSizeBar, nPop) {
        minSampleSize = 1;
        if (currVar() == "Sample S-Squared" || currVar() == "Sample t") {               // stub
            minSampleSize = 2;
        }
        if ( !replaceCheck() ) {                                                        // stub
            maxSampleSize = nPop;
        } else {
            maxSampleSize = maxMaxSampleSize;
        }
        sampleSize = Math.max(sampleSize,minSampleSize);
        sampleSize = Math.min(sampleSize,maxSampleSize);
        sampleSizeBar.setValues(sampleSize,minSampleSize,maxSampleSize,1);
    }

    function setCurve(xMin, xMax, pop, popMean, popSd, nPop, sampleSize, xVal, yVal, nx, sd, mu) {
        var fpc = 1.0;
        var popVar = self.popSd*self.popSd;
        if ( !replaceCheck() ) {                                                        // stub
            popVar = popVar*nPop/(nPop-1.0);
        }
        if (!replaceCheck()) {                                                          // stub
            fpc = Math.sqrt( (nPop - sampleSize + 0.0)/(nPop-1.0));
        }
        xVal = new Array(nx);
        yVal = new Array(nx);
        if (curveType() == "No Curve") {                                                // stub
            showCurve(false);                                                           // stub
        } else {
            showCurve(true);                                                            // stub
            if (curveType()() == "Chi-Squared Curve") {                                 // stub
                if (varType() == "Sample S-Squared") {                                  // stub
                    var scale = (sampleSize - 1.0)/(popVar);
                    // change of variables: (n-1)*S^2/sigma^2 ~ Chi^2_{n-1}
                    for (var i = 0; i < nx; i++) {
                        xVal[i] = xMin + i*(xMax - xMin)/(nx-1.0);
                        yVal[i] = scale*chi2Pdf(xVal[i]*scale, sampleSize-1.0);
                    }
                } else if (varType() == "Sample Chi-Squared") {                         // stub
                    for (var i=0; i < nx; i++) {
                        xVal[i] = xMin + i*(xMax - xMin)/(nx-1.0);
                        yVal[i] = chi2Pdf(xVal[i], pop.length-1.0);
                    }
                } else {
                    console.warn("Warning in SampleDist.setCurve(): Chi-squared " +
                                 "approximation to " +
                                 varType() + " Not Supported!");                        // stub
                    curveChoice.select("No Curve");
                    showCurve(false);                                                   // stub
                    return(false);
                }
            } else if (curveType() == "Normal Curve") {                                 // stub
                if (varType() == "Sample Mean") {                                       // stub
                    sd = fpc*popSd/Math.sqrt(sampleSize + 0.0);
                    mu = popMean;
                } else if (varType() == "Sample Sum") {                                 // stub
                    sd = fpc*popSd * Math.sqrt(sampleSize + 0.0);
                    mu = popMean * sampleSize;
                } else if (varType() == "Sample S-Squared") {                           // stub
                    // E(chi^2) = (n-1), so E( sigma^2 chi^2 / (n-1) = sigma^2.
                    // SD(chi^2) = sqrt(2(n-1)), so SD( sigma^2 chi^2/ (n-1)) = sqrt(2/(n-1)) sigma^2.
                    sd = Math.sqrt(2.0/(sampleSize-1.0))*popSd*popSd; // FIX ME!
                    // doesn't account for no replacement
                    mu = popVar;
                } else if (varType() == "Sample Chi-Squared") {                         // stub
                    sd = Math.sqrt(2.0*(pop.length-1.0));
                    mu = pop.length-1;
                } else if (varType() == "Sample t") {                                   // stub
                    if (sampleSize > 2) {
                        sd = sampleSize/(sampleSize-2.0);
                    } else {
                        sd = NaN;
                        console.warn("Warning in SampleDist.setCurve(): normal " +
                                     "approximation to Student t with sample size <= 2 " +
                                     " Not Supported!");
                        curveChoice.select("No Curve");
                        showCurve(false);                                               // stub
                        return(false);
                    }
                    mu = 0;
                }
                for (var i = 0; i < nx; i++) {
                    xVal[i] = xMin + i*(xMax - xMin)/(nx-1);
                    yVal[i] = normPdf(mu, sd, xVal[i]);
                }
            } else if (curveType() == "Student t Curve") {                              // stub
                if (varType() == "Sample t") {                                          // stub
                    for (var i = 0; i < nx; i++) {
                        xVal[i] = xMin + i*(xMax - xMin)/(nx-1);
                        yVal[i] = tPdf(xVal[i], sampleSize-1);
                    }
                } else {
                    console.warn("Warning in SampleDist.setCurve(): Student t " +
                                 "approximation to " + varType() +                      // stub
                                 " Not Supported!");
                    curveChoice.select("No Curve");
                    showCurve(false);                                                   // stub
                    return(false);
                }
            }
        }
        return(true);
    }

    // These are functions not present in the original java because in the java
    // they are their own classes.
    function createStubElement() {
      var placeholder = jQuery('<div/>');
      placeholder.css('width', '20px');
      placeholder.css('height', '20px');
      placeholder.css('background-color', 'red');
      return placeholder;
    }

    function createTextBar() {
      var input = jQuery('<input type="text"/>')
        .change(function(e) {
          handleEvent(e);
        });
      return input;
    }

    function createTextArea() {
      return createStubElement();
    }

    function createLabel() {
      return createStubElement();
    }

    function createHistogram() {
      return createStubElement();
    }

    function createChoice() {
      return createStubElement();
    }

    function createCheckbox() {
      return createStubElement();
    }

    init();
}
