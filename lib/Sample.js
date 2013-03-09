function Stici_SampleDist(container_id, params) {
    var self = this;

    // jQuery object containing the entire chart.
    var container = jQuery('#' + container_id);

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
    var populationButton = null; // SticiToggleButton, Lovingly christened 'myButton[1]' in the Java.
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
    var pop = [];
    var xMin = null;
    var xMax = null;
    var samplesSoFar = 0;
    var sampleMean = [];                        // the history of sample means
    var sampleSSq = [];                         // history of sample s^2
    var sampleT = [];                           // history of sample t
    var sampleSize = 1;                         // size of current sample
    var binEnd = [];                            // bin endpoints
    var countPop = [];                          // areas of the bins for the pop. histogram
    var countSample = [];                       // areas of bins for the hist. of sample means
    var hiLiteLo = options.hiLiteLo;
    var hiLiteHi = options.hiLiteHi;
    var showBoxHist = options.showBoxHist;
    var nBins = options.bins;


    // These are class variables from the original java that probably have not
    // yet been incorporated.
    /*
    protected String title;
    private double[] xVal;                  // x coords of curve approx. to sampling distribution
    private double[] yVal;                  // y coords of ditto.
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

      // Below this point lie methods used to build the individual pieces.
      // Top.
      function createSelectDataSourceControls() {
        var dataSelectControls = jQuery('<div/>');
        varChoice = new SticiComboBox({
          label: "Distribution of: ",
          options: rVar,
          selected: options.startWith
        });
        sourceChoice = new SticiComboBox({
          label: "Sample from: ",
          options: rSource,
          selected: "Box"
        });
        dataSelectControls.append(varChoice, sourceChoice);
        if (options.replaceControl) {
          replaceCheck = jQuery('<input type="checkbox" id="withReplacement" />');
          replaceCheck.attr('checked', options.withReplacement);
          dataSelectControls.append(replaceCheck, ' with replacement');
        }
        var takeSampleButton = jQuery('<button id="takeSample"/>').text('Take Sample');
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
            value: options.showPopulation
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

        sampleSizeBar = jQuery('<input type="text"/>').val(options.sampleSize);
        samplesToTakeBar = jQuery('<input type="text"/>').val(options.samplesToTake);
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
      } else if (sourceChoice.getSelectedItem().equals("Normal")) {
        bc = "Normal";
      } else if (sourceChoice.getSelectedItem().equals("Uniform")) {
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
            replaceCheck.setState(true);
        } else if (sourceChoice.selected() == "Uniform") {
            popMean = 0.5;
            popSd = Math.sqrt(1.0/12.0);
            replaceCheck.setState(true);
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

    function handleEvent(e) {}                                   // UI
    function replaceOK(rep) {}                                   // UI

    // test what is to be plotted; adjust variables accordingly
    function showPlot() {
      if (samplesSoFar > 0) {
        if (showBoxHist)
          hist.set(binEnd, [countPop, countSample], [null, null]);
        else
          hist.set(binEnd, [[], countSample], [null, null]);
      } else {
        if (showBoxHist)
          hist.set(binEnd, [countPop, []], [null, null]);
        else
          hist.set(binEnd, [[], countSample], [null, null]);
      }
      hist.hilite(hiLiteLo, hiLiteHi);
    }

    // set things up when the variable is changed
    function newVariable(lastVar) {}                             // UI

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
          box.text(jQuery.map(pop, function(v) {return v.fix(nDigs);}).join("\r"));
        }
        sourceChoice.selected("Box");
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
                        indices = listOfRandInts(sampleSize, 0, pop.length-1);
                    } else {
                        indices = listOfDistinctRandInts(sampleSize, 0, pop.length-1);
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
        if (currVar() == "Sample S-Squared" || currVar() == "Sample Chi-Squared") {
          countSample = listToHist(sampleSSq, binEnd, nBins, samplesSoFar);
        } else if (currVar() == "Sample Mean") {
          countSample = listToHist(sampleMean, binEnd, nBins, samplesSoFar);
        } else if (currVar() == "Sample t") {
          countSample = listToHist(sampleT, binEnd, nBins, samplesSoFar);
        } else if (currVar() == "Sample Sum") {
          countSample = listToHist(scalVMult(sampleSize, binEnd, nBins, sampleMean), samplesSoFar);
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
      return; // Don't bother for now.
        var fpc = 1.0;
        var popVar = popSd*popSd;
        if ( !replaceCheck() ) {                                                        // stub
            popVar = popVar*pop.length/(pop.length-1.0);
        }
        if (!replaceCheck()) {                                                          // stub
            fpc = Math.sqrt( (pop.length - sampleSize + 0.0)/(pop.length-1.0));
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
