function Stici_SampleDist(container_id, params) {
    var self = this;

    // jQuery object containing the entire chart.
    this.container =
      jQuery('#' + container_id);

    // These are constants.
    var maxBins = 100;
    var nDigs = 4;
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
    this.options = {
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
    jQuery.extend(this.options, params);

    // UI Elements.
    // Most of these are actually initialized later in init(), but they're
    // here temporarily to conform with the existing java code.
    self.populationButton = null; // SticiToggleButton, Lovingly christened 'myButton[1]' in the Java.
    self.sampleSizeBar = null;    // <input/> //size of each sample
    self.samplesToTakeBar = null; // <input/> //number of samples to take
    self.binBar = null;           // <input/> //number of bins in the histogram
    self.lo = null;  // SticiTextBar
    self.hi = null;  // SticiTextBar
    self.box = null;  // textarea                  // holds the population.
    self.popMeanLabel = null;                      // to display the population mean
    self.popSdLabel = null;                        // to display the population SD
    self.statSampleMeanLabel = null;               // to display mean of sample means
    self.statSampleSDLabel = null;                 // sample SD of sample means
    self.statExpLabel = null;                      // theor. Expected value of statistic
    self.statSELabel = null;                       // to display theor. SD of statistic or d.f. of chi-square
    self.samplesSoFarLabel = null;                 // number of samples of current size taken
    self.boxLabel = null;                          // label box as population or category probabilities
    self.areaLabel = null;  // span
    self.curveAreaLabel = null;  // span
    self.hist = new SticiHistogram();
    self.replaceCheck = null;
    self.varChoice = null;  // SticiComboBox       // options for which random variable to sample
    self.curveChoice = null;  // SticiComboBox     // options for which approximating curve to plot
    self.sourceChoice = null;  // SticiComboBox    // options for data source (box, normal, uniform)
    self.stats = null;                             // Contains all of the statistics labels.

    // State variables.
    self.pop = [];
    self.xMin = null;
    self.xMax = null;
    self.samplesSoFar = 0;
    self.sampleMean = [];                        // the history of sample means
    self.sampleSSq = [];                         // history of sample s^2
    self.sampleT = [];                           // history of sample t
    self.sampleSize = 1;                         // size of current sample
    self.binEnd = [];                            // bin endpoints
    self.countPop = [];                          // areas of the bins for the pop. histogram
    self.countSample = [];                       // areas of bins for the hist. of sample means


    // These are class variables from the original java that probably have not
    // yet been incorporated.
    /*
    protected String title;
    private double[] xVal;                  // x coords of curve approx. to sampling distribution
    private double[] yVal;                  // y coords of ditto.
    private int nPop;                       // number of elements in the population
    private int minSampleSize;              // minimum sample size (2 for vars that use ssd)
    private int maxSampleSize;              // maximum sample size (population size if sampling w/o replacement)
    private int samplesToTake;              // number of samples to take of that size
    private int samplesSoFar;               // number of samples taken so far
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
    private String currVar = null;             // current random variable displayed
    private String lastVar = null;             // previous random variable

    private int nBins;                         // number of bins for histogram
    private double EX;                         // expected value of the variable plotted
    private double SE;                         // standard error of the variable plotted
    private double popMin;                     // smallest value in pop.
    private double popMax;                     // largest value in pop.
    private double[] pop;                      // elements of the population
    private double[] sample;                   // elements of the current sample
    private double popMean;                    // the population mean
    private double popSd;                      // the population SD
    private double sd;                         // sd for normal approx
    private double mu;                         // mean for normal approx
    private double hiLiteLo;                   // lower limit of hilighting
    private double hiLiteHi;                   // upper limit of highlighting
    */

    function init() {
      var o = jQuery('<div/>').addClass('stici stici_sampledist');
      self.container.append(o);

      // General pieces
      var top = jQuery('<div/>').addClass('top_controls');
      var middle = jQuery('<div/>').addClass('middle');
      var bottom = jQuery('<div/>').addClass('bottom_controls');
      o.append(top, middle, bottom);

      // Compose the top piece.
      top.append(createSelectDataSourceControls());

      // Compose the middle pieces.
      middle.append(createStatsBox(), self.hist, createPopulationBox());

      // Compose the bottom piece.
      if (self.options.showBoxHist)
        bottom.append(createSampleRow(),
                      createAreaSelectRow(),
                      createInfoRow());

      // Make sure everything is sized correctly.
      middle.height(self.container.height() - top.height() - bottom.height());
      self.hist.width(middle.width() - self.stats.width() - self.box.width() - 8);

      // Below this point lie methods used to build the individual pieces.
      // Top.
      function createSelectDataSourceControls() {
        var dataSelectControls = jQuery('<div/>');
        self.varChoice = new SticiComboBox({
          label: "Distribution of: ",
          options: rVar,
          selected: self.options.startWith
        });
        self.sourceChoice = new SticiComboBox({
          label: "Sample from: ",
          options: rSource,
          selected: "Box"
        });
        dataSelectControls.append(self.varChoice, self.sourceChoice);
        if (self.options.replaceControl) {
          self.replaceCheck = jQuery('<input type="checkbox" id="withReplacement" />');
          self.replaceCheck.attr('checked', self.options.withReplacement);
          dataSelectControls.append(self.replaceCheck, ' with replacement');
        }
        var takeSampleButton = jQuery('<button id="takeSample"/>').text('Take Sample');
        dataSelectControls.append(takeSampleButton);
        return dataSelectControls;
      }
      // Middle.
      function createPopulationBox() {
        var container = jQuery('<div/>').addClass('population');
        self.boxLabel = jQuery('<div/>');
        self.box = jQuery('<textarea/>');
        if (!self.options.boxEditable)
          self.box.attr("readonly", "readonly");
        container.append(self.boxLabel, self.box);
        return container;
      }
      function createStatsBox() {
        self.stats = jQuery('<div/>').addClass('statsText');
        self.popMeanLabel = jQuery('<p/>');
        self.popSdLabel = jQuery('<p/>');
        self.statExpLabel = jQuery('<p/>');
        self.statSELabel = jQuery('<p/>');
        self.stats.append(self.popMeanLabel,
                        self.popSdLabel,
                        self.statExpLabel,
                        self.statSELabel);
        if (self.options.statLabels) {
          self.statSampleMeanLabel = jQuery('<p/>');
          self.statSampleSDLabel = jQuery('<p/>');
          self.stats.append(self.statSampleMeanLabel,
                          self.statSampleSDLabel);
        }
        self.samplesSoFarLabel = jQuery('<p/>');
        self.stats.append(self.samplesSoFarLabel);

        return self.stats;
      }
      // Bottom.
      function createSampleRow() {
        if (self.options.showBoxHist) {
          var row = jQuery('<div/>');

          self.areaLabel = jQuery('<span/>');
          self.curveAreaLabel = jQuery('<span/>');
          self.curveChoice = new SticiComboBox({
            label: '',
            options: curveLabel
          });
          self.populationButton = SticiToggleButton({
            trueLabel: 'No Population Histogram',
            falseLabel: 'Population Histogram',
            value: self.options.showPopulation
          });

          row.append(self.areaLabel,
                     self.curveAreaLabel,
                     self.curveChoice,
                     self.populationButton);
          return row;
        }
        return null;
      }
      function createAreaSelectRow() {
        var row = jQuery('<div/>').addClass('areaHiLite');
        self.lo = new SticiTextBar({
          step: 0.001,
          value: 0,
          label: 'Area from: '
        });
        self.hi = new SticiTextBar({
          step: 0.001,
          value: 0,
          label: ' to: '
        });
        row.append(self.lo, self.hi);
        return row;
      }
      function createInfoRow() {
        var row = jQuery('<div/>');

        self.sampleSizeBar = jQuery('<input type="text"/>').val(self.options.sampleSize);
        self.samplesToTakeBar = jQuery('<input type="text"/>').val(self.options.samplesToTake);
        row.append("Sample Size: ",
                   self.sampleSizeBar,
                   " Take ",
                   self.samplesToTakeBar,
                   " samples. ");
        if (self.options.binControls) {
          self.binBar = jQuery('<input type="text" id="bins" />').val(self.options.bins);
          row.append(" Bins: ", self.binBar);
        }
        return row;
      }


      // The UI has been set up. Now initialize the data.
      if (self.options.sources === null ||
          self.options.sources.toLowerCase().indexOf("box") >= 0 ||
            self.options.sources.toLowerCase().indexOf("all") >= 0) {
        if (self.varChoice.selected() == "Sample Chi-Squared")
          self.boxLabel.text("Category Probabilities");
        else
          self.boxLabel.text("Population");
      }
      var bc = "";
      if (self.options.boxContents !== null) {
        bc = self.options.boxContents;
      } else if (sourceChoice.getSelectedItem().equals("Normal")) {
        bc = "Normal";
      } else if (sourceChoice.getSelectedItem().equals("Uniform")) {
        bc = "Uniform";
      } else {
        bc = "0 1 2 3 4";
      }
      setBox(bc, true);
      var vmx = vMinMax(self.pop);
      self.xMin = vmx[0];
      self.xMax = vmx[1];
      initPop();
      setCurve();                                   // set the approximating curve
      setBins();                                    // make the histogram counts
      setBars(self.options.hiLiteLo, self.options.hiLiteHi);
      adjustSampleSize();
      validate();                                   // wishful thinking
      showPlot();                                   // refresh the histogram
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
    function setBox(newBox, updateBox) {               // parse new population
      if (updateBox === undefined)
        updateBox = false;

      if (newBox.toLowerCase() == "normal") {
        self.replaceCheck.attr('checked', true);
        self.pop = [-4, 4];
        self.box.text("Normal");
        self.sourceChoice.selected("Normal");
        if (self.varChoice.selected() == "Sample Chi-Squared") {
          console.log("Warning in SampleDist.setBox(): normal incompatible " +
                             "with Sample Chi-Squared");
          self.varChoice.selected("Sample Mean");
        }
      } else if (newBox.toLowerCase() == "uniform") {
        replaceCheck.attr('checked', true);
        self.pop = [0, 1];
        self.box.text("Uniform");
        self.sourceChoice.selected("Uniform");
        if (self.varChoice.selected() == "Sample Chi-Squared") {
          console.log("Warning in SampleDist.setBox(): uniform incompatible " +
                             "with Sample Chi-Squared");
          self.varChoice.select("Sample Mean");
        }
      } else {
        self.pop = newBox.split(/[\n\t\r ,]+/);
        self.pop = jQuery.map(self.pop, function(v) {return parseFloat(v);});
        if (self.varChoice.selected() == "Sample Chi-Squared") {
          self.pop = jQuery.grep(self.pop, function(v) {
            return (v !== 0 && !isNaN(v));
          });
          pop = scalVMult(1.0/vSum(self.pop), self.pop);
          updateBox = true;
        }
        if (updateBox) {
          self.box.text(jQuery.map(self.pop, function(v) {return v.fix(nDigs);}).join("\r"));
        }
        self.sourceChoice.selected("Box");
      }
      initPop();
      samplesSoFar = 0;
      setSamLabel();
    }  // ends setBox(String, boolean)

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

    function setBins() {
      self.binEnd = [];
      jQuery.each(range(0, self.binBar.val() + 1), function(i) {
          self.binEnd[i] = self.xMin + i*(self.xMax - self.xMin)/self.binBar.val();
      });
      self.countPop = new Array(self.binBar.val());
      self.countSample = new Array(self.binBar.val());
      if (self.sourceChoice.selected() == "Box" && self.pop.length > 0) {
        if (self.varChoice.selected() == "Sample Chi-Squared") {
          setCurve();
        } else {
          self.countPop = listToHist(self.pop, self.pop.length);
          setCurve();
        }
      } else if (self.sourceChoice.selected() == "Normal") {
        jQuery.each(range(0, self.binBar.val()), function(i) {
          self.countPop[i] = (normCdf(binEnd[i+1]) -
                         normCdf(binEnd[i]))/(binEnd[i+1] - binEnd[i]);
        });
      } else if (self.sourceChoice.selected() == "Uniform") {
        var midPt;
        jQuery.each(range(0, self.binBar.val()), function(i) {
          midPt = (binEnd[i]+binEnd[i+1])/2;
          if (midPt >= 0 && midPt <= 1) {
            self.countPop[i] = 1;
          } else {
            self.countPop[i] = 0;
          }
        });
      }
      if (self.samplesSoFar > 0 ) {
        if (currVar() == "Sample S-Squared" || currVar() == "Sample Chi-Squared") {
          self.countSample = listToHist(self.sampleSSq, self.samplesSoFar);
        } else if (currVar() == "Sample Mean") {
          self.countSample = listToHist(self.sampleMean, self.samplesSoFar);
        } else if (currVar() == "Sample t") {
          self.countSample = listToHist(self.sampleT, self.samplesSoFar);
        } else if (currVar() == "Sample Sum") {
          self.countSample = listToHist(scalVMult(self.sampleSize, self.sampleMean), self.samplesSoFar);
        }
      } else {
        jQuery.each(range(0, self.binBar.val()), function(i) {
          self.countSample[i] = 0;
        });
      }
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
      return; // Don't bother for now.
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

    init();
}
